import type { Category } from "@/lib/init-data";

/**
 * 对正则表达式特殊字符进行转义。
 * 用于将用户搜索关键词安全地嵌入数据库模糊搜索中。
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 构建分类 ID 到分类名的映射。
 */
export function buildCategoryMap(categories: Category[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const cat of categories) {
    map[cat.id] = cat.name;
  }
  return map;
}
