// 图标工具 — 将 SVG 字符串转为小程序可用的 base64 Data URI
// 内置 base64 编码（纯 JS，无外部依赖），避免小程序 npm 构建问题

/** ASCII 安全的 base64 编码（SVG 仅含 ASCII 字符，无需 UTF-8 处理） */
function base64Encode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const len = str.length;
  let result = '';
  let i = 0;
  while (i < len) {
    const a = str.charCodeAt(i++) || 0;
    const b = i < len ? str.charCodeAt(i++) : NaN;
    const c = i < len ? str.charCodeAt(i++) : NaN;
    result += chars[a >> 2];
    result += chars[((a & 0x3) << 4) | (isNaN(b) ? 0 : (b >> 4))];
    result += isNaN(b) ? '=' : chars[((b & 0xf) << 2) | (isNaN(c) ? 0 : (c >> 6))];
    result += isNaN(c) ? '=' : chars[c & 0x3f];
  }
  return result;
}

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
  return `data:image/svg+xml;base64,${base64Encode(processed)}`;
}
