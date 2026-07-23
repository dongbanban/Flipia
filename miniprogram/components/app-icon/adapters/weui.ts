import { translate } from "../translate";
import type { UnifiedIconProps, AdapterOutput } from "./types";

/**
 * WeUI 图标适配器。
 *
 * 将统一图标属性转换为 WeUI `<mp-icon>` 组件所需的渲染参数。
 * - `color` → CSS `color` 内联样式（单色图标通过字体颜色控制）
 * - `size` → CSS `font-size` 内联样式（WeUI 图标尺寸由字号决定）
 * - 多色 props（`fillColor`、`strokeColor`、`strokeWidth`、`brand`）被静默忽略
 * - `CHEVRON_DOWN` 附加 `transform: rotate(90deg)` 实现下箭头旋转
 *
 * @param props - 统一图标属性（语义名）
 * @returns WeUI 渲染参数
 */
export function weuiAdapter(props: UnifiedIconProps): AdapterOutput {
  const weuiIcon = translate(props.name, "weui");
  const styleParts: string[] = [];

  // 单色：通过 CSS color 控制
  if (props.color) {
    styleParts.push(`color:${props.color}`);
  }

  // 尺寸：通过 CSS font-size 控制（WeUI icon 是字体图标）
  const size = props.size ?? 24;
  styleParts.push(`font-size:${size}rpx`);

  // CHEVRON_DOWN 旋转为下箭头（与 CHEVRON_RIGHT 共用 `arrow` 图标）
  if (props.name === "CHEVRON_DOWN") {
    styleParts.push("transform:rotate(90deg)");
  }

  // 多色 props 被静默忽略（WeUI 不支持）

  return {
    componentType: "mp-icon",
    props: {
      icon: weuiIcon,
      type: "outline",
    },
    inlineStyle: styleParts.join(";"),
  };
}
