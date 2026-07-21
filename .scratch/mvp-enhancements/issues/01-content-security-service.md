# 01 — Content Security Service

**What to build:** 新增内容安全基础设施——一个云函数和一个客户端 lib，封装微信官方的文本安全、URL 检测和图片安全审核能力。此 ticket 不涉及任何页面修改，仅搭建好可调用的服务层。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 新增云函数 `content-security`，`main` 方法接收 `{action, content}`，action 为 `'textCheck'` 时依次调用 `cloud.openapi.security.msgSecCheck` 和 `urlSecCheck`，返回 `{pass, reason}`
- [ ] 新增客户端模块 `lib/content-security.ts`，暴露 `checkText(text)` 方法（调用云函数 `content-security` 的 `textCheck` action），返回 `{pass, reason}`
- [ ] 新增 `lib/content-security.ts` 暴露 `checkImage(tempFilePath)` 方法，直接在小程序端调用 `wx.security.imgSecCheck`，返回 `{pass, reason}`
- [ ] `checkText` 对空字符串直接返回 `{pass: true}`，不浪费 API 调用
- [ ] 云函数 `textCheck` 中 `urlSecCheck` 传入 `{action: 'open-url', url: extractUrls(text)}`，从文本中提取所有 URL 逐个检测；若不包含 URL 则跳过此步骤
- [ ] `checkImage` 检测前校验图片格式为 jpg/png/bmp/gif 且大小 ≤ 1MB，不满足时返回 `{pass: false, reason: '图片格式不支持或过大'}`
