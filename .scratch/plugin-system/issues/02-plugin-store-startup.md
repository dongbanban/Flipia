# 02 — plugin-store 缓存模块 + 启动集成

**What to build:** 小程序启动后，各页面可通过 `plugin-store` 查询任意插件的启用状态，目标页面的 `wx:if` 据此正确控制插件组件的渲染与否。

**Blocked by:** 01 — plugin-manage 云函数

**Status:** done

- [x] 创建 `plugin-store` 模块，暴露 `load()` 和 `isEnabled(id)` 方法
- [x] `load()` 在小程序启动时由 `app.ts` 调用，调 `plugin-manage` 的 `list` 获取启用状态
- [x] `isEnabled(id)` 返回对应插件是否已启用（未加载完返回 `false`）
- [x] `load()` 失败时提示用户刷新（不静默降级）
- [x] 编写单元测试：模拟云函数返回，验证 `isEnabled` 查询正确
- [x] 不继承 westore Store——独立轻量缓存模块

## Comments

`21429eb` — 创建 `miniprogram/stores/plugin-store.ts`（独立缓存模块，不继承 westore），在 `app.ts` `_initApp()` 中调用 `loadPluginStore()`，新增 11 个单元测试（全部通过）。
