import {
  attachDrawerNames,
  formatTime,
  groupByDay,
  type DayGroup,
  type DrawHistoryRecord,
} from "../../lib/history";
import { checkImage } from "../../lib/content-security";

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
    openid: "",
    groups: [] as Array<{ _id: string; name: string; members: string[] }>,
    activeGroupId: "",
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
  /** Swipe gesture tracking */
  _trackingSwipe: false,
  _swipeStartTranslatePx: 0,

  async onShow() {
    const app = getApp<AppInstance>();
    await app.whenReady();
    const groupId = app.globalData.groupId;
    const memberCount = this._getMemberCount(
      app.globalData.groups,
      groupId,
    );
    this.setData({
      openid: app.globalData.openid,
      groups: app.globalData.groups,
      activeGroupId: groupId,
      memberCount,
    });
    if (this._groupId !== groupId) {
      this._groupId = groupId;
      this._db = wx.cloud.database();
      this._loadHistory();
    } else {
      this._loadHistory();
    }
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    await app.whenReady();
    this._groupId = app.globalData.groupId;
    this._db = wx.cloud.database();
    const groups = app.globalData.groups as Array<{
      _id: string;
      name: string;
      members: string[];
    }>;
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      groups,
      activeGroupId: app.globalData.groupId,
      openid: app.globalData.openid,
      memberCount: this._getMemberCount(groups, app.globalData.groupId),
      deleteBtnPx: Math.round(150 * sysInfo.windowWidth / 750),
    });
    this._loadHistory();
  },

  onGroupChange(e: WechatMiniprogram.CustomEvent<{ groupId: string }>) {
    const app = getApp<AppInstance>();
    app.switchGroup(e.detail.groupId);
    const memberCount = this._getMemberCount(
      app.globalData.groups,
      e.detail.groupId,
    );
    this.setData({
      activeGroupId: e.detail.groupId,
      memberCount,
      dayGroups: [],
      loading: true,
      empty: false,
    });
    this._groupId = e.detail.groupId;
    this._loadHistory();
  },

  onGroupCreate() {
    wx.navigateTo({ url: "/pages/group-create/index" });
  },

  _getMemberCount(
    groups: Array<{ _id: string; name: string; members: string[] }>,
    groupId: string,
  ): number {
    const group = groups.find((g) => g._id === groupId);
    return group ? group.members.length : 0;
  },

  onRecordChooseImage(e: WechatMiniprogram.TouchEvent) {
    const recordId = (e.currentTarget.dataset as { recordId: string }).recordId;
    const record = this._findRecord(recordId);
    if (!record) return;
    const currentImages = record.images || [];
    const remaining = 3 - currentImages.length;
    if (remaining <= 0) return;

    wx.chooseImage({
      count: remaining,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: async (res) => {
        this.setData({ uploadingRecordId: recordId });
        wx.showLoading({ title: "上传中…", mask: true });
        try {
          // Content security: check each image before upload
          const safePaths: string[] = [];
          for (const path of res.tempFilePaths) {
            const result = await checkImage(path);
            if (result.pass) {
              safePaths.push(path);
            } else {
              wx.showToast({ title: "图片不合规，请更换", icon: "none" });
            }
          }
          if (safePaths.length === 0) {
            wx.hideLoading();
            return;
          }
          const fileIDs = await this._uploadHistoryImages(safePaths);
          const merged = [...currentImages, ...fileIDs].slice(0, 3);
          await this._db!.collection("draw_history")
            .doc(recordId)
            .update({ data: { images: merged } });
          this._updateRecordImages(recordId, merged);
          wx.hideLoading();
          wx.showToast({ title: "上传成功", icon: "success" });
        } catch (err) {
          console.error("[history] upload images failed", err);
          wx.hideLoading();
          wx.showToast({ title: "上传失败，请重试", icon: "none" });
        } finally {
          this.setData({ uploadingRecordId: "" });
        }
      },
      fail: () => {
        // user cancelled, do nothing
      },
    });
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

  async _uploadHistoryImages(tempPaths: string[]): Promise<string[]> {
    const results = await Promise.all(
      tempPaths.map((path) => {
        const ext = path.split(".").pop() ?? "jpg";
        return wx.cloud.uploadFile({
          cloudPath: `history/${this._groupId}/${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}.${ext}`,
          filePath: path,
        });
      }),
    );
    return results.map((r) => r.fileID);
  },

  async _loadHistory() {
    this.setData({ loading: true });
    try {
      const res = await this._db!.collection("draw_history")
        .where({ groupId: this._groupId, status: "active" })
        .orderBy("confirmedAt", "desc")
        .limit(50)
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

    const { confirm } = await new Promise<{ confirm: boolean }>((resolve) => {
      wx.showModal({
        title: "确认删除",
        content: "确认删除该条记录？删除后不可恢复",
        success: resolve,
      });
    });
    if (!confirm) return;

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
      return { title: "Flipia", path: "/pages/index/index" };
    }

    const record = this._findRecord(recordId);
    const imageUrl =
      record?.results?.[0]?.dishes?.[0]?.imageUrl || "";

    return {
      title: "【Flipia】今天吃了这些",
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
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            reject(new Error("Canvas node not found"));
            return;
          }

          const canvas = res[0].node as WechatMiniprogram.Canvas;
          const ctx = canvas.getContext("2d") as any;
          const dpr = wx.getSystemInfoSync().pixelRatio;
          const sysInfo = wx.getSystemInfoSync();
          const scale = sysInfo.windowWidth / 750; // px per rpx

          // Layout constants (in rpx, converted to px)
          const padding = 48 * scale;
          const titleSize = 36 * scale;
          const timeSize = 24 * scale;
          const catSize = 30 * scale;
          const dishSize = 26 * scale;
          const indent = 24 * scale;
          const lineHeightFactor = 1.6;
          const sectionGap = 16 * scale;

          // Calculate total height for a single record
          let y = padding;

          // Title (date label)
          y += titleSize * lineHeightFactor;
          y += sectionGap;

          // Time
          y += timeSize * lineHeightFactor;
          y += 8 * scale;

          // Result groups
          for (const group of record.results) {
            y += catSize * lineHeightFactor;
            for (const _dish of group.dishes) {
              y += dishSize * lineHeightFactor;
            }
          }

          y += padding; // bottom padding

          const canvasWidth = sysInfo.windowWidth;
          const canvasHeight = Math.ceil(y);

          canvas.width = canvasWidth * dpr;
          canvas.height = canvasHeight * dpr;
          ctx.scale(dpr, dpr);

          // Draw white background
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);

          // Draw content
          ctx.textBaseline = "top";
          y = padding;

          // Title: date label
          ctx.fillStyle = "#333333";
          ctx.font = `bold ${titleSize}px sans-serif`;
          ctx.fillText(dateLabel, padding, y);
          y += titleSize * lineHeightFactor + sectionGap;

          // Time
          ctx.fillStyle = "#999999";
          ctx.font = `${timeSize}px sans-serif`;
          ctx.fillText(record.time, padding, y);
          y += timeSize * lineHeightFactor + 8 * scale;

          // Result groups
          ctx.fillStyle = "#333333";
          for (const group of record.results) {
            // Category name
            ctx.font = `bold ${catSize}px sans-serif`;
            ctx.fillText(group.categoryName, padding, y);
            y += catSize * lineHeightFactor;

            // Dish names
            ctx.font = `${dishSize}px sans-serif`;
            for (const dish of group.dishes) {
              ctx.fillText(dish.dishName, padding + indent, y);
              y += dishSize * lineHeightFactor;
            }
          }

          // Convert to temp file
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
