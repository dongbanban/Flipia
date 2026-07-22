import type { DishRecord } from "@/lib/dish-pool";

/** 保存上下文 */
export interface SaveContext {
  db: ReturnType<typeof wx.cloud.database>;
  groupId: string;
  openid: string;
}

/** 新增菜品参数 */
export interface AddDishParams {
  name: string;
  categoryId: string;
  images: string[];
}

/** 编辑菜品参数 */
export interface EditDishParams {
  _id: string;
  name: string;
  categoryId: string;
  images: string[];
  enabled: boolean;
  cookingDescription: string;
}

/** 编辑操作的返回 */
export interface EditDishResult {
  removedFileIDs: string[];
}

/**
 * 对比原图列表与当前图列表，找出被移除的图片 fileID。
 */
export function diffRemovedImages(original: string[], current: string[]): string[] {
  return original.filter((fid) => !current.includes(fid));
}

/**
 * 新增菜品到数据库。
 * 返回新菜品的 _id 和 createdAt。
 */
export async function addDishToDb(
  ctx: SaveContext,
  params: AddDishParams,
): Promise<{ _id: string; createdAt: number }> {
  const { db, groupId, openid } = ctx;
  const now = Date.now();
  const addRes = await db.collection("dishes").add({
    data: {
      groupId,
      name: params.name,
      categoryId: params.categoryId,
      images: params.images,
      enabled: true,
      creatorId: openid,
      createdAt: now,
    },
  });
  return { _id: addRes._id as unknown as string, createdAt: now };
}

/**
 * 更新数据库中的菜品。
 * 返回被移除的图片 fileID 列表（供调用方清理）。
 */
export async function updateDishInDb(
  ctx: SaveContext,
  params: EditDishParams,
  originalImages: string[],
): Promise<EditDishResult> {
  const { db } = ctx;
  await db.collection("dishes")
    .doc(params._id)
    .update({
      data: {
        name: params.name,
        categoryId: params.categoryId,
        images: params.images,
        enabled: params.enabled,
        cookingDescription: params.cookingDescription,
        updatedAt: Date.now(),
      },
    });

  return { removedFileIDs: diffRemovedImages(originalImages, params.images) };
}
