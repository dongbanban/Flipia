import { ICON_SEMANTIC_MAP, COLOR_TOKENS } from "@/lib/icon-config";
import type { UnifiedIconProps, AdapterOutput } from "./types";

/**
 * 解析颜色令牌：`$token` 前缀的颜色值会被替换为对应主题色，其余原样透传。
 * @param value - 调用方传入的颜色值
 * @returns 解析后的颜色值，或 undefined
 */
function resolveColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('$')) {
    const token = value.slice(1);
    return COLOR_TOKENS[token] || value;
  }
  return value;
}

/**
 * TDesign 图标适配器。
 *
 * 将统一图标属性转换为 TDesign `<t-icon>` 组件所需的渲染参数。
 * - 通过 ICON_SEMANTIC_MAP 查找 TDesign 原生图标名
 * - 未命中映射的名称原样透传为 t-icon 的 name（由 TDesign 自行处理）
 * - 单色调用方通过 `color` 属性传入颜色时，适配为 `fillColor`
 * - 多色 props（`fillColor`、`strokeColor`、`strokeWidth`、`brand`）直接透传
 * - CHEVRON_DOWN 无需旋转（TDesign 原生支持 chevron-down 图标）
 * - 颜色支持 `$token` 语法引用主题色（如 `$primary` → `#c8815e`）
 *
 * @param props - 统一图标属性（语义名）
 * @returns TDesign 渲染参数
 */
export function tdesignAdapter(props: UnifiedIconProps): AdapterOutput {
  // 查找 TDesign 映射名，未命中则原样透传
  const tName: string = ICON_SEMANTIC_MAP[props.name] ?? props.name;

  // 颜色：支持 $token 语法，fillColor 优先，其次取 color；strokeColor 同理
  // 单独传 color 时同时设 fillColor 和 strokeColor（不同图标的渲染通道不同）
  const effectiveColor = resolveColor(props.color);
  const effectiveFill = resolveColor(props.fillColor) || effectiveColor || "";
  const effectiveStroke = resolveColor(props.strokeColor) || effectiveColor || "";

  // 构建 t-icon 组件属性
  // brand 未设时用 "tdesign" 匹配 t-icon 默认值，传空字符串会覆盖默认值导致图标查不到
  const tProps: Record<string, unknown> = {
    name: tName,
    size: `${props.size ?? 24}rpx`,
    fillColor: effectiveFill,
    strokeColor: effectiveStroke,
    strokeWidth: props.strokeWidth ?? 2,
    brand: props.brand || "tdesign",
  };

  return {
    componentType: "t-icon",
    props: tProps,
    inlineStyle: "",
  };
}
