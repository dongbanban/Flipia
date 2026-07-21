import {
  validateGroupName,
  createDrawConfigGroup,
  deleteDrawConfigGroup,
  syncAllGroupNames,
  updateDrawCount,
  addDrawConfigEntry,
  removeDrawConfigEntry,
  getAvailableCategories,
} from "../../lib/draw-config-manage";
import type { Category, DrawConfigEntry, DrawConfigGroup } from "../../lib/init-data";
import { checkTextWithToast } from "../../lib/content-security";

interface AppGlobalData {
  groupId: string;
}

const STORAGE_ACTIVE_CONFIG_KEY = "flipia_active_config_id";
const STORAGE_LAST_DRAWN_KEY = "flipia_last_drawn_config_id";

Page({
  data: {
    categories: [] as Category[],
    drawConfigGroups: [] as DrawConfigGroup[],
    activeDrawConfigGroupId: "",
    loading: true,
    modalVisible: false,
    modalGroupId: "",
    modalName: "",
    modalNameError: "",
    modalEntries: [] as DrawConfigEntry[],
    modalAvailable: [] as Category[],
    modalIsActive: false,
  },

  _db: null as ReturnType<typeof wx.cloud.database> | null,
  _groupId: "",
  _configId: "",
  _isNewGroup: false,
  _pendingNewGroup: null as DrawConfigGroup | null,
  _saving: false,

  onLoad() {
    const app = getApp<{ globalData: AppGlobalData }>();
    this._groupId = app.globalData.groupId;
    this._db = wx.cloud.database();
    this._loadConfig();
  },

  onShow() {
    if (!this._configId) return;
    this._loadConfig();
  },

  _getActiveId(): string {
    return (wx.getStorageSync(STORAGE_ACTIVE_CONFIG_KEY) as string) || "";
  },

  _setActiveId(id: string) {
    wx.setStorageSync(STORAGE_ACTIVE_CONFIG_KEY, id);
    wx.removeStorageSync(STORAGE_LAST_DRAWN_KEY);
  },

  _clearActiveId() {
    wx.removeStorageSync(STORAGE_ACTIVE_CONFIG_KEY);
  },

  async _loadConfig() {
    try {
      const res = await this._db!.collection("user_config")
        .where({ groupId: this._groupId })
        .limit(1)
        .get();

      if (res.data.length === 0) {
        wx.showToast({ title: "加载失败", icon: "none" });
        return;
      }

      const config = res.data[0] as {
        _id: string;
        categories: Category[];
        drawConfigGroups: DrawConfigGroup[];
      };
      this._configId = config._id;
      const synced = syncAllGroupNames(config.drawConfigGroups, config.categories);

      const storedActiveId = wx.getStorageSync(STORAGE_ACTIVE_CONFIG_KEY) as string;
      const activeId = storedActiveId && synced.some((g) => g.id === storedActiveId)
        ? storedActiveId
        : "";

      this.setData({
        categories: config.categories,
        drawConfigGroups: synced,
        activeDrawConfigGroupId: activeId,
      });
    } catch (err) {
      console.error("[draw-config-manage] load failed", err);
      wx.showToast({ title: "加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  async _saveGroups(groups: DrawConfigGroup[]) {
    if (!this._configId || this._saving) return;
    this._saving = true;
    try {
      await this._db!.collection("user_config")
        .doc(this._configId)
        .update({ data: { drawConfigGroups: groups } });
      this.setData({ drawConfigGroups: groups });
    } catch (err) {
      console.error("[draw-config-manage] save groups failed", err);
      wx.showToast({ title: "保存失败，请重试", icon: "none" });
    } finally {
      this._saving = false;
    }
  },

  onTapGroup(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    const groups = this.data.drawConfigGroups as DrawConfigGroup[];
    const g = groups.find((grp) => grp.id === id);
    if (!g) return;

    const categories = this.data.categories as Category[];
    const synced = syncAllGroupNames([g], categories)[0];
    const available = getAvailableCategories(synced.entries, categories);

    this.setData({
      modalVisible: true,
      modalTitle: "编辑方案",
      modalGroupId: id,
      modalName: synced.name,
      modalNameError: "",
      modalEntries: synced.entries,
      modalAvailable: available,
      modalIsActive: id === this.data.activeDrawConfigGroupId,
    });
  },

  onCloseModal() {
    this._isNewGroup = false;
    this._pendingNewGroup = null;
    this.setData({ modalVisible: false });
  },

  async onConfirmModal() {
    const { value, error } = validateGroupName(
      this.data.modalName,
      (this.data.drawConfigGroups as DrawConfigGroup[]).map((g) => g.name),
      (this.data.drawConfigGroups as DrawConfigGroup[]).find(
        (g) => g.id === this.data.modalGroupId,
      )?.name,
    );
    if (error) {
      this.setData({ modalNameError: error });
      return;
    }

    if (!(await checkTextWithToast(value))) return;

    const entries = [...this.data.modalEntries] as DrawConfigEntry[];

    wx.showLoading({ title: "保存中…", mask: true });
    try {
      let groups: DrawConfigGroup[];
      if (this._isNewGroup && this._pendingNewGroup) {
        groups = [
          ...(this.data.drawConfigGroups as DrawConfigGroup[]),
          { ...this._pendingNewGroup, name: value, entries },
        ];
      } else {
        groups = (this.data.drawConfigGroups as DrawConfigGroup[]).map((g) => {
          if (g.id !== this.data.modalGroupId) return g;
          return { ...g, name: value, entries };
        });
      }

      if (!this._configId) {
        wx.showToast({ title: "数据未加载", icon: "none" });
        return;
      }

      if (this.data.modalIsActive) {
        this._setActiveId(this.data.modalGroupId);
      }

      await this._saveGroups(groups);
      this._isNewGroup = false;
      this._pendingNewGroup = null;

      this.setData({
        activeDrawConfigGroupId: this._getActiveId(),
        modalVisible: false,
      });
    } catch (err) {
      console.error("[draw-config-manage] save failed", err);
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  noop() {},

  onModalNameInput(e: WechatMiniprogram.Input) {
    const names = (this.data.drawConfigGroups as DrawConfigGroup[]).map((g) => g.name);
    const current = (this.data.drawConfigGroups as DrawConfigGroup[]).find(
      (g) => g.id === this.data.modalGroupId,
    )?.name;
    const { value, error } = validateGroupName(e.detail.value, names, current);
    this.setData({ modalName: value, modalNameError: error ?? "" });
  },

  onModalDecrement(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    const entry = (this.data.modalEntries as DrawConfigEntry[]).find((d) => d.categoryId === id);
    if (!entry || entry.count <= 1) return;
    const updated = updateDrawCount(this.data.modalEntries as DrawConfigEntry[], id, entry.count - 1);
    this.setData({ modalEntries: updated });
    this._refreshModalAvailable(updated);
  },

  onModalIncrement(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    const entry = (this.data.modalEntries as DrawConfigEntry[]).find((d) => d.categoryId === id);
    if (!entry || entry.count >= 5) return;
    const updated = updateDrawCount(this.data.modalEntries as DrawConfigEntry[], id, entry.count + 1);
    this.setData({ modalEntries: updated });
    this._refreshModalAvailable(updated);
  },

  onModalRemove(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    const entries = this.data.modalEntries as DrawConfigEntry[];
    if (entries.length <= 1) return;
    const updated = removeDrawConfigEntry(entries, id);
    if (updated === entries) return;
    this.setData({ modalEntries: updated });
    this._refreshModalAvailable(updated);
  },

  onModalAdd() {
    const available = this.data.modalAvailable as Category[];
    if (available.length === 0) {
      wx.showToast({ title: "所有分类已添加", icon: "none" });
      return;
    }
    wx.showActionSheet({
      itemList: available.map((c) => c.name),
      success: (res) => {
        const cat = available[res.tapIndex];
        if (!cat) return;
        const entries = this.data.modalEntries as DrawConfigEntry[];
        const updated = addDrawConfigEntry(entries, this.data.categories as Category[], cat.id);
        if (updated === entries) return;
        this.setData({ modalEntries: updated });
        this._refreshModalAvailable(updated);
      },
    });
  },

  _refreshModalAvailable(entries: DrawConfigEntry[]) {
    const available = getAvailableCategories(entries, this.data.categories as Category[]);
    this.setData({ modalAvailable: available });
  },

  onSetActive(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    if (!id || id === this.data.activeDrawConfigGroupId) return;
    this._setActiveId(id);
    this.setData({ activeDrawConfigGroupId: id });
  },

  onUnsetActive() {
    this._clearActiveId();
    this.setData({ activeDrawConfigGroupId: "" });
  },

  onModalSetActive() {
    this.setData({ modalIsActive: true });
  },

  onModalUnsetActive() {
    this.setData({ modalIsActive: false });
  },

  onStartAdd() {
    if ((this.data.drawConfigGroups as DrawConfigGroup[]).length >= 10) return;
    const categories = this.data.categories as Category[];
    if (categories.length === 0) return;

    const groups = createDrawConfigGroup(
      this.data.drawConfigGroups as DrawConfigGroup[],
      categories,
    );
    if (groups === this.data.drawConfigGroups) return;

    this._pendingNewGroup = groups[groups.length - 1];
    this._isNewGroup = true;

    this.setData({
      modalVisible: true,
      modalTitle: "新建方案",
      modalGroupId: this._pendingNewGroup.id,
      modalName: "",
      modalNameError: "",
      modalEntries: this._pendingNewGroup.entries,
      modalAvailable: getAvailableCategories(this._pendingNewGroup.entries, categories as Category[]),
      modalIsActive: false,
    });
  },

  onDelete(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    const g = (this.data.drawConfigGroups as DrawConfigGroup[]).find(
      (grp) => grp.id === id,
    );
    if (!g) return;
    if (this.data.drawConfigGroups.length <= 1) return;

    wx.showModal({
      title: "删除方案",
      content: `确认删除「${g.name}」？`,
      confirmColor: "#c8815e",
      success: async (res) => {
        if (!res.confirm) return;

        try {
          const groups = deleteDrawConfigGroup(
            this.data.drawConfigGroups as DrawConfigGroup[],
            id,
          );
          if (groups === this.data.drawConfigGroups) return;

          if (this.data.activeDrawConfigGroupId === id) {
            this._setActiveId(groups[0].id);
          }

          await this._saveGroups(groups);

          if (this.data.activeDrawConfigGroupId === id) {
            this.setData({ activeDrawConfigGroupId: groups[0].id });
          }
        } catch (err) {
          console.error("[draw-config-manage] delete failed", err);
          wx.showToast({ title: "删除失败", icon: "none" });
        }
      },
    });
  },
});
