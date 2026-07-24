/**
 * 插件管理页面 —— 用户查看可用插件、解锁进度、启用/禁用切换。
 *
 * 数据来源：直接调用 plugin-manage 云函数，不依赖 plugin-store 缓存，
 * 确保每次进入页面都拿到实时数据。
 */

import { load as loadPluginStore } from "@/stores/plugin-store";

/** 插件列表项的 UI 状态 */
interface PluginItem {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  enabled: boolean;
  progressHint: string;
  current: number;
  target: number;
  /** UI 专用：防止 toggle API 调用期间重复点击开关 */
  toggling: boolean;
}

Page({
  data: {
    plugins: [] as PluginItem[],
    loading: true,
    error: "",
  },

  // ── 生命周期 ──────────────────────────────────────────────

  onShow() {
    this._fetchPlugins();
  },

  // ── 数据获取 ──────────────────────────────────────────────

  /** 从云函数获取插件列表及用户状态 */
  async _fetchPlugins() {
    this.setData({ loading: true, error: "" });

    try {
      const res = await wx.cloud.callFunction({
        name: "plugin-manage",
        data: { action: "list" },
      });

      const result = res.result as {
        ok: boolean;
        plugins?: Array<{
          id: string;
          name: string;
          description: string;
          unlocked: boolean;
          enabled: boolean;
          progressHint: string;
          current: number;
          target: number;
        }>;
        error?: string;
      };

      if (!result.ok || !result.plugins) {
        throw new Error(result.error || "插件列表为空");
      }

      // 附加 UI 专用字段
      const plugins: PluginItem[] = result.plugins.map((p) => ({
        ...p,
        toggling: false,
      }));

      this.setData({ plugins, loading: false });
    } catch (err) {
      console.error("[plugin-manage] 加载插件列表失败", err);
      this.setData({
        loading: false,
        error: "加载失败，请下拉刷新重试",
      });
      wx.showToast({ title: "加载失败", icon: "none" });
      // inline loading state already dismissed above
    }
  },

  // ── 解锁 ──────────────────────────────────────────────────

  /**
   * 点击解锁按钮。
   * 调用云函数检查是否达标——达标则立即刷新卡片状态，不达标则弹 toast 告知进度。
   */
  async onUnlock(e: WechatMiniprogram.TouchEvent) {
    const pluginId = (e.currentTarget.dataset as { id: string }).id;
    if (!pluginId) return;

    wx.showLoading({ title: "检查中…" });

    try {
      const res = await wx.cloud.callFunction({
        name: "plugin-manage",
        data: { action: "unlock", pluginId },
      });

      const result = res.result as {
        ok: boolean;
        unlocked?: boolean;
        alreadyUnlocked?: boolean;
        progressHint?: string;
        current?: number;
        target?: number;
        error?: string;
      };

      if (!result.ok) {
        throw new Error(result.error || "解锁检查失败");
      }

      // 已解锁（历史已解锁 或 本次达标解锁）
      if (result.unlocked || result.alreadyUnlocked) {
        const plugins = this.data.plugins.map((p) => {
          if (p.id === pluginId) {
            return { ...p, unlocked: true, enabled: true };
          }
          return p;
        });
        this.setData({ plugins });
        wx.showToast({ title: "已解锁", icon: "success" });
        return;
      }

      // 未达标 —— 显示当前进度
      const hint =
        result.progressHint || "条件未满足";
      const detail =
        result.current !== undefined && result.target !== undefined
          ? ` (${result.current}/${result.target})`
          : "";
      wx.showToast({
        title: `${hint}${detail}`,
        icon: "none",
        duration: 2500,
      });
    } catch (err) {
      console.error("[plugin-manage] 解锁失败", err);
      wx.showToast({ title: "操作失败，请重试", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  // ── 启用/禁用切换 ─────────────────────────────────────────

  /**
   * switch 组件 change 事件。
   * 调用云函数 toggle 操作，成功后刷新全局 plugin-store 缓存。
   */
  async onToggle(e: WechatMiniprogram.SwitchChange) {
    const pluginId = (e.currentTarget.dataset as { id: string }).id;
    const enabled = e.detail.value;
    if (!pluginId) return;

    // 防止重复点击（API 调用期间禁用开关）
    const plugin = this.data.plugins.find((p) => p.id === pluginId);
    if (!plugin || plugin.toggling) return;

    // 先设置 toggling 为 true，阻断后续点击
    this._setPluginToggling(pluginId, true);

    try {
      const res = await wx.cloud.callFunction({
        name: "plugin-manage",
        data: { action: "toggle", pluginId, enabled },
      });

      const result = res.result as {
        ok: boolean;
        enabled?: boolean;
        error?: string;
      };

      if (!result.ok) {
        throw new Error(result.error || "切换失败");
      }

      // 成功后更新卡片状态
      this._updatePluginEnabled(pluginId, result.enabled ?? enabled);

      // 刷新全局插件缓存
      await loadPluginStore();
    } catch (err) {
      console.error("[plugin-manage] 切换失败", err);

      // 回滚 switch 视觉状态
      this._updatePluginEnabled(pluginId, !enabled);
      wx.showToast({ title: "操作失败，请重试", icon: "none" });
    } finally {
      this._setPluginToggling(pluginId, false);
    }
  },

  // ── 辅助方法 ──────────────────────────────────────────────

  /** 设置单个插件的 toggling 状态 */
  _setPluginToggling(pluginId: string, toggling: boolean) {
    const plugins = this.data.plugins.map((p) => {
      if (p.id === pluginId) {
        return { ...p, toggling };
      }
      return p;
    });
    this.setData({ plugins });
  },

  /** 更新单个插件的 enabled 状态 */
  _updatePluginEnabled(pluginId: string, enabled: boolean) {
    const plugins = this.data.plugins.map((p) => {
      if (p.id === pluginId) {
        return { ...p, enabled };
      }
      return p;
    });
    this.setData({ plugins });
  },

  // ── 下拉刷新 ──────────────────────────────────────────────

  onPullDownRefresh() {
    this._fetchPlugins().finally(() => {
      wx.stopPullDownRefresh();
    });
  },
});
