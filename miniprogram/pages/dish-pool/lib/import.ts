import type { DishRecord } from "@/lib/dish-pool";
import type { Category } from "@/lib/init-data";
import { buildImportDishData } from "@/lib/dish-pool";
import { QUERY } from "@/config";

/** 导入上下文 */
export interface ImportContext {
  db: ReturnType<typeof wx.cloud.database>;
  groupId: string;
}

/** 可导入的源厨房 */
export interface ImportSource {
  _id: string;
  name: string;
}

/** 带勾选状态的分类 */
export interface ImportSourceCategory extends Category {
  checked: boolean;
  dishCount: number;
}

/** 导入结果 */
export interface ImportResult {
  newCategories: Category[];
  totalImported: number;
}

/**
 * 获取当前用户除当前厨房外的其他厨房作为导入源。
 */
export function getImportSources(
  allGroups: Array<{ _id: string; name: string }>,
  currentGroupId: string,
): ImportSource[] {
  return allGroups
    .filter((g) => g._id !== currentGroupId)
    .map((g) => ({ _id: g._id, name: g.name }));
}

/**
 * 加载源厨房的分类列表（含每个分类的菜品计数）。
 */
export async function loadSourceCategories(
  ctx: ImportContext,
  sourceGroupId: string,
): Promise<ImportSourceCategory[]> {
  const { db } = ctx;

  try {
    const configRes = await db.collection("user_config")
      .where({ groupId: sourceGroupId })
      .limit(1)
      .get();

    if (configRes.data.length === 0) {
      return [];
    }

    const sourceCategories: Category[] = (
      configRes.data[0] as { categories: Category[] }
    ).categories;

    const catsWithCount = await Promise.all(
      sourceCategories.map(async (cat) => {
        const countRes = await db.collection("dishes")
          .where({ groupId: sourceGroupId, categoryId: cat.id })
          .count();
        return {
          ...cat,
          checked: true,
          dishCount: countRes.total,
        };
      }),
    );

    return catsWithCount;
  } catch (err) {
    console.error("[dish-pool] load source categories failed", err);
    return [];
  }
}

/**
 * 执行导入：将勾选分类下的菜品复制到当前厨房，必要时同步分类。
 */
export async function executeImport(
  ctx: ImportContext,
  sourceGroupId: string,
  checkedCategories: ImportSourceCategory[],
  targetCategories: Category[],
): Promise<ImportResult> {
  const { db, groupId } = ctx;
  const existingCatIds = new Set(targetCategories.map((c) => c.id));
  const newCategories: Category[] = [];
  let totalImported = 0;

  try {
    for (const cat of checkedCategories) {
      if (!existingCatIds.has(cat.id)) {
        newCategories.push({ id: cat.id, name: cat.name });
      }

      const MAX_LIMIT = QUERY.LIMIT_GENERIC_MAX;
      let allDishes: DishRecord[] = [];
      let hasMore = true;

      while (hasMore) {
        const res = await db.collection("dishes")
          .where({ groupId: sourceGroupId, categoryId: cat.id })
          .limit(MAX_LIMIT)
          .skip(allDishes.length)
          .get();

        const batch = res.data as DishRecord[];
        allDishes = allDishes.concat(batch);
        hasMore = batch.length === MAX_LIMIT;
      }

      for (const dish of allDishes) {
        const importData = buildImportDishData(dish, groupId);
        await db.collection("dishes").add({ data: importData });
        totalImported++;
      }
    }

    return { newCategories, totalImported };
  } catch (err) {
    console.error("[dish-pool] import failed", err);
    throw err;
  }
}
