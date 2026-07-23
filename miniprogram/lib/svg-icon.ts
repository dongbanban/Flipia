// 图标工具 — 将 SVG 字符串转为小程序可用的 base64 Data URI
import { Base64 } from 'js-base64';

/**
 * 将 SVG 字符串转为 `<image>` 标签可用的 base64 Data URI。
 * 支持可选颜色替换，将 SVG 中的 fill 属性替换为目标色。
 *
 * @param svg 原始 SVG 字符串
 * @param color 可选的目标填充色（如 "#c8815e"），不传则保留原色
 * @returns data:image/svg+xml;base64,... 格式的 Data URI
 */
export function svgToImageSrc(svg: string, color?: string): string {
  let processed = svg;
  if (color) {
    processed = svg.replace(/fill="[^"]*"/g, `fill="${color}"`);
  }
  return `data:image/svg+xml;base64,${Base64.encode(processed)}`;
}
