# 08 — Group Manage Switcher

**What to build:** 厨房管理子页面顶部增加厨房切换器组件，使用户在管理厨房时也能快速切换当前活跃厨房。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `group-manage` 页面 WXML 顶部添加 `<group-switcher>` 组件，props 与所有 tab 页一致：`groups`、`active-group-id`、`openid`
- [ ] 绑定 `bind:change` 处理切换事件，设置 `activeGroupId` 并重新加载群组管理数据（成员列表、群组名等）
- [ ] 绑定 `bind:create` 处理新建厨房事件，导航到创建厨房页面
- [ ] 切换厨房后，`group-manage` 页面展示的成员列表和群组信息跟随当前厨房更新
- [ ] `group-switcher` 组件本身无需任何修改——复用现有逻辑和能力
