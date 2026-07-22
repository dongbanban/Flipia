# 05 — 调研：wx.getUserProfile / agreePrivacyAuthorization 能否替代 chooseAvatar

Status: resolved
Type: research

## 调研背景

用户期望像其他小程序一样，底部弹出确认 modal 获取微信头像和昵称，而非手动选取。考察两个候选方案：

### 1. wx.getUserProfile

- 官方文档仍保留，但**基础库 2.27.1+ 已回收**
- 不弹出授权窗口，直接返回「微信用户」+ 灰头像
- 即使隐私协议审核通过、`needAuthorization: false`，行为不变
- 开放社区大量开发者确认：仅旧版微信（<2.27.1）或调整生效前发布的小程序版本可用

### 2. agreePrivacyAuthorization 组合 getUserInfo

- `open-type="getUserInfo|agreePrivacyAuthorization"` 可一次完成隐私授权 + 获取信息
- 但 `getUserInfo` 同样已废弃，行为与 `getUserProfile` 一致 → 返回匿名数据
- 不会弹出「身份选择器 UI」

## 结论

两个方案均不可用。当前唯一官方支持的获取头像/昵称方式：

- `<button open-type="chooseAvatar">` → `bindchooseavatar` 回调获取头像临时路径
- `<input type="nickname">` → 键盘上方展示微信昵称建议

`agreePrivacyAuthorization` 仅作为隐私合规流程的权限开关使用，与头像获取无关。

## 参考

- [头像昵称填写](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html)
- [wx.getUserProfile 调整公告](https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01)
- [隐私协议开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)

## Comments
