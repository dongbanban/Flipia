import { userStore } from "@/stores/user-store";
import { groupStore } from "@/stores/group-store";
import { getMemberCount } from "@/lib/group-utils";
import { validateDrawConfig, type Dish, type DrawConfigEntry } from "@/lib/draw-engine";
import { resolveEffectiveGroupId } from "@/lib/draw-config-manage";
import { loadEnabledDishes, loadTodayRecords } from "@/pages/index/lib/helpers";
import type { Category, DrawConfigGroup } from "@/lib/init-data";
import type { DrawHistoryRecord } from "@/lib/history";
import { HOME_PREFETCH_KEY } from "@/constants/storage-keys";

/** splash → 首页传递的预取数据结构 */
interface HomePrefetch {
  groupId: string;
  memberCount: number;
  phase: string;
  validationError: string;
  totalCards: number;
  activeConfigName: string;
  configGroupNames: Array<{ id: string; name: string }>;
  todaySummary: string;
  todayRecords: DrawHistoryRecord[];
  _groups: DrawConfigGroup[];
  _categories: Category[];
  _activeEntries: DrawConfigEntry[];
  _dishPool: Dish[];
}

Page({
  data: {},

  async onShow() {
    await getApp<{ whenReady(): Promise<void> }>().whenReady();

    // 启动首页数据预取，与 1s 延迟并行
    const prefetchPromise = this._prefetchHomeData();

    await new Promise((r) => setTimeout(r, 1000));

    // 等待预取完成（失败时首页自行加载）
    await prefetchPromise;

    if (userStore.data.needProfileSetup) {
      wx.redirectTo({ url: "/pages/profile-setup/index" });
    } else {
      wx.switchTab({ url: "/pages/index/index" });
    }
  },

  /**
   * 预取首页所需的配置、菜品、今日记录，存入 globalData。
   * 首页 onLoad 检测到预取数据后可跳过加载态直接展示内容。
   */
  async _prefetchHomeData() {
    const groupId = groupStore.data.groupId;
    const memberCount = getMemberCount(groupStore.data.groups, groupId);
    const db = wx.cloud.database();

    try {
      const [configRes, dishes, todayData] = await Promise.all([
        db.collection("user_config").where({ groupId }).limit(1).get(),
        loadEnabledDishes(db, groupId),
        loadTodayRecords(db, groupId, memberCount),
      ]);

      const prefetch: HomePrefetch = {
        groupId,
        memberCount,
        todaySummary: todayData.summary,
        todayRecords: todayData.records,
        _groups: [] as DrawConfigGroup[],
        _categories: [] as Category[],
        _activeEntries: [] as DrawConfigEntry[],
        _dishPool: [] as Dish[],
        phase: "idle",
        validationError: "",
        totalCards: 0,
        activeConfigName: "",
        configGroupNames: [],
      };

      if (configRes.data.length === 0) {
        prefetch.validationError = "配置加载失败";
      } else {
        const config = configRes.data[0] as {
          categories: Category[];
          drawConfigGroups: DrawConfigGroup[];
        };

        const effectiveId = resolveEffectiveGroupId(
          config.drawConfigGroups,
          groupStore.data.activeConfigId,
          groupStore.data.lastDrawnConfigId,
        );

        if (effectiveId && effectiveId !== groupStore.data.activeConfigId) {
          groupStore.setActiveConfig(effectiveId);
        }

        prefetch._groups = config.drawConfigGroups;
        prefetch._categories = config.categories;
        prefetch._dishPool = dishes;

        if (!effectiveId) {
          prefetch.validationError = "暂无抽取方案";
        } else {
          const activeGroup = config.drawConfigGroups.find((g) => g.id === effectiveId);
          if (!activeGroup || activeGroup.entries.length === 0) {
            prefetch.validationError = "当前方案无抽取项";
            prefetch.configGroupNames = config.drawConfigGroups.map((g) => ({ id: g.id, name: g.name }));
          } else {
            const configGroupNames = config.drawConfigGroups.map((g) => ({ id: g.id, name: g.name }));
            const syncedEntries = activeGroup.entries.map((e) => {
              const cat = config.categories.find((c) => c.id === e.categoryId);
              return cat ? { ...e, categoryName: cat.name } : e;
            });
            const validation = validateDrawConfig(dishes, syncedEntries);
            const totalCards = syncedEntries.reduce((sum, e) => sum + e.count, 0);

            prefetch.configGroupNames = configGroupNames;
            prefetch._activeEntries = syncedEntries;
            prefetch.validationError = validation.valid ? "" : (validation.reason ?? "菜品不足");
            prefetch.totalCards = validation.valid ? totalCards : 0;
            prefetch.activeConfigName = activeGroup.name;
          }
        }
      }

      wx.setStorageSync(HOME_PREFETCH_KEY, prefetch);
    } catch (err) {
      console.error("[splash] 预取首页数据失败", err);
      // 预取失败不阻塞导航，首页将自行加载
    }
  },
});
