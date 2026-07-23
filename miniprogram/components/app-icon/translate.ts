/**
 * 语义图标名到 WeUI 原生 icon 类型的映射表。
 *
 * 11 个 Flipia 语义名映射到 WeUI 原生图标。未命中映射的名称原样透传，
 * 保证未来新增图标无需改映射表即可使用。
 */

/** Flipia 语义名 → WeUI 原生 icon 类型映射 */
export const SEMANTIC_TO_WEUI: Record<string, string> = {
  CLOSE: "close",
  ADD: "add",
  CHEVRON_RIGHT: "arrow",
  CHEVRON_DOWN: "arrow",
  TOGGLE_ON: "done",
  TOGGLE_OFF: "close",
  SEARCH: "search",
  SHARE: "share",
  AVATAR: "me",
  MINUS: "delete",
  // HELP 未映射 — fallthrough 原样透传，WeUI 无法识别时显示为空
};

/**
 * 将语义图标名翻译为指定后端的原生图标名。
 * @param name - Flipia 语义图标名（如 `'CLOSE'`、`'ADD'`）
 * @param backend - 目标后端标识（如 `'weui'`）
 * @returns 后端原生图标名，未命中映射时原样返回 `name`
 */
export function translate(name: string, backend: string): string {
  if (backend === "weui") {
    return SEMANTIC_TO_WEUI[name] || name;
  }
  // 其他后端暂未实现，原样透传
  return name;
}
