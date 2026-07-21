import {
  attachDrawerNames,
  formatTime,
  groupByDay,
  type DayGroup,
  type DrawHistoryRecord,
} from "../../lib/history";

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
  },

  _db: null as ReturnType<typeof wx.cloud.database> | null,
  _groupId: "",

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
    this.setData({
      groups,
      activeGroupId: app.globalData.groupId,
      openid: app.globalData.openid,
      memberCount: this._getMemberCount(groups, app.globalData.groupId),
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
          const fileIDs = await this._uploadHistoryImages(
            res.tempFilePaths,
          );
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
    const dayGroups = this.data.dayGroups.map((day) => ({
      ...day,
      records: day.records.map(
        (r) => (r._id === recordId ? { ...r, images } : r) as typeof r,
      ),
    })) as typeof this.data.dayGroups;
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
});
