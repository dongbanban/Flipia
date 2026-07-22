/**
 * Canvas 绘制辅助函数 —— 从分享图片生成逻辑中提取。
 */

import type { EnrichedRecord } from "./helpers";
import { STRINGS } from "@/config";

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

/**
 * 在离屏 canvas 上绘制分享图片并返回临时文件路径。
 * @param record - 要绘制的历史记录（含 enriched 字段）
 * @param dateLabel - 日期标签（如"今天"、"昨天"、"7月15日"）
 * @returns canvas 临时文件路径
 */
export async function drawShareImage(
  record: EnrichedRecord,
  dateLabel: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const query = wx.createSelectorQuery();
    query
      .select("#shareCanvas")
      .fields({ node: true, size: true })
      .exec(async () => {
        try {
          // 重新查询以获取 canvas 节点（exec 回调只能同步，
          // 因此在 async 包装中使用第二次查询）
          const query2 = wx.createSelectorQuery();
          const nodeRes = await new Promise<any>((res) => {
            query2
              .select("#shareCanvas")
              .fields({ node: true, size: true })
              .exec((r) => res(r));
          });

          if (!nodeRes || !nodeRes[0] || !nodeRes[0].node) {
            reject(new Error("Canvas node not found"));
            return;
          }

          const canvas = nodeRes[0].node as WechatMiniprogram.Canvas;
          const ctx = canvas.getContext("2d") as any;
          const dpr = wx.getSystemInfoSync().pixelRatio;
          const sysInfo = wx.getSystemInfoSync();
          const scale = sysInfo.windowWidth / 750;

          // ── 颜色 ──
          const C_BG = "#ffffff";
          const C_TEXT = "#1a1a1a";
          const C_SECONDARY = "#888888";
          const C_PRIMARY = "#c8815e";
          const C_PRIMARY_LIGHT = "#faf0e9";
          const C_PLACEHOLDER = "#d9d9d9";
          const CARD_R = 16 * scale;

          // ── 布局 (px) ──
          const MARGIN = 32 * scale;
          const CARD_PAD = 20 * scale;
          const BODY_GAP = 16 * scale;
          const IMG_SIZE = 120 * scale;
          const HEAD_MB = 10 * scale;
          const GROUP_MT = 4 * scale;


          // ── 字体 (px) ──
          const FS_TIME = 24 * scale;
          const FS_DRAWER = 20 * scale;
          const FS_CAT = 28 * scale;
          const FS_DISH = 28 * scale;
          const FS_PLUS = 36 * scale;
          const FS_PLACEHOLDER = 18 * scale;
          const LH = 1.4;
          const DR_PAD_V = 2 * scale;
          const DR_PAD_H = 12 * scale;
          const DR_R = 24 * scale;

          const canvasWidth = sysInfo.windowWidth;
          const cardWidth = canvasWidth - 2 * MARGIN;
          const bodyWidth = cardWidth - 2 * CARD_PAD;
          const infoWidth = bodyWidth - IMG_SIZE - BODY_GAP;

          // ── 加载图片 ──
          let loadedImg: any = null;
          if (record.images && record.images.length > 0) {
            try {
              const urlRes = await wx.cloud.getTempFileURL({
                fileList: [record.images[0]],
              });
              const tempUrl = urlRes.fileList[0]?.tempFileURL;
              if (tempUrl) {
                loadedImg = canvas.createImage();
                loadedImg.src = tempUrl;
                await new Promise<void>((res, rej) => {
                  loadedImg.onload = () => res();
                  loadedImg.onerror = () => rej(new Error("img fail"));
                });
              }
            } catch {
              loadedImg = null;
            }
          }
          const hasImage = loadedImg !== null;

          // ── 高度计算 ──
          let infoH = lineH(FS_TIME);
          infoH += HEAD_MB;
          for (const group of record.results) {
            infoH += GROUP_MT;
            infoH += lineH(FS_CAT);
          }
          const bodyH = Math.max(IMG_SIZE, infoH);
          const cardH = CARD_PAD + bodyH + CARD_PAD;
          const canvasHeight = Math.ceil(MARGIN + cardH + MARGIN);

          canvas.width = canvasWidth * dpr;
          canvas.height = canvasHeight * dpr;
          ctx.scale(dpr, dpr);
          ctx.textBaseline = "top";

          // ── 绘制背景 ──
          ctx.fillStyle = C_BG;
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);

          // ── 带阴影的卡片背景 ──
          let y = MARGIN;
          const cardX = MARGIN;
          const cardTop = y;
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.06)";
          ctx.shadowBlur = 8 * scale;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 2 * scale;
          ctx.fillStyle = C_BG;
          roundRect(ctx, cardX, cardTop, cardWidth, cardH, CARD_R);
          ctx.fill();
          ctx.restore();

          // ── 卡片内容 ──
          y += CARD_PAD;
          const bodyX = cardX + CARD_PAD;
          const bodyTop = y;

          // 左：图片或占位符
          if (hasImage) {
            ctx.save();
            roundRect(ctx, bodyX, bodyTop, IMG_SIZE, IMG_SIZE, CARD_R);
            ctx.clip();
            ctx.drawImage(loadedImg, bodyX, bodyTop, IMG_SIZE, IMG_SIZE);
            ctx.restore();
          } else {
            ctx.setLineDash([4 * scale, 4 * scale]);
            ctx.strokeStyle = C_PLACEHOLDER;
            ctx.lineWidth = 2 * scale;
            roundRect(ctx, bodyX, bodyTop, IMG_SIZE, IMG_SIZE, CARD_R);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.textAlign = "center";
            const cx = bodyX + IMG_SIZE / 2;
            ctx.fillStyle = C_PLACEHOLDER;
            ctx.font = `${FS_PLUS}px sans-serif`;
            ctx.fillText(
              "+",
              cx,
              bodyTop + IMG_SIZE / 2 - FS_PLUS / 2 - 4 * scale,
            );
            ctx.fillStyle = C_PRIMARY;
            ctx.font = `${FS_PLACEHOLDER}px sans-serif`;
            ctx.fillText(
              STRINGS.BRAND_NAME + "时刻",
              cx,
              bodyTop + IMG_SIZE / 2 + 4 * scale,
            );
            ctx.textAlign = "left";
          }

          // 右：信息区
          const infoX = bodyX + IMG_SIZE + BODY_GAP;
          let iY = bodyTop;

          ctx.fillStyle = C_SECONDARY;
          ctx.font = `${FS_TIME}px sans-serif`;
          ctx.fillText(record.time, infoX, iY);

          if (record.drawerLabel) {
            const tW = measure(ctx, record.time, FS_TIME);
            const dW = measure(ctx, record.drawerLabel, FS_DRAWER);
            const bX = infoX + tW + 10 * scale;
            const bW = dW + DR_PAD_H * 2;
            const bH = FS_DRAWER * LH + DR_PAD_V * 2;
            ctx.fillStyle = C_PRIMARY_LIGHT;
            roundRect(ctx, bX, iY, bW, bH, DR_R);
            ctx.fill();
            ctx.fillStyle = C_PRIMARY;
            ctx.font = `${FS_DRAWER}px sans-serif`;
            ctx.fillText(record.drawerLabel, bX + DR_PAD_H, iY + DR_PAD_V);
          }

          iY += lineH(FS_TIME) + HEAD_MB;

          ctx.fillStyle = C_TEXT;
          for (const group of record.results) {
            iY += GROUP_MT;
            const catText = `${group.categoryName}：`;
            const dishText = group.dishes.map((d: typeof group.dishes[number]) => d.dishName).join(" ");
            ctx.font = `bold ${FS_CAT}px sans-serif`;
            ctx.fillText(catText, infoX, iY);
            const catW = measure(ctx, catText, FS_CAT, true);
            const remaining = infoWidth - catW;
            if (remaining > 8 * scale && dishText) {
              let drawText = dishText;
              let dw = measure(ctx, drawText, FS_DISH);
              while (dw > remaining - 4 * scale && drawText.length > 1) {
                drawText = drawText.slice(0, -1);
                dw = measure(ctx, drawText + "…", FS_DISH);
              }
              if (dw > remaining) drawText = drawText.slice(0, -1) + "…";
              ctx.font = `${FS_DISH}px sans-serif`;
              ctx.fillText(drawText, infoX + catW, iY);
            }
            iY += lineH(FS_CAT);
          }

          // ── 导出 ──
          wx.canvasToTempFilePath({
            canvas,
            x: 0,
            y: 0,
            width: canvasWidth,
            height: canvasHeight,
            destWidth: canvasWidth * dpr,
            destHeight: canvasHeight * dpr,
            success: (fileRes) => {
              resolve(fileRes.tempFilePath);
            },
            fail: (err) => {
              reject(err);
            },
          });
        } catch (err) {
          reject(err);
        }
      });
  });
}
