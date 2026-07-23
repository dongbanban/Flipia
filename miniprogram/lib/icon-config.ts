/**
 * 图标系统核心配置：语义名 → TDesign 原生名的映射表、全局后端默认值、后端解析函数。
 *
 * 本模块仅导出纯数据与纯函数，不依赖任何 UI 或运行时环境。
 */

// ── 语义映射 ──────────────────────────────────────────────────

/** 语义图标名到 TDesign 原生 icon 类型的映射表。共 11 个语义名。 */
export const ICON_SEMANTIC_MAP: Record<string, string> = {
  CLOSE: "close",
  ADD: "add",
  CHEVRON_RIGHT: "chevron-right",
  CHEVRON_DOWN: "chevron-down",
  TOGGLE_ON: "check-circle-filled",
  TOGGLE_OFF: "circle",
  SEARCH: "search",
  SHARE: "share",
  AVATAR: "user-avatar",
  MINUS: "minus",
  HELP: "help",
};

// ── 全局后端配置 ──────────────────────────────────────────────

/** 默认图标后端标识，全局生效。 */
export const DEFAULT_ICON_BACKEND = "tdesign";

/** 当前全局后端值，可被外部修改。 */
let globalBackend: string = DEFAULT_ICON_BACKEND;

/**
 * 获取当前生效的图标后端。
 * @param override - 实例级覆盖值，优先级高于全局默认
 * @returns 生效的后端标识字符串
 */
export function getIconBackend(override?: string): string {
  return override || globalBackend;
}

/**
 * 修改全局后端默认值。
 * @param backend - 新的后端标识
 */
export function setIconBackend(backend: string): void {
  globalBackend = backend;
}

/**
 * 将全局后端重置为 `DEFAULT_ICON_BACKEND`。
 */
export function resetIconBackend(): void {
  globalBackend = DEFAULT_ICON_BACKEND;
}

// ── 颜色令牌 ──────────────────────────────────────────────────

export { THEME_COLORS as COLOR_TOKENS } from './theme';
