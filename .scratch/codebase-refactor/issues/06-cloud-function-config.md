# 06 — 云函数 hardcode 收敛

**What to build:** 在云函数目录下各建 `config.js`，收敛当前散落的 hardcode。不修改云函数业务逻辑。

**Blocked by:** 无 — 可立即开始。

**Status:** done

- [x] `cloudfunctions/group-manage/config.js`：收敛 `MAX_MEMBERS`（厨房最大人数）、`INVITE_CODE_LENGTH`（邀请码长度）、`GROUP_NAME_MAX_LENGTH`（厨房名最大长度）、`MAX_LIMIT`（查询上限）
- [x] `cloudfunctions/group-manage/index.js` 中的 hardcode 替换为 `require('./config')` 引用
- [x] `cloudfunctions/content-security/` 中若有散落 hardcode 一并收敛到本地 `config.js`
- [x] 其他云函数（login、content-security-callback）hardcode 极少，视实际情况决定是否需要 config.js
- [x] 替换前后的值完全一致
- [x] 云函数部署后行为不变（功能级别验证）

## Comments

`426e850` — 在 group-manage、content-security、content-security-callback 三目录下各建 config.js，收敛散落 hardcode。login 仅 8 行无应用级配置，无需 config.js。所有值与原值完全一致，无业务逻辑变更。
