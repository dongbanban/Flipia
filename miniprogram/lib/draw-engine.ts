// 抽取引擎 — 随机菜品选择的纯函数。

export interface Dish {
  id: string;
  name: string;
  categoryId: string;
  enabled: boolean;
  images?: string[];
}

export interface DrawConfigEntry {
  categoryId: string;
  categoryName: string;
  count: number;
}

export interface DrawResultGroup {
  categoryId: string;
  categoryName: string;
  dishes: Dish[];
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** 从菜品池中筛选出指定分类的菜品。 */
function filterByCategory(pool: Dish[], categoryId: string): Dish[] {
  return pool.filter((d) => d.categoryId === categoryId);
}

/** 对数组做原地外 Fisher-Yates 洗牌，返回新数组，不修改原数组。 */
function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 按配置从菜品池中随机抽取菜品。
 * 每个分类独立洗牌后取前 N 道；若可用数量不足则取全部，不抛错。
 */
export function drawDishes(
  pool: Dish[],
  config: DrawConfigEntry[],
): DrawResultGroup[] {
  return config.map(({ categoryId, categoryName, count }) => {
    const available = filterByCategory(pool, categoryId);
    const shuffled = fisherYatesShuffle(available);
    return { categoryId, categoryName, dishes: shuffled.slice(0, count) };
  });
}

/**
 * 校验菜品池是否满足抽取配置的数量要求。
 * 遇到第一个不满足的分类即返回 invalid 及原因文案；全部满足返回 valid。
 */
export function validateDrawConfig(
  pool: Dish[],
  config: DrawConfigEntry[],
): ValidationResult {
  for (const { categoryId, categoryName, count } of config) {
    const available = filterByCategory(pool, categoryId).length;
    if (available < count) {
      return {
        valid: false,
        reason: `${categoryName}的菜不太够，至少 ${count} 道哦`,
      };
    }
  }
  return { valid: true };
}
