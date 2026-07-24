/**
 * 插件启用状态缓存模块。
 *
 * 在 app.ts 启动时调用 load() 从 plugin-manage 云函数获取当前用户的
 * 插件启用状态并缓存在内存中，供页面 WXML 的 wx:if 绑定查询。
 *
 * 注意：本模块不继承 westore Store —— 它是一个独立的轻量缓存，
 * 不参与 westore 的 setData 更新周期。
 */

import { CLOUD } from "@/config";

/** 插件启用状态缓存：pluginId → enabled */
const enabledMap = new Map<string, boolean>();

/** 是否已成功加载 */
let loaded = false;

/**
 * 从小程序云函数加载当前用户的插件启用状态。
 * 应在 app.ts 的 _initApp() 中调用，不阻塞主初始化流程。
 *
 * 失败时弹出提示框告知用户刷新，不静默降级。
 */
export async function load(): Promise<void> {
  try {
    const res = await wx.cloud.callFunction({
      name: "plugin-manage",
      data: { action: "list" },
    });

    const result = res.result as {
      ok: boolean;
      plugins?: Array<{ id: string; enabled: boolean }>;
      error?: string;
    };

    if (!result.ok || !result.plugins) {
      throw new Error(result.error || "插件列表为空");
    }

    enabledMap.clear();
    for (const plugin of result.plugins) {
      enabledMap.set(plugin.id, plugin.enabled);
    }
    loaded = true;
  } catch (err) {
    console.error("[plugin-store] 加载失败", err);
    wx.showModal({
      title: "加载失败",
      content: "插件状态加载失败，请下拉刷新重试",
      showCancel: false,
      confirmText: "知道了",
      confirmColor: "#c8815e",
    });
    // 不静默降级：loaded 保持 false，isEnabled 始终返回 false
  }
}

/**
 * 查询插件是否已启用。
 * 缓存未加载或插件 ID 不存在时返回 false。
 *
 * @param id - 插件 ID
 * @returns 插件是否已启用
 */
export function isEnabled(id: string): boolean {
  if (!loaded) return false;
  return enabledMap.get(id) ?? false;
}
