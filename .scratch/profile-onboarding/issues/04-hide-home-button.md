# 04 — 隐藏资料设置页导航栏 Home 图标

Status: resolved

## 问题

从 tabBar 页 `wx.redirectTo` 到非 tabBar 页时，WeChat 自动在导航栏左上角显示返回首页图标。资料设置页作为首次引导流程不应显示此入口。

## 修复

`miniprogram/pages/profile-setup/index.ts` — `onLoad` 中加一行：

```ts
wx.hideHomeButton();
```

API 自基础库 2.8.3 起支持，隐藏后仅当调用 `wx.showHomeButton()` 才恢复。

## Comments
