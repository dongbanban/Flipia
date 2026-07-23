# ADR 0006: 引入 Westore 管理会话状态

**日期:** 2026-07-23
**状态:** Accepted

## 背景

Flipia 是一个 10 页的原生微信小程序。当前所有跨页面共享状态存放在 `app.globalData` 中（6 个字段：`openid`、`nickName`、`avatarUrl`、`groupId`、`groups`、`needProfileSetup`），各页面在每次 `onShow` 中重新读取以实现同步。另有 `activeConfigId`、`lastDrawnConfigId` 两个会话标识通过 `wx.Storage` 读写的逻辑散落在两个页面中。

微信小程序框架本身不提供 `globalData` + `setData` + `Storage` 之外的状态管理机制。社区存在多个方案：`westore`（腾讯开源，4.3k star，MVP 架构）、`mobx-miniprogram`（官方 org 适配版）及若干更小的社区库。

## 决定

引入 **westore** 作为会话状态管理器，建立两个 Store：

- **`UserStore`**：`nickName`、`avatarUrl`、`needProfileSetup`
- **`GroupStore`**：`groupId`、`groups`、`activeConfigId`、`lastDrawnConfigId`

关键架构选择：

1. **Store 仅管理会话状态** — 不作为云数据缓存。云数据库仍是真相源，Store 只持有运行时上下文。页面仍自行查询云数据库获取内容数据（菜品、分类、历史等）。
2. **模块级单例** — `stores/index.ts` 导出 `userStore` 和 `groupStore` 常量实例，不依赖 `getApp()`。
3. **页面通过 `create()` 绑定** — westore 内置模式将 Store 数据合并到页面 data，自动 diff 后执行最小 `setData`。每页仅绑定自身需要的 Store。
4. **一刀切迁移** — 10 个页面一次性切换，不保留 `globalData` 与 Store 双写中间态。
5. **app.ts 保留引导编排角色** — `_initApp()` 保留云查询逻辑，写入目标从 `globalData` 改为 Store。
6. **`openid` 留在 `app.globalData`** — 它是登录时确定的常量，不变，不需要响应式订阅。
7. **Storage 持久化封装在 Store 方法内** — `GroupStore.switchGroup()` 同时写内存和 `wx.setStorageSync`，为冷启动恢复保留最后已知值。
8. **`whenReady()` 仅 splash 页面保留** — splash 需要在渲染前决定路由目的地。其他页面删除 `whenReady()`，依赖 Store 的响应式更新。

## 影响

- **正向**：页面不再需要 `onShow` 同步样板代码。Store 更新通过最小 `setData` diff 自动传播到绑定页面。
- **正向**：状态变更集中在 Store 方法内，不再散落在各页面文件对 `globalData` 的裸写操作中。可追溯性提升。
- **正向**：冷启动通过 Store 初始化从 `wx.Storage` 恢复会话状态，消除了手动 key-scatter 模式。
- **负向**：引入 `westore` npm 依赖。westore 本身成熟（最后一次实质性更新为 2023 年），但未来微信基础库变更可能导致兼容问题。
- **负向**：迁移同时触及全部 10 个页面和 `app.ts`。Store 接线错误会影响整个应用，但风险被重构的机械性降低——本质是将 `getApp().globalData.x` 替换为 Store 绑定的 `this.data.x`，将 `app.globalData.x = y` 替换为 Store 方法调用。
- **中立**：`openid` 仍留在 `app.globalData`。未来如有必要可通过另一个 ADR 迁入 `SessionStore`，但当前通过 `getApp()` 的单例读取模式足够简单，无需改动。

## 备选方案

1. **保持 `globalData` + `onShow`** — 否决。项目已达到 10 页/6 共享字段/多写入点的规模，手动同步的维护成本已超过引入轻量 Store 的成本。
2. **`mobx-miniprogram`** — 否决。MobX 的 `observable`/`action`/`computed` 心智模型对 Flipia 仅 2 个 Store 的拓扑而言过重。westore 的 `Store` 类 + `update()` 模式直接映射到现有 `globalData` 对象模式。
3. **跨平台框架迁移（Taro/uni-app）** — 否决，超出范围。Flipia 在原生框架上稳定运行，框架级迁移属于另一个项目。
