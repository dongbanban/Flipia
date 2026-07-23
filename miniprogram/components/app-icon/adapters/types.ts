/**
 * 图标适配器类型定义 — 统一图标属性、适配器输出、适配器函数签名。
 *
 * 各图标后端（WeUI、图片、SVG 等）实现 `IconAdapter` 函数，
 * 将 `UnifiedIconProps` 转换为该后端所需的渲染参数。
 */

// ── 统一属性 ──────────────────────────────────────────────────

/** 跨后端的统一图标属性。 */
export interface UnifiedIconProps {
  /** 语义图标名（如 `'success'`, `'search'`, `'close'`），由 `ICON_SEMANTIC_MAP` 解析 */
  name: string;
  /** 图标尺寸，单位由各适配器自行约定（通常为 rpx） */
  size?: number;
  /** 图标颜色，CSS 颜色值 */
  color?: string;
  /** 填充色，CSS 颜色值 */
  fillColor?: string;
  /** 描边色，CSS 颜色值 */
  strokeColor?: string;
  /** 描边宽度，数值 */
  strokeWidth?: number;
  /** 是否为品牌色图标 */
  brand?: boolean;
  /** 覆盖后端标识，优先级高于全局默认 */
  backend?: string;
}

// ── 适配器输出 ────────────────────────────────────────────────

/** 适配器转换结果：告诉渲染层使用哪个组件类型、传哪些属性、应用什么内联样式。 */
export interface AdapterOutput {
  /** 目标组件类型名（如 `'mp-icon'`, `'image'`, `'view'`） */
  componentType: string;
  /** 传递给目标组件的属性集 */
  props: Record<string, unknown>;
  /** 编译后的内联样式字符串（如 `'width:32rpx;height:32rpx;color:#c8815e'`） */
  inlineStyle: string;
}

// ── 适配器函数 ────────────────────────────────────────────────

/**
 * 图标适配器函数签名。
 * @param props - 统一图标属性
 * @returns 适配后的渲染参数
 */
export type IconAdapter = (props: UnifiedIconProps) => AdapterOutput;
