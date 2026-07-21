import {
  attachCreatorNames,
  buildImportDishData,
  sortDishes,
  validateDishName,
} from "../../lib/dish-pool";
import type { DishRecord } from "../../lib/dish-pool";
import type { Category } from "../../lib/init-data";

interface AppInstance {
  globalData: {
    groupId: string;
    openid: string;
    groups: Array<{ _id: string; name: string; members: string[] }>;
  };
  switchGroup(id: string): void;
  whenReady(): Promise<void>;
}

interface FormData {
  _id: string;
  name: string;
  categoryId: string;
  images: string[];
  enabled: boolean;
}

const EMPTY_FORM: FormData = {
  _id: "",
  name: "",
  categoryId: "",
  images: [],
  enabled: true,
};

Page({
  data: {
    openid: "",
    groups: [] as Array<{ _id: string; name: string; members: string[] }>,
    activeGroupId: "",
    memberCount: 0,
    categories: [] as Category[],
    activeTab: 0,
    dishes: [] as DishRecord[],
    loading: false,
    formVisible: false,
    formMode: "add" as "add" | "edit",
    formData: { ...EMPTY_FORM } as FormData,
    formCategoryIdx: 0,
    formNameError: "",
    formUploading: false,
    formDirty: false,

    importVisible: false,
    importStep: "selectGroup" as "selectGroup" | "selectCategories",
    importSourceGroups: [] as Array<{ _id: string; name: string }>,
    importSourceGroupIdx: 0,
    importSourceCategories: [] as Array<
      Category & { checked: boolean; dishCount: number }
    >,
    importLoadingCategories: false,
    importing: false,
  },

  _db: null as ReturnType<typeof wx.cloud.database> | null,
  _groupId: "",
  _openid: "",
  _shown: false,
  _originalImages: [] as string[],
  _uploadedFileIDs: [] as string[],

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
    });
    this._groupId = e.detail.groupId;
    this.setData({
      loading: false,
      formVisible: false,
      dishes: [],
      activeTab: 0,
    });
    this._init();
  },

  onGroupCreate() {
    wx.navigateTo({ url: "/pages/group-create/index" });
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    await app.whenReady();
    this._groupId = app.globalData.groupId;
    this._openid = app.globalData.openid;
    this._db = wx.cloud.database();
    const memberCount = this._getMemberCount(
      app.globalData.groups,
      app.globalData.groupId,
    );
    this.setData({
      openid: app.globalData.openid,
      groups: app.globalData.groups,
      activeGroupId: app.globalData.groupId,
      memberCount,
    });
    this._init();
  },

  async onShow() {
    const app = getApp<AppInstance>();
    await app.whenReady();
    const memberCount = this._getMemberCount(
      app.globalData.groups,
      app.globalData.groupId,
    );
    this.setData({
      groups: app.globalData.groups,
      activeGroupId: app.globalData.groupId,
      memberCount,
    });
    if (!this._shown) {
      this._shown = true;
      return;
    }
    if (this._groupId !== app.globalData.groupId) {
      this._groupId = app.globalData.groupId;
      this.setData({
        loading: false,
        formVisible: false,
        dishes: [],
        activeTab: 0,
      });
      this._init();
      return;
    }
    this._refreshCategories();
  },

  async _init() {
    this.setData({ loading: true });
    try {
      const configRes = await this._db!.collection("user_config")
        .where({ groupId: this._groupId })
        .limit(1)
        .get();

      if (configRes.data.length === 0) {
        this.setData({ loading: false });
        return;
      }

      const categories: Category[] = (
        configRes.data[0] as { categories: Category[] }
      ).categories;

      this.setData({ categories, activeTab: 0 });

      if (categories.length > 0) {
        await this._loadDishes(categories[0].id);
      } else {
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error("[dish-pool] init failed", err);
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败，请重试", icon: "none" });
    }
  },

  async onTabChange(e: WechatMiniprogram.TouchEvent) {
    const idx = Number((e.currentTarget.dataset as { idx: number }).idx);
    const categories = this.data.categories as Category[];
    this.setData({ activeTab: idx });
    await this._loadDishes(categories[idx].id);
  },

  async _loadDishes(categoryId: string) {
    this.setData({ loading: true });
    try {
      const res = await this._db!.collection("dishes")
        .where({ groupId: this._groupId, categoryId })
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      const dishes = res.data as DishRecord[];
      const sorted = sortDishes(dishes);

      const creatorIds = [
        ...new Set(
          sorted
            .map((d) => d.creatorId)
            .filter(
              (id): id is string =>
                !!id && !sorted.find((d) => d.creatorId === id)?.creatorName,
            ),
        ),
      ];

      const nameMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const userRes = await this._db!.collection("users")
          .where({ _openid: this._db!.command.in(creatorIds) })
          .get();
        for (const user of userRes.data as Array<{
          _openid: string;
          nickName: string;
        }>) {
          nameMap[user._openid] = user.nickName;
        }
      }

      const processed = attachCreatorNames(sorted, nameMap);
      this.setData({ dishes: processed });
    } finally {
      this.setData({ loading: false });
    }
  },

  async _refreshCategories() {
    try {
      const configRes = await this._db!.collection("user_config")
        .where({ groupId: this._groupId })
        .limit(1)
        .get();

      if (configRes.data.length === 0) return;

      const categories: Category[] = (
        configRes.data[0] as { categories: Category[] }
      ).categories;

      let activeTab = this.data.activeTab;
      if (activeTab >= categories.length) {
        activeTab = Math.max(0, categories.length - 1);
      }

      this.setData({ categories, activeTab });

      if (categories.length > 0) {
        await this._loadDishes(categories[activeTab].id);
      } else {
        this.setData({ dishes: [] });
      }
    } catch (err) {
      console.error("[dish-pool] refresh categories failed", err);
    }
  },

  // ── 添加 ──────────────────────────────────────────────────────────────────

  onOpenAdd() {
    const categories = this.data.categories as Category[];
    const idx =
      this.data.activeTab < categories.length ? this.data.activeTab : 0;
    const defaultCategoryId = categories[idx]?.id ?? "";
    this._originalImages = [];
    this._uploadedFileIDs = [];
    this.setData({
      formVisible: true,
      formMode: "add",
      formData: { ...EMPTY_FORM, categoryId: defaultCategoryId },
      formCategoryIdx: idx,
      formNameError: "",
      formDirty: false,
    });
  },

  // ── 编辑 ──────────────────────────────────────────────────────────────────

  onOpenEdit(e: WechatMiniprogram.TouchEvent) {
    const dish = (e.currentTarget.dataset as { dish: DishRecord }).dish;
    const categories = this.data.categories as Category[];
    const catIdx = categories.findIndex((c) => c.id === dish.categoryId);
    const images = dish.images ? [...dish.images] : [];
    this._originalImages = [...images];
    this._uploadedFileIDs = [];
    this.setData({
      formVisible: true,
      formMode: "edit",
      formData: {
        _id: dish._id,
        name: dish.name,
        categoryId: dish.categoryId,
        images,
        enabled: dish.enabled,
      },
      formCategoryIdx: catIdx >= 0 ? catIdx : 0,
      formNameError: "",
      formDirty: false,
    });
  },

  onCloseForm() {
    if (this.data.formMode === "add" && this._uploadedFileIDs.length > 0) {
      void wx.cloud.deleteFile({ fileList: this._uploadedFileIDs });
    }
    this.setData({ formVisible: false });
  },

  // ── 表单字段更新 ─────────────────────────────────────────────────────────

  onFormNameInput(e: WechatMiniprogram.Input) {
    const { value, error } = validateDishName(e.detail.value);
    this.setData({
      "formData.name": value,
      formNameError: error ?? "",
      formDirty: true,
    });
  },

  onFormCategoryChange(e: WechatMiniprogram.PickerChange) {
    const categories = this.data.categories as Category[];
    const idx = Number(e.detail.value);
    this.setData({
      "formData.categoryId": categories[idx].id,
      formCategoryIdx: idx,
      formDirty: true,
    });
  },

  // ── 图片 ─────────────────────────────────────────────────────────────────

  async onChooseImages() {
    const current = (this.data.formData as FormData).images;
    const remaining = 3 - current.length;
    if (remaining <= 0) return;

    wx.chooseMedia({
      count: remaining,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: async (res) => {
        this.setData({ formUploading: true });
        try {
          const fileIDs = await this._uploadImages(
            res.tempFiles.map((f) => f.tempFilePath),
          );
          const merged = [...current, ...fileIDs];
          this.setData({ "formData.images": merged, formDirty: true });
        } catch (err) {
          console.error("[dish-pool] upload failed", err);
          wx.showToast({ title: "上传失败，请重试", icon: "none" });
        } finally {
          this.setData({ formUploading: false });
        }
      },
    });
  },

  async _uploadImages(tempPaths: string[]): Promise<string[]> {
    const results = await Promise.all(
      tempPaths.map((path) => {
        const ext = path.split(".").pop() ?? "jpg";
        return wx.cloud.uploadFile({
          cloudPath: `dishes/${this._groupId}/${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}.${ext}`,
          filePath: path,
        });
      }),
    );
    const fileIDs = results.map((r) => r.fileID);
    if (this.data.formMode === "add") {
      this._uploadedFileIDs.push(...fileIDs);
    }
    return fileIDs;
  },

  onRemoveImage(e: WechatMiniprogram.TouchEvent) {
    const idx = Number((e.currentTarget.dataset as { idx: number }).idx);
    const images = [...(this.data.formData as FormData).images];
    const removed = images.splice(idx, 1);
    this.setData({ "formData.images": images, formDirty: true });
    if (removed.length > 0) {
      if (this.data.formMode === "add") {
        this._uploadedFileIDs = this._uploadedFileIDs.filter(
          (fid) => fid !== removed[0],
        );
        void wx.cloud.deleteFile({ fileList: removed });
      }
    }
  },

  // ── 保存 ─────────────────────────────────────────────────────────────────

  async onSaveDish() {
    if (!this.data.formDirty) return;
    if (this.data.formUploading) {
      wx.showToast({ title: "图片上传中，请稍候", icon: "none" });
      return;
    }
    const form = this.data.formData as FormData;
    const { value, error } = validateDishName(form.name);
    if (error) {
      this.setData({ formNameError: error });
      return;
    }

    wx.showLoading({ title: "保存中…", mask: true });
    try {
      const isEdit = this.data.formMode === "edit";
      let removedFileIDs: string[] = [];

      if (isEdit) {
        const currentImages = form.images;
        removedFileIDs = this._originalImages.filter(
          (fid) => !currentImages.includes(fid),
        );
        await this._db!.collection("dishes")
          .doc(form._id)
          .update({
            data: {
              name: value,
              categoryId: form.categoryId,
              images: form.images,
              enabled: form.enabled,
              updatedAt: Date.now(),
            },
          });

        const activeCategoryId = (
          this.data.categories[this.data.activeTab] as Category
        ).id;
        if (form.categoryId === activeCategoryId) {
          const dishes = this.data.dishes as DishRecord[];
          const idx = dishes.findIndex((d) => d._id === form._id);
          if (idx !== -1) {
            this.setData({
              [`dishes[${idx}].name`]: value,
              [`dishes[${idx}].categoryId`]: form.categoryId,
              [`dishes[${idx}].images`]: form.images,
              [`dishes[${idx}].enabled`]: form.enabled,
            });
          }
        } else {
          await this._loadDishes(activeCategoryId);
        }
      } else {
        const addRes = await this._db!.collection("dishes").add({
          data: {
            groupId: this._groupId,
            name: value,
            categoryId: form.categoryId,
            images: form.images,
            enabled: true,
            creatorId: this._openid,
            createdAt: Date.now(),
          },
        });
        const activeCategoryId = (
          this.data.categories[this.data.activeTab] as Category
        ).id;
        if (form.categoryId === activeCategoryId) {
          const newDish: DishRecord = {
            _id: addRes._id as unknown as string,
            name: value,
            categoryId: form.categoryId,
            images: form.images,
            enabled: true,
            creatorId: this._openid,
            createdAt: Date.now(),
          };
          const dishes = [newDish, ...(this.data.dishes as DishRecord[])];
          this.setData({ dishes });
        }
      }

      if (removedFileIDs.length > 0) {
        void wx.cloud.deleteFile({ fileList: removedFileIDs });
      }
      if (!isEdit) {
        this._uploadedFileIDs = [];
      }

      this.setData({ formVisible: false });
    } catch (err) {
      console.error("[dish-pool] save failed", err);
      wx.showToast({ title: "保存失败，请重试", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  // ── 下架 ─────────────────────────────────────────────────────────────────

  onCardDeleteDish(e: WechatMiniprogram.TouchEvent) {
    const dish = (e.currentTarget.dataset as { dish: DishRecord }).dish;
    this._confirmDelete(dish);
  },

  onFormDeleteDish() {
    const form = this.data.formData as FormData;
    if (!form._id) return;
    const dish: DishRecord = {
      _id: form._id,
      name: form.name,
      categoryId: form.categoryId,
      enabled: form.enabled,
      images: form.images,
    };
    this.setData({ formVisible: false });
    this._confirmDelete(dish);
  },

  onFormToggleEnabled() {
    const current = (this.data.formData as FormData).enabled;
    this.setData({ "formData.enabled": !current, formDirty: true });
  },

  _confirmDelete(dish: DishRecord) {
    wx.showModal({
      title: "下架菜品",
      content: `确认下架「${dish.name}」？`,
      confirmColor: "#c8815e",
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: "下架中…", mask: true });
        try {
          if (dish.images && dish.images.length > 0) {
            await wx.cloud.deleteFile({ fileList: dish.images });
          }
          await this._db!.collection("dishes").doc(dish._id).remove();
          const dishes = (this.data.dishes as DishRecord[]).filter(
            (d) => d._id !== dish._id,
          );
          this.setData({ dishes });
        } catch (err) {
          console.error("[dish-pool] delete failed", err);
          wx.showToast({ title: "删除失败，请重试", icon: "none" });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  // ── 导入菜品 ──────────────────────────────────────────────────────────────

  onOpenImport() {
    const app = getApp<AppInstance>();
    const allGroups = app.globalData.groups;
    const sources = allGroups
      .filter((g) => g._id !== this._groupId)
      .map((g) => ({ _id: g._id, name: g.name }));

    if (sources.length === 0) {
      wx.showToast({ title: "没有可导入的厨房", icon: "none" });
      return;
    }

    this.setData({
      importVisible: true,
      importStep: "selectGroup",
      importSourceGroups: sources,
      importSourceGroupIdx: 0,
      importSourceCategories: [],
      importLoadingCategories: false,
      importing: false,
    });
  },

  onCloseImport() {
    this.setData({ importVisible: false });
  },

  onImportSourceGroupChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ importSourceGroupIdx: Number(e.detail.value) });
  },

  async onImportNextStep() {
    const groups = this.data.importSourceGroups;
    const idx = this.data.importSourceGroupIdx;
    const sourceGroupId = groups[idx]._id;

    this.setData({ importLoadingCategories: true });
    try {
      const configRes = await this._db!.collection("user_config")
        .where({ groupId: sourceGroupId })
        .limit(1)
        .get();

      if (configRes.data.length === 0) {
        wx.showToast({ title: "源厨房无数据", icon: "none" });
        this.setData({ importLoadingCategories: false });
        return;
      }

      const sourceCategories: Category[] = (
        configRes.data[0] as { categories: Category[] }
      ).categories;

      const catsWithCount = await Promise.all(
        sourceCategories.map(async (cat) => {
          const countRes = await this._db!.collection("dishes")
            .where({ groupId: sourceGroupId, categoryId: cat.id })
            .count();
          return {
            ...cat,
            checked: true,
            dishCount: countRes.total,
          };
        }),
      );

      this.setData({
        importStep: "selectCategories",
        importSourceCategories: catsWithCount,
        importLoadingCategories: false,
      });
    } catch (err) {
      console.error("[dish-pool] load source categories failed", err);
      this.setData({ importLoadingCategories: false });
      wx.showToast({ title: "加载失败，请重试", icon: "none" });
    }
  },

  onImportPrevStep() {
    this.setData({ importStep: "selectGroup" });
  },

  onImportToggleCategory(e: WechatMiniprogram.TouchEvent) {
    const idx = Number((e.currentTarget.dataset as { idx: number }).idx);
    const key = `importSourceCategories[${idx}].checked`;
    this.setData({
      [key]: !(
        this.data.importSourceCategories as Array<
          Category & { checked: boolean; dishCount: number }
        >
      )[idx].checked,
    });
  },

  async onConfirmImport() {
    const cats = this.data.importSourceCategories as Array<
      Category & { checked: boolean; dishCount: number }
    >;
    const checked = cats.filter((c) => c.checked);
    if (checked.length === 0) {
      wx.showToast({ title: "请至少勾选一个分类", icon: "none" });
      return;
    }

    const totalDishes = checked.reduce((sum, c) => sum + c.dishCount, 0);

    const confirmRes =
      await new Promise<WechatMiniprogram.ShowModalSuccessCallbackResult>(
        (resolve) => {
          wx.showModal({
            title: "确认导入",
            content: `将从源厨房导入 ${checked.length} 个分类共 ${totalDishes} 道菜品`,
            confirmColor: "#c8815e",
            success: resolve,
          });
        },
      );

    if (!confirmRes.confirm) return;

    this.setData({ importing: true });
    try {
      const groups = this.data.importSourceGroups;
      const sourceGroupId = groups[this.data.importSourceGroupIdx]._id;

      const targetCategories = this.data.categories as Category[];
      const existingCatIds = new Set(targetCategories.map((c) => c.id));
      const newCategories: Category[] = [];

      for (const cat of checked) {
        if (!existingCatIds.has(cat.id)) {
          newCategories.push({ id: cat.id, name: cat.name });
        }
      }

      for (const cat of checked) {
        const MAX_LIMIT = 100;
        let allDishes: DishRecord[] = [];
        let hasMore = true;

        while (hasMore) {
          const res = await this._db!.collection("dishes")
            .where({ groupId: sourceGroupId, categoryId: cat.id })
            .limit(MAX_LIMIT)
            .skip(allDishes.length)
            .get();

          const batch = res.data as DishRecord[];
          allDishes = allDishes.concat(batch);
          hasMore = batch.length === MAX_LIMIT;
        }

        for (const dish of allDishes) {
          const importData = buildImportDishData(dish, this._groupId);
          await this._db!.collection("dishes").add({ data: importData });
        }
      }

      if (newCategories.length > 0) {
        const merged = [...targetCategories, ...newCategories];
        const configRes = await this._db!.collection("user_config")
          .where({ groupId: this._groupId })
          .limit(1)
          .get();
        if (configRes.data.length > 0) {
          const configId = (configRes.data[0] as { _id: string })._id;
          await this._db!.collection("user_config")
            .doc(configId)
            .update({ data: { categories: merged } });
        }

        if (this.data.categories.length > 0) {
          this.setData({ categories: merged });
        }
      }

      this.setData({ importVisible: false, importing: false });
      wx.showToast({ title: "导入完成", icon: "success" });

      if (this.data.categories.length > 0) {
        const activeCat = (this.data.categories as Category[])[
          this.data.activeTab
        ] as Category;
        await this._loadDishes(activeCat.id);
      }
    } catch (err) {
      console.error("[dish-pool] import failed", err);
      this.setData({ importing: false });
      wx.showToast({ title: "导入失败，请重试", icon: "none" });
    }
  },

  // ── 启用/禁用 ─────────────────────────────────────────────────────────────

  noop() {},

  _getMemberCount(
    groups: Array<{ _id: string; name: string; members: string[] }>,
    groupId: string,
  ): number {
    const group = groups.find((g) => g._id === groupId);
    return group ? group.members.length : 0;
  },

  async onToggleEnabled(e: WechatMiniprogram.TouchEvent) {
    const { dish, idx } = e.currentTarget.dataset as {
      dish: DishRecord;
      idx: number;
    };
    const newEnabled = !dish.enabled;

    this.setData({ [`dishes[${idx}].enabled`]: newEnabled });

    try {
      await this._db!.collection("dishes")
        .doc(dish._id)
        .update({ data: { enabled: newEnabled } });
    } catch (err) {
      this.setData({ [`dishes[${idx}].enabled`]: dish.enabled });
      console.error("[dish-pool] toggle failed", err);
      wx.showToast({ title: "操作失败，请重试", icon: "none" });
    }
  },
});
