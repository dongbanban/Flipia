/**
 * 对正则表达式特殊字符进行转义。
 * 用于将用户搜索关键词安全地嵌入数据库模糊搜索中。
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
