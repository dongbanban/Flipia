# 01 — Content Security Service

**What to build:** 新增内容安全基础设施——一个云函数和一个客户端 lib，封装微信官方的文本安全、URL 检测和图片安全审核能力。此 ticket 不涉及任何页面修改，仅搭建好可调用的服务层。

**Blocked by:** None — can start immediately.

**Status:** done

- [x] 新增云函数 `content-security`，`main` 方法接收 `{action, content}`，action 为 `'textCheck'` 时依次调用 `cloud.openapi.security.msgSecCheck` 和 URL 过滤，返回 `{pass, reason}`
- [x] 新增客户端模块 `lib/content-security.ts`，暴露 `checkText(text)` 方法（调用云函数 `content-security` 的 `textCheck` action），返回 `{pass, reason}`
- [x] 新增 `lib/content-security.ts` 暴露 `checkImage(tempFilePath)` 方法，通过云函数 `imageCheck` action 调用 `cloud.openapi.security.imgSecCheck`，返回 `{pass, reason}`
- [x] `checkText` 对空字符串直接返回 `{pass: true}`，不浪费 API 调用
- [x] 云函数 `textCheck` 中用自定义 URL 正则过滤替代 `urlSecCheck`（该 API 不存在），命中即返回 `{pass: false, reason: '文本包含链接'}`
- [x] `checkImage` 检测前校验图片格式为 jpg/png/bmp/gif 且大小 ≤ 1MB，不满足时返回 `{pass: false, reason: '图片格式不支持或过大'}`

## Comments

- `179f54f` — feat: add content-security cloud function and client lib
- **API 偏差说明：** 微信平台不存在 `security.urlSecCheck` 和客户端 `wx.security.imgSecCheck`。URL 检测改用自定义正则过滤器；图片检测改为客户端读 Buffer → 云函数调用 `security.imgSecCheck`。
- **技术债：** `imgSecCheck` 已于 2021 年 9 月被标记废弃，官方推荐 `mediaCheckAsync`（异步接口）。代码中留有 TECH DEBT 注释，后续可迁移。
