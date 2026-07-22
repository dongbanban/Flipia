import type { DishRecord } from "@/lib/dish-pool";
import type { Category } from "@/lib/init-data";
import { sortDishes, attachCreatorNames } from "@/lib/dish-pool";
import { QUERY } from "@/config";
import { escapeRegex, buildCategoryMap } from "./helpers";

/** 搜索上下文 */
export interface SearchContext {
  db: ReturnType<typeof wx.cloud.database>;
  groupId: string;
  categories: Category[];
}

/**
 * 执行关键词搜索，返回带分类名的菜品列表。
 * 包含菜品排序和创建者昵称解析。
 */
export async function searchDishes(
  ctx: SearchContext,
  keyword: string,
): Promise<(DishRecord & { categoryName: string })[]> {
  const { db, groupId, categories } = ctx;
  const escaped = escapeRegex(keyword);

  try {
    const res = await db.collection("dishes")
      .where({
        groupId,
        name: db.RegExp({ regexp: escaped, options: "i" }),
      })
      .orderBy("createdAt", "desc")
      .limit(QUERY.LIMIT_GENERIC_MAX)
      .get();

    const dishes = res.data as DishRecord[];
    const sorted = sortDishes(dishes);

    // 解析创建者昵称
    const creatorIds = [
      ...new Set(
        sorted
          .map((d) => d.creatorId)
          .filter(
            (id): id is string =>
              !!id && !sorted.find((d) => d.creatorId === id)?.creatorName,
          ),
      ),
    ];

    const nameMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const userRes = await db.collection("users")
        .where({ _openid: db.command.in(creatorIds) })
        .get();
      for (const user of userRes.data as Array<{
        _openid: string;
        nickName: string;
      }>) {
        nameMap[user._openid] = user.nickName;
      }
    }

    const withCreatorNames = attachCreatorNames(sorted, nameMap);
    const catMap = buildCategoryMap(categories);

    return withCreatorNames.map((d) => ({
      ...d,
      categoryName: catMap[d.categoryId] ?? d.categoryId,
    }));
  } catch (err) {
    console.error("[dish-pool] search failed", err);
    return [];
  }
}
