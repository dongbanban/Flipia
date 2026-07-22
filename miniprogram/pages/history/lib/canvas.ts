/**
 * Canvas 绘制辅助函数 —— 从分享图片生成逻辑中提取。
 */

/** 绘制圆角矩形路径（不 fill/stroke，仅定义路径）。 */
export function roundRect(
  ctx: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** 计算给定字体大小的行高。 */
export function lineH(fs: number, lineHeightRatio: number = 1.4): number {
  return fs * lineHeightRatio;
}

/** 测量文本宽度。 */
export function measure(
  ctx: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D,
  text: string,
  fs: number,
  bold: boolean = false,
): number {
  ctx.font = `${bold ? "bold " : ""}${fs}px sans-serif`;
  return ctx.measureText(text).width;
}
