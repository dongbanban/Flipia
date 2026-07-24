<!--
 * @file: /Users/i104/Flipia/.scratch/plugin-system/issues/01-plugin-manage-cloud-function.md
 * @author: dongyang
-->

# 01 — plugin-manage 云函数（含全部操作）+ 测试

**What to build:** 用户调用 `plugin-manage` 云函数后，可以查询插件列表及个人解锁/启用状态、触发插件解锁条件校验、切换插件启用/禁用。一个占位测试插件验证整条链路。

**Blocked by:** None — can start immediately

**Status:** done

- [x] `plugin-manage` 云函数支持三种 `action`：`list`、`unlock`、`toggle`
- [x] 云函数内含一个占位插件定义（`id`、`name`、`description`、`assess` 函数），用于验证链路
- [x] `list` 返回：插件定义列表 + 用户插件状态 + 未解锁插件的评估进度（`progressHint`、`current`、`target`）
- [x] `list` 首次调用时自动创建 `user_plugin` 文档（全 locked + 全 disabled）
- [x] `list` 检测到文档中缺失新插件条目时自动补初始化条目
- [x] `unlock` 对指定插件运行 `assess` 评估函数。通过则写入 `unlocked: true, enabled: true`；不通过返回进度信息，不修改状态
- [x] `unlock` 对已解锁插件幂等（重复调用不报错）
- [x] `toggle` 仅对 `unlocked: true` 的插件写入 `enabled` 字段
- [x] `toggle` 对 locked 插件返回拒绝
- [x] `list` 检测到废弃插件（不在 defs 中）时自动从文档中清理
- [x] `assess` 中数据库查询失败时返回错误，不进行部分评估
- [x] 编写 tests：覆盖 list（新用户/已有用户/废弃清理）、unlock（达标/不达标/幂等）、toggle（locked 拒绝/unlocked 写入/不存在的插件报错）

## Comments

- `4fd9548` — 实现 plugin-manage 云函数（list/unlock/toggle）+ 完整测试。架构已解耦：plugin-registry.js 声明插件，custom-handlers/ 下各插件自带 assess(db, openid)。252 测试全绿。
