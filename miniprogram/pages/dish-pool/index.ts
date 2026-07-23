import {
  attachCreatorNames,
  sortDishes,
  validateDishName,
} from "@/lib/dish-pool";
import type { DishRecord } from "@/lib/dish-pool";
import type { Category } from "@/lib/init-data";
import {
  addCategory,
  generateCategoryId,
  validateCategoryName,
} from "@/lib/category-manage";
import { checkTextWithToast } from "@/lib/content-security";
import { svgToImageSrc } from "@/lib/svg-icon";
import { iconSearch, iconClose, iconAdd } from "@/assets/icons";
import { uploadImages } from "@/lib/upload-image";
import { sanitizeInput } from "@/lib/sanitize";
import { showConfirm } from "@/lib/confirm";
import { getMemberCount } from "@/lib/group-utils";
import { LIMITS, QUERY } from "@/config";
import { searchDishes } from "./lib/search";
import { getImportSources, loadSourceCategories, executeImport, type ImportSourceCategory } from "./lib/import";
import { addDishToDb, updateDishInDb, type SaveContext } from "./lib/save";

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
  cookingDescription: string;
}

const EMPTY_FORM: FormData = {
  _id: "",
  name: "",
  categoryId: "",
  images: [],
  enabled: true,
  cookingDescription: "",
};

Page({
  data: {
    memberCount: 0,
    categories: [] as Category[],
    activeTab: 0,
    dishes: [] as DishRecord[],
    searchKeyword: "",
    searchResults: [] as (DishRecord & { categoryName: string })[],
    loading: false,
    formVisible: false,
    formMode: "add" as "add" | "edit",
    formTab: "manual" as "manual" | "batch",
    formData: { ...EMPTY_FORM } as FormData,
    formCategoriesForPicker: [] as Array<{ id: string; name: string }>,
    formCategoryIdx: 0,
    formNameError: "",
    formUploading: false,
    formDirty: false,

    showNewCategory: false,
    newCategoryName: "",
    newCategoryError: "",
    creatingCategory: false,

    importStep: "selectGroup" as "selectGroup" | "selectCategories",
    importSourceGroups: [] as Array<{ _id: string; name: string }>,
    importSourceGroupIdx: 0,
    importSourceCategories: [] as Array<
      Category & { checked: boolean; dishCount: number }
    >,
    importLoadingCategories: false,
    importing: false,

    // Icon Data URIs（图标系统 — 预计算 base64）
    searchIconSrc: svgToImageSrc(iconSearch, "#999999"),
    closeIconSrc: svgToImageSrc(iconClose, "#ffffff"),
    addIconSrc: svgToImageSrc(iconAdd, "#ffffff"),
  },

  _db: null as ReturnType<typeof wx.cloud.database> | null,
  _groupId: "",
  _openid: "",
  _shown: false,
  _originalImages: [] as string[],
  _uploadedFileIDs: [] as string[],
  _searchTimer: null as number | null,

  async onLoad() {
    const app = getApp<AppInstance>();
    await app.whenReady();
    this._groupId = app.globalData.groupId;
    this._openid = app.globalData.openid;
    this._db = wx.cloud.database();
    const memberCount = getMemberCount(app.globalData.groups, app.globalData.groupId);
    this.setData({
      memberCount,
    });
    this._init();
  },

  async onShow() {
    const app = getApp<AppInstance>();
    await app.whenReady();
    const memberCount = getMemberCount(app.globalData.groups, app.globalData.groupId);
    this.setData({
      memberCount,
    });
    if (!this._shown) {
      this._shown = true;
      return;
    }
    if (this._groupId !== app.globalData.groupId) {
      this._groupId = app.globalData.groupId;
      if (this._searchTimer) {
        clearTimeout(this._searchTimer);
        this._searchTimer = null;
      }
      this.setData({
        loading: false,
        formVisible: false,
        dishes: [],
        searchKeyword: "",
        searchResults: [],
        activeTab: 0,
      });
      this._init();
      return;
    }
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
    this.setData({ searchKeyword: "", searchResults: [] });
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
        .limit(QUERY.LIMIT_GENERIC_MAX)
        .get();

      const processed = await this._loadAndProcessDishes(
        res.data as DishRecord[],
      );
      this.setData({ dishes: processed });
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 对一批菜品进行排序并解析创建者昵称。 */
  async _loadAndProcessDishes(dishes: DishRecord[]): Promise<DishRecord[]> {
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

    return attachCreatorNames(sorted, nameMap);
  },

  // ── 搜索 ─────────────────────────────────────────────────────────────────

  onSearchInput(e: WechatMiniprogram.Input) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });

    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }

    if (!keyword.trim()) {
      this.setData({ searchResults: [] });
      const categories = this.data.categories as Category[];
      if (categories.length > 0) {
        const activeCat = categories[this.data.activeTab] as Category;
        this._loadDishes(activeCat.id);
      }
      return;
    }

    this._searchTimer = setTimeout(() => {
      this._doSearch(keyword.trim());
    }, 300);
  },

  onClearSearch() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
    this.setData({ searchKeyword: "", searchResults: [] });
    const categories = this.data.categories as Category[];
    if (categories.length > 0) {
      const activeCat = categories[this.data.activeTab] as Category;
      this._loadDishes(activeCat.id);
    }
  },

  async _doSearch(keyword: string) {
    if (!keyword) { this.setData({ searchResults: [] }); return; }
    this.setData({ loading: true });
    try {
      const results = await searchDishes(
        { db: this._db!, groupId: this._groupId, categories: this.data.categories as Category[] },
        keyword,
      );
      this.setData({ searchResults: results });
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
    const pickerCats: Array<{ id: string; name: string }> = [
      ...categories,
      { id: "__new__", name: "+ 新建分类" },
    ];
    this.setData({
      formVisible: true,
      formMode: "add",
      formTab: "manual",
      formData: { ...EMPTY_FORM, categoryId: defaultCategoryId },
      formCategoriesForPicker: pickerCats,
      formCategoryIdx: idx,
      formNameError: "",
      formDirty: false,
      showNewCategory: false,
      newCategoryName: "",
      newCategoryError: "",
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
        cookingDescription: dish.cookingDescription ?? "",
      },
      formCategoriesForPicker: categories as Array<{ id: string; name: string }>,
      formCategoryIdx: catIdx >= 0 ? catIdx : 0,
      formNameError: "",
      formDirty: false,
    });
  },

  onCloseForm() {
    if (this.data.formMode === "add" && this._uploadedFileIDs.length > 0) {
      void wx.cloud.deleteFile({ fileList: this._uploadedFileIDs });
    }
    this.setData({
      formVisible: false,
      showNewCategory: false,
      newCategoryName: "",
      newCategoryError: "",
    });
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
    // "+ 新建分类" 被选中 — 显示内联输入框而非直接选中它
    if (idx >= categories.length) {
      this.setData({ showNewCategory: true });
      return;
    }
    this.setData({
      "formData.categoryId": categories[idx].id,
      formCategoryIdx: idx,
      formDirty: true,
      showNewCategory: false,
      newCategoryName: "",
      newCategoryError: "",
    });
  },

  onFormTabChange(e: WechatMiniprogram.TouchEvent) {
    const tab = (e.currentTarget.dataset as { tab: string }).tab;
    if (tab === "batch") {
      this._initImportForm();
    } else {
      this.setData({ showNewCategory: false, newCategoryName: "", newCategoryError: "" });
    }
    this.setData({ formTab: tab as "manual" | "batch" });
  },

  // ── 新建分类 ──────────────────────────────────────────────────────────────

  onNewCategoryNameInput(e: WechatMiniprogram.Input) {
    this.setData({ newCategoryName: e.detail.value, newCategoryError: "" });
  },

  onCancelNewCategory() {
    const categories = this.data.categories as Category[];
    const idx = 0;
    this.setData({
      showNewCategory: false,
      newCategoryName: "",
      newCategoryError: "",
      formCategoryIdx: idx < categories.length ? idx : 0,
      "formData.categoryId": categories.length > 0 ? categories[0].id : "",
    });
  },

  async onConfirmNewCategory() {
    const raw = this.data.newCategoryName;
    const categories = this.data.categories as Category[];
    const { value, error } = validateCategoryName(
      raw,
      categories.map((c) => c.name),
    );
    if (error) {
      this.setData({ newCategoryError: error });
      return;
    }
    const { valid, value: sanitized } = await sanitizeInput({
      value,
      maxLength: LIMITS.CATEGORY_NAME_MAX,
      fieldName: "分类名",
    });
    if (!valid) return;

    this.setData({ creatingCategory: true });
    try {
      const newCatId = generateCategoryId();
      const newCategories = addCategory(categories, sanitized);
      const newCategory: Category = { id: newCatId, name: sanitized };

      // 持久化到 user_config
      const configRes = await this._db!.collection("user_config")
        .where({ groupId: this._groupId })
        .limit(1)
        .get();
      if (configRes.data.length > 0) {
        const configId = (configRes.data[0] as { _id: string })._id;
        await this._db!.collection("user_config")
          .doc(configId)
          .update({ data: { categories: newCategories } });
      }

      const pickerCats: Array<{ id: string; name: string }> = [
        ...newCategories,
        { id: "__new__", name: "+ 新建分类" },
      ];

      this.setData({
        categories: newCategories,
        formCategoriesForPicker: pickerCats,
        formCategoryIdx: newCategories.length - 1,
        "formData.categoryId": newCategory.id,
        showNewCategory: false,
        newCategoryName: "",
        newCategoryError: "",
        formDirty: true,
      });
      wx.showToast({ title: "分类已添加", icon: "success" });
    } catch (err) {
      console.error("[dish-pool] create category failed", err);
      wx.showToast({ title: "创建失败，请重试", icon: "none" });
    } finally {
      this.setData({ creatingCategory: false });
    }
  },

  // ── 烹饪描述（编辑模式）───────────────────────────────────────────────────

  onCookingDescriptionInput(e: WechatMiniprogram.Input) {
    this.setData({
      "formData.cookingDescription": e.detail.value,
      formDirty: true,
    });
  },

  // ── 图片 ─────────────────────────────────────────────────────────────────

  async onChooseImages() {
    const current = (this.data.formData as FormData).images;
    const remaining = LIMITS.DISH_IMAGE_MAX - current.length;
    if (remaining <= 0) return;

    this.setData({ formUploading: true });
    try {
      const fileIDs = await uploadImages({ count: remaining, showToast: false });

      if (this.data.formMode === "add") {
        this._uploadedFileIDs.push(...fileIDs);
      }

      const merged = [...current, ...fileIDs];
      this.setData({ "formData.images": merged, formDirty: true });
    } catch (err) {
      // 用户取消或上传失败 — uploadImages 会处理 toast
    } finally {
      this.setData({ formUploading: false });
    }
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

    const { valid, value: sanitized } = await sanitizeInput({
      value,
      maxLength: LIMITS.DISH_NAME_MAX,
      fieldName: "菜品名",
    });
    if (!valid) return;

    if (form.cookingDescription && !(await checkTextWithToast(form.cookingDescription))) return;

    wx.showLoading({ title: "保存中…" });
    try {
      const isEdit = this.data.formMode === "edit";
      const ctx: SaveContext = { db: this._db!, groupId: this._groupId, openid: this._openid };

      if (isEdit) {
        const { removedFileIDs } = await updateDishInDb(
          ctx,
          {
            _id: form._id,
            name: sanitized,
            categoryId: form.categoryId,
            images: form.images,
            enabled: form.enabled,
            cookingDescription: form.cookingDescription,
          },
          this._originalImages,
        );

        const activeCategoryId = (this.data.categories[this.data.activeTab] as Category).id;
        if (form.categoryId === activeCategoryId) {
          const dishes = this.data.dishes as DishRecord[];
          const idx = dishes.findIndex((d) => d._id === form._id);
          if (idx !== -1) {
            this.setData({
              [`dishes[${idx}].name`]: sanitized,
              [`dishes[${idx}].categoryId`]: form.categoryId,
              [`dishes[${idx}].images`]: form.images,
              [`dishes[${idx}].enabled`]: form.enabled,
              [`dishes[${idx}].cookingDescription`]: form.cookingDescription,
            });
          }
        } else {
          await this._loadDishes(activeCategoryId);
        }

        if (removedFileIDs.length > 0) {
          void wx.cloud.deleteFile({ fileList: removedFileIDs });
        }
      } else {
        const { _id, createdAt } = await addDishToDb(ctx, {
          name: sanitized,
          categoryId: form.categoryId,
          images: form.images,
        });

        const activeCategoryId = (this.data.categories[this.data.activeTab] as Category).id;
        if (form.categoryId === activeCategoryId) {
          const newDish: DishRecord = {
            _id,
            name: sanitized,
            categoryId: form.categoryId,
            images: form.images,
            enabled: true,
            creatorId: this._openid,
            createdAt,
          };
          const dishes = [newDish, ...(this.data.dishes as DishRecord[])];
          this.setData({ dishes });
        }

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

  async _confirmDelete(dish: DishRecord) {
    const confirmed = await showConfirm({
      title: "下架菜品",
      content: `确认下架「${dish.name}」？`,
    });
    if (!confirmed) return;

    wx.showLoading({ title: "下架中…" });
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

  // ── 导入菜品（表单内标签页）────────────────────────────────────────────────

  _initImportForm() {
    const app = getApp<AppInstance>();
    const sources = getImportSources(app.globalData.groups, this._groupId);
    if (sources.length === 0) {
      wx.showToast({ title: "没有可导入的厨房", icon: "none" });
      this.setData({ formTab: "manual" });
      return;
    }
    this.setData({
      importStep: "selectGroup",
      importSourceGroups: sources,
      importSourceGroupIdx: 0,
      importSourceCategories: [],
      importLoadingCategories: false,
      importing: false,
    });
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
      const cats = await loadSourceCategories({ db: this._db!, groupId: this._groupId }, sourceGroupId);
      if (cats.length === 0) {
        wx.showToast({ title: "源厨房无数据", icon: "none" });
        this.setData({ importLoadingCategories: false });
        return;
      }
      this.setData({ importStep: "selectCategories", importSourceCategories: cats, importLoadingCategories: false });
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
    const cats = this.data.importSourceCategories as ImportSourceCategory[];
    const checked = cats.filter((c) => c.checked);
    if (checked.length === 0) {
      wx.showToast({ title: "请至少勾选一个分类", icon: "none" });
      return;
    }

    const totalDishes = checked.reduce((sum, c) => sum + c.dishCount, 0);
    const confirmed = await showConfirm({
      title: "确认导入",
      content: `将从源厨房导入 ${checked.length} 个分类共 ${totalDishes} 道菜品`,
    });
    if (!confirmed) return;

    this.setData({ importing: true });
    try {
      const groups = this.data.importSourceGroups;
      const sourceGroupId = groups[this.data.importSourceGroupIdx]._id;
      const targetCategories = this.data.categories as Category[];

      const result = await executeImport(
        { db: this._db!, groupId: this._groupId },
        sourceGroupId,
        checked,
        targetCategories,
      );

      if (result.newCategories.length > 0) {
        const merged = [...targetCategories, ...result.newCategories];
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

      this.setData({ formVisible: false, importing: false });
      wx.showToast({ title: "导入完成", icon: "success" });

      if (this.data.categories.length > 0) {
        const activeCat = (this.data.categories as Category[])[this.data.activeTab] as Category;
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
