# 07 — 简化 needProfileSetup 判定 + 昵称必填校验

Status: resolved

## 改动

### `needProfileSetup` 简化（`app.ts`）
- 移除自动昵称正则检测 `/^用户[a-z0-9]{6}$/`
- `needProfileSetup` 仅在 DB 无用户记录时设为 `true`
- DB 有记录 → 无论内容如何，视为已完成设置

### 昵称必填（`profile-setup/index.ts`）
- `onConfirm` 校验：`!trimmedNick` → toast "请输入昵称"
- 头像变为可选
- 新增 `canConfirm` 数据属性，`onNickInput` 实时更新 `nickName.trim().length > 0`
- WXML：`disabled="{{!canConfirm}}"` 驱动按钮状态
- WXSS：`.btn--confirm[disabled] { opacity: 0.35 }`

### 移除 `isDefaultNickname` 函数
- 不再使用，从 `profile-setup/index.ts` 中删除

## Comments
