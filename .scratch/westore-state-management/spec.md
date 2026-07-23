# Spec: Westore 状态管理重构

**Status:** `ready-for-agent`

## 问题陈述

Flipia 当前使用 `app.globalData` + 手动 `onShow` 同步管理跨页面共享状态。10 个页面全部依赖在各自 `onShow` 中从 `globalData` 重新读取当前群组、用户资料等上下文，没有订阅/通知机制。写操作直接篡改 `globalData` 对象内嵌字段，各页面持有潜在过期引用。群组切换、资料修改等变更无法自动通知关联页面刷新。

## 解决方案

引入 westore（腾讯开源的小程序状态管理库）作为会话状态管理器。建立 `UserStore` 和 `GroupStore` 两个 Store，替代 `globalData` 中的用户资料字段和群组会话字段。页面通过 westore 的 `create()` 绑定自动订阅 Store 更新，不再需要在 `onShow` 中手动同步。

## 用户故事

1. 切换当前厨房后，首页和菜品池自动展示新厨房的数据，不需要手动刷新
2. 在"我的"页面修改头像/昵称后，首页头像区域自动更新
3. 创建新厨房后，群组切换器自动出现新厨房选项，可以立即切换
4. 退出/解散厨房后，群组列表自动移除该厨房，不会看到无效选项
5. 首次登录设置资料后，立即进入首页，不需要重启小程序
6. 关闭小程序后重新打开，仍记住上次使用的厨房
7. 切换厨房后，记住该厨房的生效抽取方案，抽取规则跟着厨房走
8. 菜品池页在厨房数据就绪前显示 loading 态，不显示空白或错误
9. 群组状态变更集中在 `GroupStore` 方法内，不在各页面散落 `onShow` 样板代码
10. 用户资料变更集中在 `UserStore` 方法内，修改个人资料的页面不需要手动写 `globalData` 同步

## 实现决策

### 架构

1. **引入 westore** — `npm install westore`，使用其 `Store` 基类和 `create()` 页面绑定。
2. **两个 Store** — `UserStore.data`：`nickName`, `avatarUrl`, `needProfileSetup`；`GroupStore.data`：`groupId`, `groups`, `activeConfigId`, `lastDrawnConfigId`。
3. **Store 实例化** — 独立文件 `stores/index.ts` 导出模块级单例常量 `userStore` 和 `groupStore`，不挂载在 `App` 实例上。
4. **Store 职责边界** — Store 仅管理运行时会话状态，不缓存云数据库内容。菜品、分类、历史等数据仍由各页面直接查询云数据库。
5. **Storage 持久化封装在 Store 方法内**：
   - `GroupStore.switchGroup(groupId)` — 写内存 + `wx.setStorageSync('flipia_active_group_id')`
   - `GroupStore.setActiveConfig(configId)` — 写内存 + `wx.setStorageSync('flipia_active_config_id')`
   - `GroupStore.setLastDrawnConfig(configId)` — 写内存 + `wx.setStorageSync('flipia_last_drawn_config_id')`
6. **app.ts 引导流程不变** — `_initApp()` 保留云函数登录取 `openid`、查用户资料、查群组列表的逻辑，写入目标从 `globalData` 改为 Store 字段 + `store.update()`。
7. **`openid` 留在 `app.globalData`** — 登录常量，不需要响应式机制。各页面继续通过 `getApp().globalData.openid` 读取。
8. **页面绑定模式** — 每页使用 `create(store, { ... })` / `create({ stores: [...] }, { ... })` 替换 `Page({ ... })`。仅绑定该页需要的 Store：需要群组上下文的页面（首页、菜品池、历史、分类管理、方案管理、群组创建、群组管理）绑定 `GroupStore`；需要用户资料的页面（资料设置、我的、首页）绑定 `UserStore`；splash 不绑，通过 `store.data.xxx` 直接读。
9. **`whenReady()` 仅 splash 保留** — 其他 9 个页面删除 `await app.whenReady()`，依赖 Store 响应式更新在数据就绪后自动刷新。
10. **迁移策略：一刀切** — 删除除 `openid` 外的所有 `globalData` 读写，Store 一次性接管全部会话状态。不保留双写过渡期。

### 状态修改契约

Store 数据修改通过 Store 实例方法进行（不直接修改 `.data` 后裸调 `.update()`）：

- `UserStore.setProfile(nickName, avatarUrl)` — 设置资料，清除 `needProfileSetup`
- `UserStore.skipProfileSetup()` — 跳过资料设置
- `GroupStore.switchGroup(groupId)` — 切换活跃群组
- `GroupStore.setGroups(groups)` — 替换群组列表
- `GroupStore.setActiveConfig(configId)` — 设置生效抽取方案
- `GroupStore.setLastDrawnConfig(configId)` — 记录上次抽取方案

### 移除内容

- `app.globalData` 中除 `openid` 外的全部字段
- `app.switchGroup()` 方法（逻辑移入 `GroupStore`）
- splash 以外所有页面中的 `await app.whenReady()`
- 所有页面中对 `globalData.nickName/avatarUrl/groupId/groups/needProfileSetup` 的读写
- 方案管理页和首页中直接操作 config ID Storage 的代码（移入 `GroupStore`）

## 测试决策

### Seam: 页面级行为不变

唯一验证点：重构后所有页面在相同云数据下行为与重构前一致。

**验证方式：**

1. 逐页面启动，确认 data 字段渲染正确（群组信息、用户头像昵称、方案标识等）
2. 执行关键用户操作路径，确认行为一致：切换群组 → 首页和菜品池跟随切换；修改头像/昵称 → 首页和"我的"页同步更新；创建/加入/退出/解散群组 → 群组列表正确更新；标记生效方案 → 首页抽取按钮使用正确方案
3. 冷启动，确认上次选择的群组和方案正确恢复
4. 首次登录（无用户资料）→ splash → 资料设置 → 首页流程正常

**测试先例：** 当前项目无自动化测试覆盖（`services/` 目录仅有 `.gitkeep`）。手工逐页回归是唯一可行的验证方式。

## 不予纳入

- 不修改任何云函数
- 不修改 `lib/` 目录下的纯函数模块（尚未引用 `globalData`）
- 不修改组件（`components/` 目录未引用 `globalData`）
- 不引入其他状态管理库
- 不重构页面自身的数据获取逻辑（菜品列表、历史记录等仍由页面直接查云数据库）
- 不创建自动化测试
- 不迁移 `openid` 到 Store
- 不改变 UI 布局、样式、交互

## 补充说明

- westore 基于 `deepClone + dataDiff` 生成最小 `setData` 补丁，相比全量 `setData` 在复杂页面可能带来渲染性能提升
- `lib/` 目录的 13 个模块不引用 `globalData`，属于纯函数层，重构无需触及——这是一个架构边界优势
- ADR 0006 记录了本次重构的完整背景和备选方案权衡
- 重构完成后应将 `globalData` 类型定义简化为仅包含 `openid`
