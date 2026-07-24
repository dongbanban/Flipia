# 14-splash-prefetch: Splash 预取首页数据，消除 splash→首页空白过渡

**Status:** done
**Created:** 2026-07-24
**Blocked by:** 13-refactor-splash-loading
**Spec:** `spec.md#splash-预取首页数据`

---

## 范围

Splash 页面通过 `switchTab` 跳转到首页后，存在 splash loading → 首页空白 → 首页 loading → 首页内容的四段过渡。空白段是因为首页 `onLoad`/`onShow` 在 `loadingConfig: true` 到 `<loading-card>` 组件渲染之间存在渲染间隙。

在 splash 的 1s 延迟期间并行预取首页所需数据（`user_config` + `dishes` + `draw_history`），通过 `wx.setStorageSync` 传递给首页。首页 `onLoad` 检测到预取数据后直接恢复页面状态并跳过加载态。

## 改动清单

- `constants/storage-keys.ts` — 新增 `HOME_PREFETCH_KEY` 常量
- `pages/splash/index.ts` — `onShow` 中启动 `_prefetchHomeData()` 与 1s 延迟并行，预取结果写入 storage
- `pages/index/index.ts` — `onLoad` 检测 storage 中的预取数据，命中则直接恢复状态；`onShow` 通过 `_prefetched` 标志跳过重复加载

## 代码量变化

| 文件 | 前 (行) | 后 (行) |
|------|---------|---------|
| `constants/storage-keys.ts` | 10 | 13 |
| `pages/splash/index.ts` | 16 | 133 |
| `pages/index/index.ts` | 452 | 499 |

## 验证

- [x] Splash 页面展示 loading-card 动画期间，首页数据静默预取
- [x] 跳转到首页后直接展示内容（无中间空白、无二次 loading-card）
- [x] 预取失败时（网络异常等）首页降级为自行加载，不影响正常使用
- [x] 通过 `wx.setStorageSync` 传递数据，不污染 `globalData`
- [x] 直接进入首页（非 splash 路由）时不受影响

## Comments

`6f94cea` — refactor: splash 预取缓存改用 wx.setStorageSync，移除 globalData 依赖
`7b34510` — feat: splash 预取首页数据，消除 splash→首页加载过渡中的空白
