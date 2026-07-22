# 08 — Splash 页面 whenReady 后延迟 500ms 再跳转

**What to build:** 在 `pages/splash/index.ts` 的 `onShow()` 中，`await app.whenReady()` 之后增加 500ms 延迟，再执行路由跳转，作为启动 banner 展示效果。

**Blocked by:** 无 — 可立即开始。

**Status:** done

- [x] `pages/splash/index.ts` 第 17 行 `await app.whenReady()` 之后插入 `await new Promise(r => setTimeout(r, 500))`
- [x] 路由分支逻辑（`needProfileSetup` 判断 + `redirectTo` / `switchTab`）保持不变，仅在其前增加延时
- [x] 在微信开发者工具中验证：Splash 卡片翻转动画后停留约 0.5s 再跳转到后续页面

## Context

当前 splash 页面 `onShow()` 流程：
```
// miniprogram/pages/splash/index.ts:16-24
async onShow() {
  await app.whenReady();
  // ← 在此插入 500ms delay
  if (app.globalData.needProfileSetup) {
    wx.redirectTo({ url: "/pages/profile-setup/index" });
  } else {
    wx.switchTab({ url: "/pages/index/index" });
  }
}
```

`whenReady()` 是事件驱动的（`onLaunch` 中 `_initApp()` 完成即 resolve），无内置延迟。在 quick-login 场景下，`whenReady()` 可能在 splash 卡片翻转动画中途就 resolve，导致用户看不到完整动画。

增加 500ms 固定延迟后，用户在 splash 页面的视觉停留时间得到保证，卡片翻转动画有充足时间展示。

## 涉及文件

| 文件 | 操作 |
|------|------|
| `pages/splash/index.ts` | `onShow()` 中插入 500ms `setTimeout` Promise 延迟 |

## Comments

