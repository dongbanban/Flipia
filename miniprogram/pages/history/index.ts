import {
  attachDrawerNames,
  groupByDay,
  type DayGroup,
  type DrawHistoryRecord,
} from "@/lib/history";
import { getMemberCount } from "@/lib/group-utils";
import { uploadImages } from "@/lib/upload-image";
import { showConfirm } from "@/lib/confirm";
import { LIMITS, QUERY, STRINGS } from "@/config";
import { buildRecordDisplayFields, type EnrichedRecord } from "@/pages/history/lib/helpers";
import { drawShareImage } from "@/pages/history/lib/canvas";
import { svgToImageSrc } from "@/lib/svg-icon";
import { iconShare } from "@/assets/icons/index";

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
      records: EnrichedRecord[];
    })[],
    loading: true,
    empty: false,
    uploadingRecordId: "",
    /** 滑动删除状态 */
    swipedRecordId: "",
    _swipeActiveId: "",
    translateXPx: 0,
    deleteBtnPx: 0,
    /** 分享图片 canvas 高度（动态） */
    canvasHeight: 0,
    /** Icon Data URIs（图标系统 — 预计算 base64） */
    shareIconSrc: svgToImageSrc(iconShare, "#888888"),
    /** 分享图片占位品牌文案 */
    brandText: STRINGS.BRAND_NAME + "时刻",
  },

  _db: null as ReturnType<typeof wx.cloud.database> | null,
  _groupId: "",
  _loaded: false,
  /** 滑动手势追踪 */
  _trackingSwipe: false,
  _swipeStartTranslatePx: 0,

  async onShow() {
    const app = getApp<AppInstance>();
    await app.whenReady();
    const groupId = app.globalData.groupId;
    this.setData({
      memberCount: getMemberCount(app.globalData.groups, app.globalData.groupId),
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
    const windowInfo = wx.getWindowInfo();
    this.setData({
      memberCount: getMemberCount(app.globalData.groups, app.globalData.groupId),
      deleteBtnPx: Math.round(150 * windowInfo.windowWidth / 750),
    });
    this._loadHistory();
  },

  async onRecordUploadImage(e: WechatMiniprogram.TouchEvent) {
    const recordId = (e.currentTarget.dataset as { recordId: string }).recordId;

    try {
      this.setData({ uploadingRecordId: recordId });
      const fileIDs = await uploadImages({ count: 1 });

      if (fileIDs.length === 0) {
        // 图片被跳过（如校验失败）— toast 已由 uploadImages 显示
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
      // uploadImages 已显示错误 toast；取消操作时 err 包含
      // "chooseImage:fail cancel" — 静默忽略
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
        records: buildRecordDisplayFields(group.records),
      }));

      this.setData({ dayGroups, loading: false, empty: false });
      this._loaded = true;
    } catch (err) {
      console.error("[history] load failed", err);
      this.setData({ loading: false, empty: true });
    }
  },

  // ── 功能 1：左滑删除 ──────────────────────────

  onSwipeStart(e: WechatMiniprogram.TouchEvent) {
    const recordId = (e.currentTarget.dataset as { recordId: string }).recordId;

    // 在调用 setData 前判断当前卡片是否已展开
    const isThisCardOpen = this.data.swipedRecordId === recordId;

    // 如果有其他卡片已打开，先将其关闭
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
      // 仅在水平移动明显时确认为横滑
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

      // Fire-and-forget 删除云文件
      if (record.images && record.images.length > 0) {
        wx.cloud.deleteFile({ fileList: record.images }).catch((err) => {
          console.error("[history] cloud file delete failed", err);
        });
      }

      // 从本地状态移除记录，并移除空日期分组
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

  // ── 功能 2：分享至聊天 ───────────────────────────────

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

  // ── 功能 3：生成分享图片 ───────────────────────

  async onGenerateShareImage(e: WechatMiniprogram.TouchEvent) {
    const recordId = (e.currentTarget.dataset as { recordId: string }).recordId;
    if (!recordId) return;

    // 查找记录及其所属日期分组（用于获取日期标签）
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

    wx.showLoading({ title: "生成中…" });

    try {
      const tempFilePath = await this._drawShareImage(dateLabel, targetRecord);
      wx.hideLoading();

      this._onShareImage(tempFilePath);
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
    return drawShareImage(record as EnrichedRecord, dateLabel);
  },

  _onShareImage(tempFilePath: string) {
    wx.showShareImageMenu({
      path: tempFilePath,
      fail: (err) => {
        const msg = (err as { errMsg?: string }).errMsg || "";
        if (!msg.includes("cancel")) {
          console.error("[history] show share image menu failed", err);
          wx.showToast({ title: "分享失败", icon: "none" });
        }
      },
    });
  },
});
