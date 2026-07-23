# 03 — 全部 10 页迁移到 Store 绑定

**What to build:** 所有页面从 `Page()` 转为 westore 的 `create()/create({ stores })` 绑定模式。删除 `globalData` 读写（`openid` 除外）和 `onShow` 同步逻辑。`whenReady()` 仅 splash 保留。页面行为与重构前完全一致。

**Blocked by:** 02 — App 引导层双写 wiring

**Status:** ready-for-agent

- [ ] **splash**：不绑任何 Store，通过 `userStore.data.needProfileSetup` 直接读，保留 `await app.whenReady()` 决定路由
- [ ] **首页**：绑定 `GroupStore` + `UserStore`，删除 `globalData` 读写和 `onShow` 同步，config ID 读写改为 `groupStore.setActiveConfig/setLastDrawnConfig`
- [ ] **菜品池**：绑定 `GroupStore`，删除 `globalData` 读写和 `onShow` 同步
- [ ] **历史**：绑定 `GroupStore`，删除 `globalData` 读写和 `onShow` 同步
- [ ] **分类管理**：绑定 `GroupStore`，删除 `globalData` 读写和 `onShow` 同步
- [ ] **方案管理**：绑定 `GroupStore`，删除 `globalData` 读写和 `onShow` 同步，config ID Storage 读写改为 `groupStore.setActiveConfig/.setLastDrawnConfig`
- [ ] **群组创建**：绑定 `GroupStore`，创建成功后改为 `groupStore.setGroups()`，删除 `globalData` 读写
- [ ] **群组管理**：绑定 `GroupStore`，成员变更（踢人/退出/解散/加入）后改为 `groupStore.setGroups()` + `groupStore.switchGroup()`（如需），删除 `globalData` 读写
- [ ] **资料设置**：绑定 `UserStore`，确认后改为 `userStore.setProfile()`，跳过改为 `userStore.skipProfileSetup()`，删除 `globalData` 读写
- [ ] **我的**：绑定 `UserStore`，修改头像/昵称后改为 `userStore.setProfile()`，删除 `globalData` 读写
- [ ] 所有非 splash 页面删除 `await app.whenReady()` 调用
- [ ] 编译通过，逐页启动数据正确，关键操作路径（切群组、改资料、创建/加入/退出/解散群组、标记方案）行为一致
