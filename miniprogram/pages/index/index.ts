import type { DrawHistoryRecord } from "@/lib/history";
import { drawDishes, validateDrawConfig } from "@/lib/draw-engine";
import type { Dish, DrawConfigEntry } from "@/lib/draw-engine";
import { resolveEffectiveGroupId } from "@/lib/draw-config-manage";
import type { DrawConfigGroup, Category } from "@/lib/init-data";
import { showConfirm } from "@/lib/confirm";
import { getMemberCount } from "@/lib/group-utils";
import { archiveOldRecords, buildDrawCards, cardsToResults, loadEnabledDishes, loadTodayRecords, type DrawCard } from "@/pages/index/lib/helpers";
import { userStore } from "@/stores/user-store";
import { groupStore } from "@/stores/group-store";
import { HOME_PREFETCH_KEY } from "@/constants/storage-keys";

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
  _prefetched: false,

  onShow() {
    if (!this._groupId) return;
    const groupId = groupStore.data.groupId;
    const memberCount = getMemberCount(groupStore.data.groups, groupId);
    this.setData({
      openid: getApp<{ globalData: { openid: string } }>().globalData.openid,
      groups: groupStore.data.groups,
      activeGroupId: groupId,
      memberCount,
    });

    // 数据已从 splash 预取恢复，跳过本次加载
    if (this._prefetched) {
      this._prefetched = false;
      return;
    }

    if (this._groupId !== groupId) {
      this._groupId = groupId;
      this._db = wx.cloud.database();
      this.setData({
        phase: "", drawCards: [], validationError: "", totalCards: 0,
        flippedCount: 0, loadingConfig: true, activeConfigName: "", configGroupNames: [],
      });
      this._loadConfigAndValidate();
      this._loadTodaySummary();
    } else if (this.data.phase !== "drawing") {
      this._loadConfigAndValidate();
    }
  },

  async onLoad() {
    // 检查 splash 页面是否已完成数据预取
    const prefetched = wx.getStorageSync(HOME_PREFETCH_KEY) as Record<string, unknown> | undefined;
    if (prefetched && prefetched.groupId === groupStore.data.groupId) {
      this._fromPrefetch(prefetched);
      return;
    }

    this._groupId = groupStore.data.groupId;
    this._db = wx.cloud.database();
    const groups = groupStore.data.groups;
    this.setData({
      openid: getApp<{ globalData: { openid: string } }>().globalData.openid,
      groups,
      activeGroupId: groupStore.data.groupId,
      memberCount: getMemberCount(groups, groupStore.data.groupId),
    });
    this._loadConfigAndValidate();
    this._loadTodaySummary();
  },

  /**
   * 从 splash 预取数据直接恢复页面状态，跳过加载态。
   */
  _fromPrefetch(p: Record<string, unknown>) {
    this._groupId = p.groupId as string;
    this._db = wx.cloud.database();
    this._groups = p._groups as DrawConfigGroup[];
    this._categories = p._categories as Category[];
    this._activeEntries = p._activeEntries as DrawConfigEntry[];
    this._dishPool = p._dishPool as Dish[];

    const groups = groupStore.data.groups;
    this.setData({
      openid: getApp<{ globalData: { openid: string } }>().globalData.openid,
      groups,
      activeGroupId: groupStore.data.groupId,
      memberCount: p.memberCount as number,
      phase: p.phase as "" | "idle" | "drawing" | "allRevealed",
      validationError: p.validationError as string,
      totalCards: p.totalCards as number,
      activeConfigName: p.activeConfigName as string,
      configGroupNames: p.configGroupNames as Array<{ id: string; name: string }>,
      todaySummary: p.todaySummary as string,
      todayRecords: p.todayRecords as DrawHistoryRecord[],
      loadingConfig: false,
    });

    // 清除预取缓存，标记已预取（防止 onShow 重复加载）
    wx.removeStorageSync(HOME_PREFETCH_KEY);
    this._prefetched = true;
  },

  onGroupChange(e: WechatMiniprogram.CustomEvent<{ groupId: string }>) {
    groupStore.switchGroup(e.detail.groupId);
    const memberCount = getMemberCount(
      groupStore.data.groups,
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

      const storedActiveId = groupStore.data.activeConfigId;
      const storedLastDrawnId = groupStore.data.lastDrawnConfigId;

      const effectiveId = resolveEffectiveGroupId(
        config.drawConfigGroups,
        storedActiveId,
        storedLastDrawnId,
      );

      if (effectiveId && effectiveId !== storedActiveId) {
        groupStore.setActiveConfig(effectiveId);
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

      const dishes = await loadEnabledDishes(this._db!, this._groupId);
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
      // 网络错误 — 降级使用本地解析，最坏情况是陈旧数据
    }

    const storedActiveId = groupStore.data.activeConfigId;
    const storedLastDrawnId = groupStore.data.lastDrawnConfigId;

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

        groupStore.setActiveConfig(selected.id);
        this._resolveActiveConfig();
      },
    });
  },

  onAutoFlip() {
    const cards = this.data.drawCards as DrawCard[];
    if (this.data.autoFlipping) return;
    if (cards.every((c) => c.flipped)) return;

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
    const cards = buildDrawCards(results);

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
    wx.showLoading({ title: "记录中…" });
    try {
      const openid = getApp<{ globalData: { openid: string } }>().globalData.openid;

      const results = cardsToResults(cards);

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

      const activeId = groupStore.data.activeConfigId;
      if (activeId) { groupStore.setLastDrawnConfig(activeId); }

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
    await archiveOldRecords(this._db!, this._groupId);
  },

  async _loadTodaySummary() {
    try {
      const { summary, records } = await loadTodayRecords(
        this._db!,
        this._groupId,
        this.data.memberCount,
      );
      this.setData({ todaySummary: summary, todayRecords: records });
    } catch (err) {
      console.error("[index] load today summary failed", err);
    }
  },
});
