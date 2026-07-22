import {
  validateCategoryName,
  addCategory,
  renameCategory,
  deleteCategory,
} from "@/lib/category-manage";
import {
  syncAllGroupNames,
  syncDrawConfigNames,
} from "@/lib/draw-config-manage";
import type { Category, DrawConfigGroup } from "@/lib/init-data";
import { sanitizeInput } from "@/lib/sanitize";
import { showConfirm } from "@/lib/confirm";
import { LIMITS, QUERY } from "@/config";

interface AppGlobalData {
  groupId: string;
}

Page({
  data: {
    categories: [] as Category[],
    drawConfigGroups: [] as DrawConfigGroup[],
    editingId: "",
    editValue: "",
    editError: "",
    adding: false,
    addValue: "",
    addError: "",
    loading: true,
  },

  _db: null as ReturnType<typeof wx.cloud.database> | null,
  _groupId: "",
  _configId: "",
  _shown: false,

  onLoad() {
    const app = getApp<{ globalData: AppGlobalData }>();
    this._groupId = app.globalData.groupId;
    this._db = wx.cloud.database();
    this._loadConfig();
  },

  onShow() {
    if (!this._shown) {
      this._shown = true;
      return;
    }
    this._loadConfig();
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
      const synced = syncAllGroupNames(
        config.drawConfigGroups,
        config.categories,
      );
      this.setData({
        categories: config.categories,
        drawConfigGroups: synced,
      });
    } catch (err) {
      console.error("[category-manage] load failed", err);
      wx.showToast({ title: "加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  async _saveConfig(
    categories: Category[],
    drawConfigGroups: DrawConfigGroup[],
  ) {
    await this._db!.collection("user_config")
      .doc(this._configId)
      .update({ data: { categories, drawConfigGroups } });
    this.setData({ categories, drawConfigGroups });
  },

  onStartAdd() {
    this.setData({ adding: true, addValue: "", addError: "" });
  },

  onCancelAdd() {
    this.setData({ adding: false, addValue: "", addError: "" });
  },

  onAddInput(e: WechatMiniprogram.Input) {
    const names = (this.data.categories as Category[]).map((c) => c.name);
    const { value, error } = validateCategoryName(e.detail.value, names);
    this.setData({ addValue: value, addError: error ?? "" });
  },

  async onConfirmAdd() {
    const { value, error } = validateCategoryName(
      this.data.addValue,
      (this.data.categories as Category[]).map((c) => c.name),
    );
    if (error) {
      this.setData({ addError: error });
      return;
    }

    const { valid, value: sanitized } = await sanitizeInput({
      value,
      maxLength: LIMITS.CATEGORY_NAME_MAX,
      fieldName: "分类名",
    });
    if (!valid) return;

    const arr = addCategory(this.data.categories as Category[], sanitized);

    wx.showLoading({ title: "保存中…" });
    try {
      await this._saveConfig(
        arr,
        this.data.drawConfigGroups as DrawConfigGroup[],
      );
      this.setData({ adding: false, addValue: "", addError: "" });
    } catch (err) {
      console.error("[category-manage] add failed", err);
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  onStartRename(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    const cat = (this.data.categories as Category[]).find((c) => c.id === id);
    if (!cat) return;
    this.setData({ editingId: id, editValue: cat.name, editError: "" });
  },

  onCancelRename() {
    this.setData({ editingId: "", editValue: "", editError: "" });
  },

  onRenameInput(e: WechatMiniprogram.Input) {
    const names = (this.data.categories as Category[]).map((c) => c.name);
    const current = (this.data.categories as Category[]).find(
      (c) => c.id === this.data.editingId,
    )?.name;
    const { value, error } = validateCategoryName(
      e.detail.value,
      names,
      current,
    );
    this.setData({ editValue: value, editError: error ?? "" });
  },

  async onConfirmRename() {
    const { value, error } = validateCategoryName(
      this.data.editValue,
      (this.data.categories as Category[]).map((c) => c.name),
      (this.data.categories as Category[]).find(
        (c) => c.id === this.data.editingId,
      )?.name,
    );
    if (error) {
      this.setData({ editError: error });
      return;
    }

    const { valid, value: sanitized } = await sanitizeInput({
      value,
      maxLength: LIMITS.CATEGORY_NAME_MAX,
      fieldName: "分类名",
    });
    if (!valid) return;

    const arr = renameCategory(
      this.data.categories as Category[],
      this.data.editingId,
      sanitized,
    );
    const newGroups = (this.data.drawConfigGroups as DrawConfigGroup[]).map(
      (g) => ({
        ...g,
        entries: syncDrawConfigNames(g.entries, arr),
      }),
    );

    wx.showLoading({ title: "保存中…" });
    try {
      await this._saveConfig(arr, newGroups);
      this.setData({ editingId: "", editValue: "", editError: "" });
    } catch (err) {
      console.error("[category-manage] rename failed", err);
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async onDelete(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    const cat = (this.data.categories as Category[]).find((c) => c.id === id);
    if (!cat) return;

    const confirmed = await showConfirm({
      title: "删除分类",
      content: `确认删除「${cat.name}」？该分类下的所有菜品也将被一并删除，且抽取配置中的对应条目将被移除。`,
    });
    if (!confirmed) return;

    wx.showLoading({ title: "删除中…" });
    try {
      const result = deleteCategory(
        this.data.categories as Category[],
        this.data.drawConfigGroups as DrawConfigGroup[],
        id,
      );
      await this._saveConfig(result.categories, result.drawConfigGroups);
      if (this.data.editingId === id) {
        this.setData({ editingId: "", editValue: "", editError: "" });
      }

      // 级联删除该分类下的所有菜品
      const PAGE_SIZE = QUERY.LIMIT_GENERIC_MAX;
      let skip = 0;
      let hasMore = true;
      while (hasMore) {
        const dishRes = await this._db!.collection("dishes")
          .where({ groupId: this._groupId, categoryId: id })
          .field({ _id: true })
          .limit(PAGE_SIZE)
          .skip(skip)
          .get();
        const batch = dishRes.data as Array<{ _id: string }>;
        for (const dish of batch) {
          await this._db!.collection("dishes").doc(dish._id).remove();
        }
        skip += batch.length;
        hasMore = batch.length > 0;
      }
    } catch (err) {
      console.error("[category-manage] delete failed", err);
      wx.showToast({ title: "删除失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },
});
