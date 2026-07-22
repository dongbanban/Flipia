import {
  attachDrawerNames,
  getTodaySummary,
  isToday,
  type DrawHistoryRecord,
} from "../../lib/history";
import { drawDishes, validateDrawConfig } from "../../lib/draw-engine";
import type { Dish, DrawConfigEntry } from "../../lib/draw-engine";
import { resolveEffectiveGroupId } from "../../lib/draw-config-manage";
import type { DrawConfigGroup, Category } from "../../lib/init-data";
import { showConfirm } from "../../lib/confirm";
import { QUERY, HISTORY_WINDOW_DAYS } from "../../config";

interface DrawCard {
  id: string;
  categoryId: string;
  categoryName: string;
  dishId: string;
  dishName: string;
  imageUrl: string;
  flipped: boolean;
  redrawing: boolean;
}

interface AppInstance {
  globalData: {
    openid: string;
    groupId: string;
    groups: Array<{ _id: string; name: string; members: string[] }>;
  };
  switchGroup(id: string): void;
  whenReady(): Promise<void>;
}

const SEVEN_DAYS_MS = HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const STORAGE_ACTIVE_CONFIG_KEY = "flipia_active_config_id";
const STORAGE_LAST_DRAWN_KEY = "flipia_last_drawn_config_id";

Page({
  data: {
    openid: "",
    groups: [] as Array<{ _id: string; name: string; members: string[] }>,
    activeGroupId: "",
    memberCount: 0,
    todaySummary: "",
    todayRecords: [] as DrawHistoryRecord[],

    phase: "" as "" | "idle" | "drawing" | "allRevealed",
    drawCards: [] as DrawCard[],
    validationError: "",
    totalCards: 0,
    flippedCount: 0,
    loadingConfig: true,
    autoFlipping: false,
    activeConfigName: "",
    configGroupNames: [] as Array<{ id: string; name: string }>,
  },

  _db: null as ReturnType<typeof wx.cloud.database> | null,
  _groupId: "",
  _dishPool: [] as Dish[],
  _activeEntries: [] as DrawConfigEntry[],
  _groups: [] as DrawConfigGroup[],
  _categories: [] as Category[],

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
      this.setData({
        phase: "",
        drawCards: [],
        validationError: "",
        totalCards: 0,
        flippedCount: 0,
        loadingConfig: true,
        activeConfigName: "",
        configGroupNames: [],
      });
      this._loadConfigAndValidate();
      this._loadTodaySummary();
    } else if (this.data.phase !== "drawing") {
      this._loadConfigAndValidate();
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
      openid: app.globalData.openid,
      groups,
      activeGroupId: app.globalData.groupId,
      memberCount: this._getMemberCount(groups, app.globalData.groupId),
    });
    this._loadConfigAndValidate();
    this._loadTodaySummary();
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
      todaySummary: "",
      todayRecords: [],
      phase: "",
      drawCards: [],
      validationError: "",
      totalCards: 0,
      flippedCount: 0,
      loadingConfig: true,
      activeConfigName: "",
      configGroupNames: [],
    });
    this._groupId = e.detail.groupId;
    this._loadConfigAndValidate();
    this._loadTodaySummary();
  },

  onGroupCreate() {
    wx.navigateTo({ url: "/pages/group-create/index" });
  },

  onGoHistory() {
    wx.switchTab({ url: "/pages/history/index" });
  },

  _getMemberCount(
    groups: Array<{ _id: string; name: string; members: string[] }>,
    groupId: string,
  ): number {
    const group = groups.find((g) => g._id === groupId);
    return group ? group.members.length : 0;
  },

  async _loadConfigAndValidate() {
    try {
      const configRes = await this._db!.collection("user_config")
        .where({ groupId: this._groupId })
        .limit(1)
        .get();

      if (configRes.data.length === 0) {
        this.setData({ loadingConfig: false, phase: "idle", validationError: "配置加载失败" });
        return;
      }

      const config = configRes.data[0] as {
        categories: Category[];
        drawConfigGroups: DrawConfigGroup[];
      };

      const storedActiveId = wx.getStorageSync(STORAGE_ACTIVE_CONFIG_KEY) as string;
      const storedLastDrawnId = wx.getStorageSync(STORAGE_LAST_DRAWN_KEY) as string;

      const effectiveId = resolveEffectiveGroupId(
        config.drawConfigGroups,
        storedActiveId,
        storedLastDrawnId,
      );

      if (effectiveId && effectiveId !== storedActiveId) {
        wx.setStorageSync(STORAGE_ACTIVE_CONFIG_KEY, effectiveId);
      }

      if (!effectiveId) {
        this.setData({ loadingConfig: false, phase: "idle", validationError: "暂无抽取方案" });
        return;
      }

      const activeGroup = config.drawConfigGroups.find((g) => g.id === effectiveId);
      if (!activeGroup || activeGroup.entries.length === 0) {
        this.setData({ loadingConfig: false, phase: "idle", validationError: "当前方案无抽取项" });
        return;
      }

      const configGroupNames = config.drawConfigGroups.map((g) => ({ id: g.id, name: g.name }));
      this._groups = config.drawConfigGroups;
      this._categories = config.categories;

      const syncedEntries = activeGroup.entries.map((e) => {
        const cat = config.categories.find((c) => c.id === e.categoryId);
        return cat ? { ...e, categoryName: cat.name } : e;
      });
      this._activeEntries = syncedEntries;

      const PAGE_SIZE = QUERY.LIMIT_GENERIC_MAX;
      type RawDish = {
        _id: string;
        name: string;
        categoryId: string;
        enabled: boolean;
        images?: string[];
      };
      let allRaw: RawDish[] = [];
      let skip = 0;
      let hasMore = true;
      while (hasMore) {
        const res = await this._db!.collection("dishes")
          .where({ groupId: this._groupId, enabled: true })
          .limit(PAGE_SIZE)
          .skip(skip)
          .get();
        const batch = res.data as RawDish[];
        allRaw = allRaw.concat(batch);
        skip += batch.length;
        hasMore = batch.length > 0;
      }

      const dishes = allRaw.map((d) => ({
        id: d._id,
        name: d.name,
        categoryId: d.categoryId,
        enabled: d.enabled,
        images: d.images,
      }));
      this._dishPool = dishes;

      const validation = validateDrawConfig(dishes, syncedEntries);
      if (validation.valid) {
        this.setData({
          loadingConfig: false,
          phase: "idle",
          validationError: "",
          totalCards: syncedEntries.reduce((sum, e) => sum + e.count, 0),
          activeConfigName: activeGroup.name,
          configGroupNames,
        });
      } else {
        this.setData({
          loadingConfig: false,
          phase: "idle",
          validationError: validation.reason ?? "菜品不足",
          totalCards: 0,
          activeConfigName: activeGroup.name,
          configGroupNames,
        });
      }
    } catch (err) {
      console.error("[index] load config failed", err);
      this.setData({ loadingConfig: false, phase: "idle", validationError: "加载失败，请重试" });
    }
  },

  async onBackToIdle() {
    const confirmed = await showConfirm({
      title: "返回首页",
      content: "返回后当前抽取结果将不会保留",
    });
    if (confirmed) {
      this.setData({ phase: "idle", drawCards: [], flippedCount: 0, autoFlipping: false });
    }
  },

  async _resolveActiveConfig() {
    if (this._groups.length === 0) return;

    try {
      const res = await this._db!.collection("user_config")
        .where({ groupId: this._groupId })
        .field({ "drawConfigGroups.id": true, "drawConfigGroups.name": true })
        .limit(1)
        .get();

      if (res.data.length === 0) {
        this._loadConfigAndValidate();
        return;
      }

      const cloud = res.data[0] as { drawConfigGroups: Array<{ id: string; name: string }> };
      const cloudIds = cloud.drawConfigGroups.map((g) => g.id).join(",");
      const localIds = this._groups.map((g) => g.id).join(",");

      if (cloudIds !== localIds) {
        this._loadConfigAndValidate();
        return;
      }
    } catch {
      // network error — fall through to local resolve, worst case stale
    }

    const storedActiveId = wx.getStorageSync(STORAGE_ACTIVE_CONFIG_KEY) as string;
    const storedLastDrawnId = wx.getStorageSync(STORAGE_LAST_DRAWN_KEY) as string;

    const effectiveId = resolveEffectiveGroupId(
      this._groups,
      storedActiveId,
      storedLastDrawnId,
    );

    if (!effectiveId) {
      this.setData({ phase: "idle", validationError: "暂无抽取方案" });
      return;
    }

    const activeGroup = this._groups.find((g) => g.id === effectiveId);
    if (!activeGroup || activeGroup.entries.length === 0) {
      this.setData({ phase: "idle", validationError: "当前方案无抽取项" });
      return;
    }

    const syncedEntries = activeGroup.entries.map((e) => {
      const cat = this._categories.find((c) => c.id === e.categoryId);
      return cat ? { ...e, categoryName: cat.name } : e;
    });
    this._activeEntries = syncedEntries;

    const validation = validateDrawConfig(this._dishPool, syncedEntries);
    if (validation.valid) {
      this.setData({
        phase: "idle",
        validationError: "",
        totalCards: syncedEntries.reduce((sum, e) => sum + e.count, 0),
        activeConfigName: activeGroup.name,
      });
    } else {
      this.setData({
        phase: "idle",
        validationError: validation.reason ?? "菜品不足",
        totalCards: 0,
        activeConfigName: activeGroup.name,
      });
    }
  },

  onSwitchConfig() {
    const names = (this.data.configGroupNames as Array<{ id: string; name: string }>).map((g) => g.name);
    if (names.length <= 1) return;

    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const selected = (this.data.configGroupNames as Array<{ id: string; name: string }>)[res.tapIndex];
        if (!selected) return;

        wx.setStorageSync(STORAGE_ACTIVE_CONFIG_KEY, selected.id);
        this._resolveActiveConfig();
      },
    });
  },

  onAutoFlip() {
    const cards = this.data.drawCards as DrawCard[];
    if (this.data.autoFlipping) return;

    this.setData({ autoFlipping: true });

    let i = 0;
    const flipNext = () => {
      if (i >= cards.length) {
        this.setData({ autoFlipping: false });
        return;
      }
      const cardsNow = this.data.drawCards as DrawCard[];
      if (!cardsNow[i].flipped && !cardsNow[i].redrawing) {
        this.setData({
          [`drawCards[${i}].flipped`]: true,
          flippedCount: cardsNow.filter((c) => c.flipped).length + 1,
        });
      }
      i++;
      setTimeout(flipNext, 400);
    };
    flipNext();
  },

  noop() {},

  onStartDraw() {
    if (this.data.validationError) return;
    if (this._activeEntries.length === 0) return;

    const results = drawDishes(this._dishPool, this._activeEntries);

    let cardIdx = 0;
    const cards: DrawCard[] = [];
    for (const group of results) {
      for (const dish of group.dishes) {
        const imageUrl = dish.images && dish.images.length > 0 ? dish.images[0] : "";
        cards.push({
          id: `card-${cardIdx}`,
          categoryId: group.categoryId,
          categoryName: group.categoryName,
          dishId: dish.id,
          dishName: dish.name,
          imageUrl,
          flipped: false,
          redrawing: false,
        });
        cardIdx++;
      }
    }

    this.setData({
      phase: "drawing",
      drawCards: cards,
      flippedCount: 0,
      autoFlipping: false,
    });
  },

  onFlipCard(e: WechatMiniprogram.TouchEvent) {
    const idx = Number((e.currentTarget.dataset as { idx: number }).idx);
    const cards = this.data.drawCards as DrawCard[];
    if (cards[idx].flipped) return;
    if (cards[idx].redrawing) return;

    const newFlipped = cards[idx].flipped ? cards.length : cards.filter((c) => c.flipped).length + 1;
    this.setData({
      [`drawCards[${idx}].flipped`]: true,
      flippedCount: newFlipped,
    });
  },

  onRedrawCard(e: WechatMiniprogram.TouchEvent) {
    const idx = Number((e.currentTarget.dataset as { idx: number }).idx);
    const cards = this.data.drawCards as DrawCard[];
    const card = cards[idx];
    if (!card.flipped || card.redrawing) return;

    const sameCategoryDrawnIds = new Set(
      cards
        .filter((c) => c.categoryId === card.categoryId && c.dishId !== card.dishId)
        .map((c) => c.dishId),
    );

    const available = this._dishPool.filter(
      (d) =>
        d.categoryId === card.categoryId &&
        d.id !== card.dishId &&
        !sameCategoryDrawnIds.has(d.id),
    );

    if (available.length === 0) {
      wx.showToast({ title: `${card.categoryName}中无其他可用菜品`, icon: "none" });
      return;
    }

    const pick = available[Math.floor(Math.random() * available.length)];
    const imageUrl = pick.images && pick.images.length > 0 ? pick.images[0] : "";

    const flippedCount = cards.filter((c, i) => c.flipped && i !== idx).length;

    this.setData({
      [`drawCards[${idx}].flipped`]: false,
      [`drawCards[${idx}].redrawing`]: true,
      flippedCount,
    });

    setTimeout(() => {
      this.setData({
        [`drawCards[${idx}].dishId`]: pick.id,
        [`drawCards[${idx}].dishName`]: pick.name,
        [`drawCards[${idx}].imageUrl`]: imageUrl,
        [`drawCards[${idx}].redrawing`]: false,
      });
    }, 350);
  },

  onConfirmDraw() {
    const cards = this.data.drawCards as DrawCard[];
    const allFlipped = cards.every((c) => c.flipped);
    if (!allFlipped) return;

    void this._saveDrawHistory(cards);
  },

  async _saveDrawHistory(cards: DrawCard[]) {
    wx.showLoading({ title: "记录中…", mask: true });
    try {
      const app = getApp<AppInstance>();
      const openid = app.globalData.openid;

      const resultMap = new Map<string, {
        categoryId: string;
        categoryName: string;
        dishes: Array<{ dishId: string; dishName: string; imageUrl: string }>;
      }>();

      for (const card of cards) {
        let group = resultMap.get(card.categoryId);
        if (!group) {
          group = {
            categoryId: card.categoryId,
            categoryName: card.categoryName,
            dishes: [],
          };
          resultMap.set(card.categoryId, group);
        }
        group.dishes.push({
          dishId: card.dishId,
          dishName: card.dishName,
          imageUrl: card.imageUrl,
        });
      }

      const results = [...resultMap.values()];

      await this._db!.collection("draw_history").add({
        data: {
          groupId: this._groupId,
          drawerId: openid,
          status: "active",
          results,
          images: [],
          confirmedAt: Date.now(),
        },
      });

      const activeId = wx.getStorageSync(STORAGE_ACTIVE_CONFIG_KEY) as string;
      if (activeId) {
        wx.setStorageSync(STORAGE_LAST_DRAWN_KEY, activeId);
      }

      await this._archiveOldRecords();

      wx.hideLoading();
      wx.showToast({ title: "记录成功", icon: "success" });

      this.setData({
        phase: "idle",
        drawCards: [],
        flippedCount: 0,
        autoFlipping: false,
      });
      this._loadTodaySummary();
    } catch (err) {
      console.error("[index] save draw history failed", err);
      wx.hideLoading();
      wx.showToast({ title: "记录失败，请重试", icon: "none" });
    }
  },

  async _archiveOldRecords() {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    try {
      const PAGE_SIZE = QUERY.LIMIT_GENERIC_MAX;
      let skip = 0;
      let hasMore = true;
      while (hasMore) {
        const res = await this._db!.collection("draw_history")
          .where({
            groupId: this._groupId,
            status: "active",
            confirmedAt: this._db!.command.lt(cutoff),
          })
          .field({ _id: true })
          .limit(PAGE_SIZE)
          .skip(skip)
          .get();

        const batch = res.data as Array<{ _id: string }>;
        for (const item of batch) {
          await this._db!.collection("draw_history")
            .doc(item._id)
            .update({ data: { status: "archived" } });
        }
        skip += batch.length;
        hasMore = batch.length > 0;
      }
    } catch (err) {
      console.error("[index] archive old records failed", err);
    }
  },

  async _loadTodaySummary() {
    try {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date();
      dayEnd.setHours(23, 59, 59, 999);
      const res = await this._db!.collection("draw_history")
        .where({
          groupId: this._groupId,
          status: "active",
          confirmedAt: this._db!.command.gte(dayStart.getTime()).and(
            this._db!.command.lte(dayEnd.getTime()),
          ),
        })
        .orderBy("confirmedAt", "desc")
        .limit(QUERY.LIMIT_USER_CONFIG)
        .get();

      let records = (res.data as DrawHistoryRecord[]).filter((r) =>
        isToday(r.confirmedAt),
      );

      if (records.length > 0 && this.data.memberCount > 1) {
        const drawerIds = [
          ...new Set(records.map((r) => r.drawerId).filter(Boolean)),
        ] as string[];
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

      const summary = getTodaySummary(records, this.data.memberCount);
      this.setData({ todaySummary: summary, todayRecords: records });
    } catch (err) {
      console.error("[index] load today summary failed", err);
    }
  },
});
