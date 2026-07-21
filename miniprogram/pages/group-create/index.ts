import { checkTextWithToast } from "../../lib/content-security";
import {
  type Category,
  generateGroupId,
  buildDefaultUserConfig,
  buildPresetDishes,
} from "../../lib/init-data";

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

interface AppInstance {
  globalData: {
    openid: string;
    groupId: string;
    groups: GroupInfo[];
  };
  switchGroup(id: string): void;
  whenReady(): Promise<void>;
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
    const app = getApp<AppInstance>();
    await app.whenReady();
    this._openid = app.globalData.openid;
    this._db = wx.cloud.database();

    const existing = app.globalData.groups as GroupInfo[];
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

      this.setData({ sourceCategories: categories });
    } catch (err) {
      console.error("[group-create] load source categories failed", err);
      wx.showToast({ title: "加载分类失败", icon: "none" });
    } finally {
      this.setData({ sourceLoading: false });
    }
  },

  onToggleCategory(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    const selected = [...this.data.selectedCategoryIds];
    const idx = selected.indexOf(id);
    if (idx === -1) {
      selected.push(id);
    } else {
      selected.splice(idx, 1);
    }
    this.setData({ selectedCategoryIds: selected });
  },

  async onSubmit() {
    const name = this.data.groupName.trim();
    if (!name) {
      this.setData({ nameError: "请输入厨房名" });
      return;
    }
    if (name.length > 12) {
      this.setData({ nameError: "厨房名不能超过 12 个字" });
      return;
    }

    const app = getApp<AppInstance>();
    const duplicate = (app.globalData.groups as GroupInfo[]).some(
      (g) => g.name === name,
    );
    if (duplicate) {
      this.setData({ nameError: "已有同名厨房" });
      return;
    }

    if (!(await checkTextWithToast(name))) return;

    if (this.data.importEnabled && this.data.sourceGroupIdx < 0) {
      wx.showToast({ title: "请选择源厨房", icon: "none" });
      return;
    }

    if (this.data.importEnabled && this.data.selectedCategoryIds.length === 0) {
      wx.showToast({ title: "请至少选择一项分类", icon: "none" });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: "创建中…", mask: true });

    try {
      const db = this._db!;
      const openid = this._openid;

      const groupRes = await db.collection("groups").add({
        data: { name, members: [openid] },
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

      app.globalData.groups = [
        ...(app.globalData.groups as GroupInfo[]),
        { _id: newGroupId, name, members: [openid] },
      ];
      app.switchGroup(newGroupId);

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
            name: "默认方案",
            entries: drawEntries,
          },
        ],
      },
    });

    if (importedCategories.length === 0) return;

    const MAX_DISHES = 500;
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
