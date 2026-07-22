import {
  attachDrawerNames,
  formatTime,
  groupByDay,
  type DayGroup,
  type DrawHistoryRecord,
} from "../../lib/history";
import { uploadImages } from "../../lib/upload-image";
import { showConfirm } from "../../lib/confirm";
import { LIMITS, QUERY, STRINGS } from "../../config";

interface AppInstance {
  globalData: {
    openid: string;
    groupId: string;
    groups: Array<{ _id: string; name: string; members: string[] }>;
  };
  switchGroup(id: string): void;
  whenReady(): Promise<void>;
}

Page({
  data: {
    memberCount: 0,
    dayGroups: [] as (DayGroup & {
      records: Array<
        DrawHistoryRecord & { time: string; drawerLabel: string }
      >;
    })[],
    loading: true,
    empty: false,
    uploadingRecordId: "",
    /** Swipe-to-delete state */
    swipedRecordId: "",
    _swipeActiveId: "",
    translateXPx: 0,
    deleteBtnPx: 0,
    /** Share image canvas height (dynamic) */
    canvasHeight: 0,
  },

  _db: null as ReturnType<typeof wx.cloud.database> | null,
  _groupId: "",
  _loaded: false,
  /** Swipe gesture tracking */
  _trackingSwipe: false,
  _swipeStartTranslatePx: 0,

  async onShow() {
    const app = getApp<AppInstance>();
    await app.whenReady();
    const groupId = app.globalData.groupId;
    this.setData({
      memberCount: this._getMemberCount(),
    });
    if (this._groupId !== groupId) {
      this._groupId = groupId;
      this._db = wx.cloud.database();
      this._loaded = false;
      this._loadHistory();
    } else if (!this._loaded) {
      this._loadHistory();
    }
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    await app.whenReady();
    this._groupId = app.globalData.groupId;
    this._db = wx.cloud.database();
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      memberCount: this._getMemberCount(),
      deleteBtnPx: Math.round(150 * sysInfo.windowWidth / 750),
    });
    this._loadHistory();
  },

  _getMemberCount(): number {
    const app = getApp<AppInstance>();
    const group = app.globalData.groups.find((g) => g._id === app.globalData.groupId);
    return group ? group.members.length : 0;
  },

  async onRecordUploadImage(e: WechatMiniprogram.TouchEvent) {
    const recordId = (e.currentTarget.dataset as { recordId: string }).recordId;

    try {
      this.setData({ uploadingRecordId: recordId });
      const fileIDs = await uploadImages({ count: 1 });

      if (fileIDs.length === 0) {
        // Image was skipped (e.g., validation failed) — toast already shown by uploadImages
        return;
      }

      const record = this._findRecord(recordId);
      const currentImages = record?.images || [];
      const merged = [fileIDs[0], ...currentImages].slice(0, LIMITS.HISTORY_IMAGE_MAX);
      await this._db!.collection("draw_history")
        .doc(recordId)
        .update({ data: { images: merged } });
      this._updateRecordImages(recordId, merged);
      wx.showToast({ title: "上传成功", icon: "success" });
    } catch (err) {
      // uploadImages already shows toast for errors; for cancel, err contains
      // "chooseImage:fail cancel" — silently ignore
      if (
        !(err as { errMsg?: string }).errMsg?.includes("chooseImage:fail cancel")
      ) {
        console.error("[history] upload image failed", err);
      }
    } finally {
      this.setData({ uploadingRecordId: "" });
    }
  },

  onPreviewRecordImage(e: WechatMiniprogram.TouchEvent) {
    const data = e.currentTarget.dataset as {
      images: string[];
      current: string;
    };
    if (!data.images || data.images.length === 0) return;
    wx.previewImage({
      current: data.current,
      urls: data.images,
    });
  },

  _findRecord(recordId: string): DrawHistoryRecord | null {
    for (const day of this.data.dayGroups) {
      for (const r of day.records) {
        if (r._id === recordId) return r;
      }
    }
    return null;
  },

  _updateRecordImages(recordId: string, images: string[]) {
    const dayGroups = this.data.dayGroups.map(
      (day: typeof this.data.dayGroups[number]) => ({
        ...day,
        records: day.records.map(
          (r: typeof day.records[number]) =>
            (r._id === recordId ? { ...r, images } : r) as typeof r,
        ),
      }),
    ) as typeof this.data.dayGroups;
    this.setData({ dayGroups });
  },

  async _loadHistory() {
    this.setData({ loading: true });
    try {
      const res = await this._db!.collection("draw_history")
        .where({ groupId: this._groupId, status: "active" })
        .orderBy("confirmedAt", "desc")
        .limit(QUERY.LIMIT_HISTORY)
        .get();

      let records = res.data as DrawHistoryRecord[];

      if (records.length === 0) {
        this.setData({ dayGroups: [], loading: false, empty: true });
        return;
      }

      if (this.data.memberCount > 1) {
        const drawerIds = [
          ...new Set(
            records
              .map((r) => r.drawerId)
              .filter((id): id is string => !!id),
          ),
        ];
        if (drawerIds.length > 0) {
          const nameMap: Record<string, string> = {};
          const userRes = await this._db!.collection("users")
            .where({ _openid: this._db!.command.in(drawerIds) })
            .get();
          for (const user of userRes.data as Array<{
            _openid: string;
            nickName: string;
          }>) {
            nameMap[user._openid] = user.nickName;
          }
          records = attachDrawerNames(records, nameMap);
        }
      }

      const dayGroups = groupByDay(records).map((group) => ({
        ...group,
        records: group.records.map((r) => ({
          ...r,
          time: formatTime(r.confirmedAt),
          drawerLabel: r.drawerName ? `${r.drawerName}抽的` : "",
        })),
      }));

      this.setData({ dayGroups, loading: false, empty: false });
      this._loaded = true;
    } catch (err) {
      console.error("[history] load failed", err);
      this.setData({ loading: false, empty: true });
    }
  },

  // ── Feature 1: Left-swipe delete ──────────────────────────

  onSwipeStart(e: WechatMiniprogram.TouchEvent) {
    const recordId = (e.currentTarget.dataset as { recordId: string }).recordId;

    // Determine if this card is already open BEFORE any setData call
    const isThisCardOpen = this.data.swipedRecordId === recordId;

    // If a different card is open, close it first
    if (this.data.swipedRecordId && !isThisCardOpen) {
      this.setData({ swipedRecordId: "" });
    }

    this._swipeStartTranslatePx = isThisCardOpen ? -this.data.deleteBtnPx : 0;
    this._trackingSwipe = false;

    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY,
    });
  },

  onSwipeMove(e: WechatMiniprogram.TouchEvent) {
    const deltaX = e.touches[0].clientX - this.data.touchStartX;
    const deltaY = e.touches[0].clientY - this.data.touchStartY;

    if (!this._trackingSwipe) {
      // Only commit to horizontal swipe if movement is clearly horizontal
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
        this._trackingSwipe = true;
        const recordId = (e.currentTarget.dataset as { recordId: string })
          .recordId;
        this.setData({ _swipeActiveId: recordId });
      } else {
        return;
      }
    }

    const translateX = this._swipeStartTranslatePx + deltaX;
    const clamped = Math.max(-this.data.deleteBtnPx, Math.min(0, translateX));
    this.setData({ translateXPx: clamped });
  },

  onSwipeEnd(e: WechatMiniprogram.TouchEvent) {
    if (!this._trackingSwipe) return;
    this._trackingSwipe = false;

    const threshold = this.data.deleteBtnPx * 0.4;
    const recordId = (e.currentTarget.dataset as { recordId: string }).recordId;

    if (this.data.translateXPx < -threshold) {
      this.setData({
        swipedRecordId: recordId,
        translateXPx: -this.data.deleteBtnPx,
        _swipeActiveId: "",
      });
    } else {
      this.setData({
        swipedRecordId: "",
        translateXPx: 0,
        _swipeActiveId: "",
      });
    }
  },

  async onDeleteRecord(e: WechatMiniprogram.TouchEvent) {
    const recordId = (e.currentTarget.dataset as { recordId: string }).recordId;

    const confirmed = await showConfirm({
      title: "确认删除",
      content: "确认删除该条记录？删除后不可恢复",
    });
    if (!confirmed) return;

    const record = this._findRecord(recordId);
    if (!record) return;

    try {
      await this._db!.collection("draw_history").doc(recordId).remove();

      // Fire-and-forget cloud file deletion
      if (record.images && record.images.length > 0) {
        wx.cloud.deleteFile({ fileList: record.images }).catch((err) => {
          console.error("[history] cloud file delete failed", err);
        });
      }

      // Remove record from local state, and remove empty day groups
      const dayGroups = (this.data.dayGroups as typeof this.data.dayGroups)
        .map((day: typeof this.data.dayGroups[number]) => ({
          ...day,
          records: day.records.filter(
            (r: typeof day.records[number]) => r._id !== recordId,
          ),
        }))
        .filter(
          (day: typeof this.data.dayGroups[number]) =>
            day.records.length > 0,
        );

      this.setData({
        dayGroups,
        swipedRecordId: "",
        _swipeActiveId: "",
        translateXPx: 0,
        empty: dayGroups.length === 0,
      });

      wx.showToast({ title: "删除成功", icon: "success" });
    } catch (err) {
      console.error("[history] delete failed", err);
      this.setData({
        swipedRecordId: "",
        _swipeActiveId: "",
        translateXPx: 0,
      });
      wx.showToast({ title: "删除失败，请重试", icon: "none" });
    }
  },

  // ── Feature 2: Share to chat ───────────────────────────────

  onShareAppMessage(
    e: WechatMiniprogram.Page.IShareAppMessageOption,
  ): WechatMiniprogram.Page.ICustomShareContent {
    const recordId = (e.target?.dataset as { recordId?: string })?.recordId;
    if (!recordId) {
      return { title: STRINGS.BRAND_NAME, path: "/pages/index/index" };
    }

    const record = this._findRecord(recordId);
    const imageUrl =
      record?.results?.[0]?.dishes?.[0]?.imageUrl || "";

    return {
      title: `【${STRINGS.BRAND_NAME}】今天吃了这些`,
      imageUrl,
      path: "/pages/index/index",
    };
  },

  // ── Feature 3: Generate share image ───────────────────────

  async onGenerateShareImage(e: WechatMiniprogram.TouchEvent) {
    const recordId = (e.currentTarget.dataset as { recordId: string }).recordId;
    if (!recordId) return;

    // Find the record and which day group it belongs to (for the date label)
    let dateLabel = "";
    let targetRecord: (typeof this.data.dayGroups[number]["records"][number]) | null = null;

    for (const day of this.data.dayGroups) {
      const found = day.records.find(
        (r: typeof day.records[number]) => r._id === recordId,
      );
      if (found) {
        dateLabel = day.label;
        targetRecord = found;
        break;
      }
    }
    if (!targetRecord) return;

    wx.showLoading({ title: "生成中…", mask: true });

    try {
      const tempFilePath = await this._drawShareImage(dateLabel, targetRecord);
      wx.hideLoading();

      wx.showActionSheet({
        itemList: ["保存到相册", "发送给朋友"],
        success: (res) => {
          if (res.tapIndex === 0) {
            this._saveToAlbum(tempFilePath);
          } else if (res.tapIndex === 1) {
            this._shareToFriend(tempFilePath);
          }
        },
      });
    } catch (err) {
      console.error("[history] generate share image failed", err);
      wx.hideLoading();
      wx.showToast({ title: "生成失败，请重试", icon: "none" });
    }
  },

  _drawShareImage(
    dateLabel: string,
    record: typeof this.data.dayGroups[number]["records"][number],
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery();
      query
        .select("#shareCanvas")
        .fields({ node: true, size: true })
        .exec(async () => {
          try {
            // Re-query to get the canvas node (exec callback is sync-only,
            // so we use a second query inside the async wrapper)
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

            // ── Colors ──
            const C_BG = "#ffffff";
            const C_TEXT = "#1a1a1a";
            const C_SECONDARY = "#888888";
            const C_PRIMARY = "#c8815e";
            const C_PRIMARY_LIGHT = "#faf0e9";
            const C_PLACEHOLDER = "#d9d9d9";
            const CARD_R = 16 * scale;

            // ── Layout (px) ──
            const MARGIN = 32 * scale;
            const CARD_PAD = 20 * scale;
            const BODY_GAP = 16 * scale;
            const IMG_SIZE = 120 * scale;
            const HEAD_MB = 10 * scale;
            const GROUP_MT = 4 * scale;


            // ── Fonts (px) ──
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

            // ── Helpers ──
            const roundRect = (
              x: number, y: number, w: number, h: number, r: number,
            ) => {
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
            };

            const lineH = (fs: number) => fs * LH;
            const measure = (text: string, fs: number, bold = false) => {
              ctx.font = `${bold ? "bold " : ""}${fs}px sans-serif`;
              return ctx.measureText(text).width;
            };

            // ── Load image ──
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

            // ── Height calculation ──
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

            // ── Draw background ──
            ctx.fillStyle = C_BG;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // ── Card background with shadow ──
            let y = MARGIN;
            const cardX = MARGIN;
            const cardTop = y;
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.06)";
            ctx.shadowBlur = 8 * scale;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2 * scale;
            ctx.fillStyle = C_BG;
            roundRect(cardX, cardTop, cardWidth, cardH, CARD_R);
            ctx.fill();
            ctx.restore();

            // ── Card content ──
            y += CARD_PAD;
            const bodyX = cardX + CARD_PAD;
            const bodyTop = y;

            // Left: image or placeholder
            if (hasImage) {
              ctx.save();
              roundRect(bodyX, bodyTop, IMG_SIZE, IMG_SIZE, CARD_R);
              ctx.clip();
              ctx.drawImage(loadedImg, bodyX, bodyTop, IMG_SIZE, IMG_SIZE);
              ctx.restore();
            } else {
              ctx.setLineDash([4 * scale, 4 * scale]);
              ctx.strokeStyle = C_PLACEHOLDER;
              ctx.lineWidth = 2 * scale;
              roundRect(bodyX, bodyTop, IMG_SIZE, IMG_SIZE, CARD_R);
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
                "Flipia时刻",
                cx,
                bodyTop + IMG_SIZE / 2 + 4 * scale,
              );
              ctx.textAlign = "left";
            }

            // Right: info
            const infoX = bodyX + IMG_SIZE + BODY_GAP;
            let iY = bodyTop;

            ctx.fillStyle = C_SECONDARY;
            ctx.font = `${FS_TIME}px sans-serif`;
            ctx.fillText(record.time, infoX, iY);

            if (record.drawerLabel) {
              const tW = measure(record.time, FS_TIME);
              const dW = measure(record.drawerLabel, FS_DRAWER);
              const bX = infoX + tW + 10 * scale;
              const bW = dW + DR_PAD_H * 2;
              const bH = FS_DRAWER * LH + DR_PAD_V * 2;
              ctx.fillStyle = C_PRIMARY_LIGHT;
              roundRect(bX, iY, bW, bH, DR_R);
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
              const catW = measure(catText, FS_CAT, true);
              const remaining = infoWidth - catW;
              if (remaining > 8 * scale && dishText) {
                let drawText = dishText;
                let dw = measure(drawText, FS_DISH);
                while (dw > remaining - 4 * scale && drawText.length > 1) {
                  drawText = drawText.slice(0, -1);
                  dw = measure(drawText + "…", FS_DISH);
                }
                if (dw > remaining) drawText = drawText.slice(0, -1) + "…";
                ctx.font = `${FS_DISH}px sans-serif`;
                ctx.fillText(drawText, infoX + catW, iY);
              }
              iY += lineH(FS_CAT);
            }

            // ── Export ──
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
  },

  _saveToAlbum(tempFilePath: string) {
    wx.saveImageToPhotosAlbum({
      filePath: tempFilePath,
      success: () => {
        wx.showToast({ title: "已保存到相册", icon: "success" });
      },
      fail: (err) => {
        if (
          (err as { errMsg?: string }).errMsg?.includes("auth deny") ||
          (err as { errMsg?: string }).errMsg?.includes("authorize")
        ) {
          wx.showModal({
            title: "提示",
            content: "请在设置中开启相册权限以保存图片",
            confirmText: "去设置",
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting({});
              }
            },
          });
        } else {
          wx.showToast({ title: "保存失败，请重试", icon: "none" });
        }
      },
    });
  },

  _shareToFriend(tempFilePath: string) {
    wx.shareFileMessage({
      filePath: tempFilePath,
      fail: (err) => {
        console.error("[history] share file message failed", err);
        wx.showToast({ title: "分享失败", icon: "none" });
      },
    });
  },
});
