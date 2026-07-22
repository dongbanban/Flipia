# 02 — 资料设置页底部按钮重构

Status: resolved

## 改动

将底部按钮从「跳过 / 确认」改为「使用微信信息 / 确认」。

### WXML

- 头像区域从 `<button open-type="chooseAvatar">` 改为 `<view class="avatar-display">`（仅展示）
- 「使用微信信息」按钮附带 `open-type="chooseAvatar" bindchooseavatar="onChooseAvatar"`，点击触发 WeChat 原生头像选择器
- 昵称 `<input>` 添加 `focus="{{nicknameFocus}}"` 和 `bindblur="onNicknameBlur"` 用于顺序引导后的自动获焦
- 底部按钮行：纵向排列，「使用微信信息」在上 +「创建」在下（文案从「确认」改为「创建」，体现最后步骤语义）

### WXSS

- `.avatar-btn` → `.avatar-display`（移除 `:active` 交互态、`::after` 覆盖）
- `.btn--skip` → `.btn--wechat`：实心主按钮（`background: var(--color-primary); color: #fff`）
- `.btn--confirm`：改为描边次按钮（`background: transparent; border: 2rpx solid var(--color-primary)`），文案为「创建」
- `.btn-row`：`flex-direction: column`（纵向排列），`.btn` 从 `flex: 1` 改为 `width: 100%`

### TS

- `data` 新增 `nicknameFocus: false`
- `onChooseAvatar` 选取头像后 `wx.nextTick` 设 `nicknameFocus: true` 自动获焦昵称输入框
- 新增 `onNicknameBlur` 重置 `nicknameFocus: false`
- 保留 `onSkip` 方法（UI 不再调用，作为备用逻辑）

### 交互流程

点击「使用微信信息」→ WeChat 原生头像选择器 → 选取头像后昵称输入框自动获焦 → WeChat 键盘上方展示昵称建议 → 确认或输入 → 点击「创建」保存。

## Comments
