# 04 — 清理 globalData 残余

**What to build:** 删除 `app.globalData` 中除 `openid` 外的全部字段，删除 `app.switchGroup()` 方法，精简相关 TypeScript 类型定义。全路径回归确认无残留引用。

**Blocked by:** 03 — 全部 10 页迁移到 Store 绑定

**Status:** ready-for-agent

- [ ] 从 `AppGlobalData` 接口中删除 `nickName`、`avatarUrl`、`groupId`、`groups`、`needProfileSetup`
- [ ] 从 `app.globalData` 初始值中删除对应字段
- [ ] 删除 `app.switchGroup()` 方法（逻辑已在 `GroupStore.switchGroup()` 中）
- [ ] 删除 `ACTIVE_GROUP_KEY` 常量（已移入 `GroupStore`）
- [ ] 精简 `AppInstance` 接口，移除 `switchGroup` 签名
- [ ] 编译通过
- [ ] 全路径回归：启动 → 首页 → 菜品池 → 历史 → 我的 → 切群组 → 创建群组 → 管理群组 → 修改资料 → 冷启动恢复，全程无报错
