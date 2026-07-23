import { sanitizeInput } from "@/lib/sanitize";
import { LIMITS, QUERY, STRINGS } from "@/config";
import { groupStore } from "@/stores/group-store";
import {
  type Category,
  generateGroupId,
  buildDefaultUserConfig,
  buildPresetDishes,
} from "@/lib/init-data";

interface GroupInfo {
  _id: string;
  name: string;
  members: string[];
}

interface SourceDish {
  name: string;
  categoryId: string;
  images: string[];
  enabled: boolean;
  creatorId: string;
  createdAt: number;
}

Page({
  data: {
    groupName: "",
    nameError: "",
    importEnabled: false,
    sourceGroups: [] as GroupInfo[],
    sourceGroupIdx: -1,
    sourceGroupName: "",
    sourceCategories: [] as Category[],
    selectedCategoryIds: [] as string[],
    sourceLoading: false,
    submitting: false,
  },

  _db: null as ReturnType<typeof wx.cloud.database> | null,
  _openid: "",

  async onLoad() {
    this._openid = getApp<{ globalData: { openid: string } }>().globalData.openid;
    this._db = wx.cloud.database();

    const existing = groupStore.data.groups;
    this.setData({ sourceGroups: existing });
  },

  onNameInput(e: WechatMiniprogram.Input) {
    const value = e.detail.value.replace(/^\s+/, "");
    this.setData({ groupName: value, nameError: "" });
  },

  onToggleImport() {
    this.setData({
      importEnabled: !this.data.importEnabled,
      sourceGroupIdx: -1,
      sourceGroupName: "",
      sourceCategories: [],
      selectedCategoryIds: [],
    });
  },

  async onSelectSourceGroup(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    const group = this.data.sourceGroups[idx];
    if (!group) return;

    this.setData({
      sourceGroupIdx: idx,
      sourceGroupName: group.name,
      selectedCategoryIds: [],
      sourceLoading: true,
    });

    try {
      const res = await this._db!.collection("user_config")
        .where({ groupId: group._id })
        .limit(1)
        .get();

      const categories: Category[] =
        res.data.length > 0
          ? (res.data[0] as { categories: Category[] }).categories
          : [];

      this.setData({
        sourceCategories: categories,
        selectedCategoryIds: categories.map((c) => c.id),
        sourceLoading: false,
      });
    } catch (err) {
      console.error("[group-create] load source categories failed", err);
      wx.showToast({ title: "加载分类失败", icon: "none" });
      this.setData({ sourceLoading: false });
    }
  },

  onToggleCategory(e: WechatMiniprogram.TouchEvent) {
    const index = Number((e.currentTarget.dataset as { index: string }).index);
    const cat = (this.data.sourceCategories as Category[])[index];
    if (!cat) {
      console.warn("[group-create] toggle miss, index:", index);
      return;
    }
    const selected = [...this.data.selectedCategoryIds];
    const pos = selected.indexOf(cat.id);
    const wasSelected = pos !== -1;
    if (wasSelected) {
      selected.splice(pos, 1);
    } else {
      selected.push(cat.id);
    }
    this.setData({ selectedCategoryIds: selected });
    console.log(
      "[group-create] toggle category:",
      cat.name,
      wasSelected ? "→ unchecked" : "→ checked",
      "remaining:", selected.length,
    );
  },

  async onSubmit() {
    if (this.data.submitting) return;

    const name = this.data.groupName.trim();

    const duplicate = groupStore.data.groups.some(
      (g) => g.name === name,
    );
    if (duplicate) {
      this.setData({ nameError: "已有同名厨房" });
      return;
    }

    const { valid, value: sanitized } = await sanitizeInput({
      value: name,
      maxLength: LIMITS.GROUP_NAME_MAX,
      fieldName: "厨房名",
    });
    if (!valid) return;

    if (this.data.importEnabled && this.data.sourceGroupIdx < 0) {
      wx.showToast({ title: "请选择源厨房", icon: "none" });
      return;
    }

    if (this.data.importEnabled && this.data.selectedCategoryIds.length === 0) {
      wx.showToast({ title: "请至少选择一项分类", icon: "none" });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: "创建中…" });

    try {
      const db = this._db!;
      const openid = this._openid;

      const groupRes = await db.collection("groups").add({
        data: { name: sanitized, members: [openid] },
      });
      const newGroupId = groupRes._id as string;

      if (this.data.importEnabled) {
        await this._importFromSource(db, newGroupId, openid);
      } else {
        const config = buildDefaultUserConfig(newGroupId, openid);
        await db.collection("user_config").add({ data: config });
        const dishes = buildPresetDishes(newGroupId, openid);
        await Promise.all(
          dishes.map((dish) => db.collection("dishes").add({ data: dish })),
        );
      }

      groupStore.setGroups([
        ...groupStore.data.groups,
        { _id: newGroupId, name: sanitized, members: [openid] },
      ]);
      groupStore.switchGroup(newGroupId);

      wx.showToast({ title: "创建成功", icon: "success" });
      setTimeout(() => {
        wx.switchTab({ url: "/pages/index/index" });
      }, 600);
    } catch (err) {
      console.error("[group-create] create failed", err);
      wx.showToast({ title: "创建失败，请重试", icon: "none" });
    } finally {
      this.setData({ submitting: false });
      wx.hideLoading();
    }
  },

  async _importFromSource(
    db: ReturnType<typeof wx.cloud.database>,
    newGroupId: string,
    openid: string,
  ) {
    const sourceGroup = this.data.sourceGroups[this.data.sourceGroupIdx];
    const sourceGroupId = sourceGroup._id;
    const selectedIds = this.data.selectedCategoryIds;
    const sourceCategories = this.data.sourceCategories as Category[];

    const importedCategories = sourceCategories.filter((c) =>
      selectedIds.includes(c.id),
    );

    const drawGroupId = generateGroupId();
    const drawEntries = importedCategories.map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      count: 1,
    }));

    await db.collection("user_config").add({
      data: {
        groupId: newGroupId,
        categories: importedCategories,
        drawConfigGroups: [
          {
            id: drawGroupId,
            name: STRINGS.DEFAULT_DRAW_CONFIG_NAME,
            entries: drawEntries,
          },
        ],
      },
    });

    if (importedCategories.length === 0) return;

    const MAX_DISHES = LIMITS.DISH_IMPORT_MAX;
    const dishRes = await db
      .collection("dishes")
      .where({
        groupId: sourceGroupId,
        categoryId: db.command.in(selectedIds),
      })
      .limit(MAX_DISHES)
      .get();

    const sourceDishes = dishRes.data as SourceDish[];

    if (sourceDishes.length > 0) {
      const batchSize = 20;
      for (let i = 0; i < sourceDishes.length; i += batchSize) {
        const batch = sourceDishes.slice(i, i + batchSize);
        await Promise.all(
          batch.map((dish) =>
            db.collection("dishes").add({
              data: {
                groupId: newGroupId,
                name: dish.name,
                categoryId: dish.categoryId,
                images: dish.images || [],
                enabled: dish.enabled !== false,
                creatorId: dish.creatorId || openid,
                createdAt: dish.createdAt || Date.now(),
              },
            }),
          ),
        );
      }
    }
  },
});
