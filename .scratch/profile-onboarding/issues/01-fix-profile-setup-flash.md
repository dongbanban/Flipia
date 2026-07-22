# 01 — 修复资料设置页首次打开闪退 & 首页闪现

Status: resolved

## 问题

手机打开小程序后，资料设置页一闪即逝。初次修复（index 前移 + `wx.redirectTo`）仍有首页闪现：`redirectTo` 异步期间 `hideLoading` 先触发。

## 最终修复

### app.ts
- 去掉 `wx.showLoading`/`wx.hideLoading` 的全局 loading 遮罩
- 去掉 `.then()` 中的 `redirectTo`/`switchTab` 导航逻辑
- `onLaunch` 仅完成 `_initApp()` → resolve `_ready`，由各页面自行判断路由

### app.json
- `pages/profile-setup/index` 回归首位

### profile-setup 页面自路由
- `onLoad` 变为 `async`：`await app.whenReady()` 后分支：
  - `needProfileSetup === false` → `wx.switchTab` 到首页（老用户无感）
  - `needProfileSetup === true` → 设 `ready: true`，渲染表单
- WXML 添加 `wx:if="{{!ready}}"` loading spinner 守卫，init 完成前不展示表单

### 效果
- 新用户：无中间跳转，spinner 短暂旋转后直接展示资料设置表单
- 老用户：spinner 短暂旋转后 `switchTab` 进入首页

## Comments
