// dish-pool — pure functions for dish pool display logic.

export interface DishRecord {
  _id: string;
  name: string;
  categoryId: string;
  groupId?: string;
  enabled: boolean;
  images?: string[];
  creatorId?: string;
  creatorName?: string;
  createdAt?: number;
  cookingDescription?: string;
}

/**
 * 按 createdAt 倒序排列菜品（较新在前）。
 * 无 createdAt 的条目排到末尾。不修改原数组。
 */
export function sortDishes(dishes: DishRecord[]): DishRecord[] {
  return [...dishes].sort((a, b) => {
    const ta = a.createdAt ?? -Infinity;
    const tb = b.createdAt ?? -Infinity;
    return tb - ta;
  });
}

/**
 * 校验并截断菜品名称（最多 20 字，trim 后处理）。
 * 返回 { value, error }：error 非 null 时为错误提示文案。
 */
export function validateDishName(raw: string): {
  value: string;
  error: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { value: "", error: "菜品名不能为空" };
  const value = trimmed.slice(0, 20);
  return { value, error: null };
}

/**
 * 翻转菜品的 enabled 状态。不修改原对象。
 */
export function toggleEnabled(dish: DishRecord): Pick<DishRecord, "enabled"> {
  return { enabled: !dish.enabled };
}

/**
 * 从 users 集合的昵称映射解析菜品的 creatorName。
 * dishes 中已存在 creatorName 的优先保留，否则按 creatorId 从映射查找。
 */
/**
 * 构建导入菜品的数据库写入数据。
 * 从源菜品复制字段，替换 groupId，将 createdAt 置为当前时间。
 */
export function buildImportDishData(
  source: DishRecord,
  targetGroupId: string,
): Omit<DishRecord, "_id"> {
  return {
    name: source.name,
    categoryId: source.categoryId,
    enabled: source.enabled,
    images: source.images,
    creatorId: source.creatorId,
    creatorName: source.creatorName,
    createdAt: Date.now(),
    groupId: targetGroupId,
    cookingDescription: source.cookingDescription,
  };
}

export function attachCreatorNames(
  dishes: DishRecord[],
  nameMap: Record<string, string>,
): DishRecord[] {
  return dishes.map((d) => {
    if (d.creatorName) return d;
    const name = d.creatorId ? nameMap[d.creatorId] : undefined;
    return name ? { ...d, creatorName: name } : d;
  });
}
