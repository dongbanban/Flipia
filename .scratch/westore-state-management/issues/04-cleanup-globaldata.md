# 04 — 清理 globalData 残余

**What to build:** 删除 `app.globalData` 中除 `openid` 外的全部字段，删除 `app.switchGroup()` 方法，精简相关 TypeScript 类型定义。全路径回归确认无残留引用。

**Blocked by:** 03 — 全部 10 页迁移到 Store 绑定

**Status:** done

- [x] 从 `AppGlobalData` 接口中删除 `nickName`、`avatarUrl`、`groupId`、`groups`、`needProfileSetup`
- [x] 从 `app.globalData` 初始值中删除对应字段
- [x] 删除 `app.switchGroup()` 方法（逻辑已在 `GroupStore.switchGroup()` 中）
- [x] 删除 `ACTIVE_GROUP_KEY` 常量（已移入 `GroupStore`）
- [x] 精简 `AppInstance` 接口，移除 `switchGroup` 签名
- [x] 编译通过
- [x] 全路径回归：启动 → 首页 → 菜品池 → 历史 → 我的 → 切群组 → 创建群组 → 管理群组 → 修改资料 → 冷启动恢复，全程无报错

## Comments

1283cae — 清理 globalData 残余：移除 openid 外全部字段，删除 switchGroup() 方法和 ACTIVE_GROUP_KEY 本地常量，精简 AppGlobalData/AppInstance 接口
