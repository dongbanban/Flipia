# 03 — 提取 sanitizeInput() 和 showConfirm() 工具函数并迁移调用方

**What to build:** 创建 `sanitizeInput()` 和 `showConfirm()` 两个工具函数，替换所有页面中重复的文本安全校验样板代码和 wx.showModal confirmColor 硬编码。

**Blocked by:** 01（`sanitizeInput` 需要从 `LIMITS` 读取长度限制；`showConfirm` 无依赖但逻辑上同批产出）

**Status:** done

- [x] 创建 `sanitizeInput()` 函数：接收 `{ value, maxLength, fieldName, showToast }` 参数，串行执行 trim → 长度校验 → content-security 审核，返回 `{ valid, value }`。校验失败时内部 toast
- [x] 创建 `showConfirm()` 函数：接收 `{ title, content, confirmText, cancelText }`，内部调用 `wx.showModal` 并预设 confirmColor，返回 `Promise<boolean>`
- [x] 替换所有页面中调用 `checkTextWithToast` 处的硬编码长度（分类名 10、菜品名 20、方案名 100、厨房名 12 等），改为从 `LIMITS` 读取后传入 `sanitizeInput()`
- [x] 替换所有 `wx.showModal({ confirmColor: '#c8815e', ... })` 调用为 `showConfirm(...)`（约 11 处）
- [x] 保留 toast 提示文案在各页面（不迁入 config），只消除长度和安全的样板
- [x] `pnpm test` 全部通过
