# 10 — 新增 Splash 页面，前置路由判断

Status: resolved

## 问题

老用户打开小程序时仍会短暂看到 profile-setup 页的 loading spinner，然后才 `switchTab` 到首页。路由判断在页面渲染之后才执行。

## 修复

新增 `pages/splash/index` 作为 app 启动页（`app.json` 首位），在新/老用户判定完成前不跳转任何业务页面。

### Splash 页面

- `navigationStyle: "custom"` — 隐藏导航栏，全屏动画
- 卡片 3D 翻转动画：正面 Flipia 品牌字，背面圆点脉冲 loading
- `onReady()` 启动翻转动画，`onShow()` 中 `await app.whenReady()` 后分支：
  - `needProfileSetup` → `wx.redirectTo("/pages/profile-setup/index")`
  - 否则 → `wx.switchTab("/pages/index/index")`

### Profile-setup 清理

- 移除 `ready` 数据守卫和 loading spinner (WXML / WXSS)
- 移除 `needProfileSetup` 分支路由逻辑（已由 splash 处理）
- `onLoad` 简化为仅 `wx.hideHomeButton()` + `await whenReady()`（幂等调用，瞬间完成）

### 效果

- 老用户：看到 splash 卡片翻转动画 → `switchTab` 进入首页，从未见到资料设置页
- 新用户：splash 卡片翻转动画 → `redirectTo` 进入资料设置页

## 涉及文件

| 文件 | 操作 |
|------|------|
| `pages/splash/index.json` | 新增 |
| `pages/splash/index.wxml` | 新增 |
| `pages/splash/index.ts` | 新增 |
| `pages/splash/index.wxss` | 新增 |
| `miniprogram/app.json` | pages 首位改为 `pages/splash/index` |
| `pages/profile-setup/index.ts` | 移除 `ready` 数据和路由分支 |
| `pages/profile-setup/index.wxml` | 移除 loading guard 包裹 |
| `pages/profile-setup/index.wxss` | 移除 loading spinner 样式 |

## Comments
