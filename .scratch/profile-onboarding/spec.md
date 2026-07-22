# Profile Onboarding — 首次资料设置流程优化

## 问题

手机打开小程序后，资料设置页一闪即逝，不像其他小程序一样弹出底部确认 modal。

## 根因

初次方案（将 index 前移 + `wx.redirectTo`）仍有两个问题：

1. **首页闪现**：`wx.redirectTo` 异步执行期间 `.finally()` 中的 `wx.hideLoading()` 先触发，致首页短暂可见后跳回资料设置页。
2. **DB 提前写入**：`_ensureUserProfile` 在首次打开时就往 `users` 集合写入了自动生成的昵称记录，应在用户点击「创建」后才写入。

## 决策

### 1. 启动路由 — Splash 页前置判定
- **决定**：新增 `pages/splash/index` 作为 app 启动页（`app.json` 首位）。在新/老用户判定完成前不渲染任何业务页面。
- **Splash 页**：`navigationStyle: "custom"` 隐藏导航栏，展示 3D 卡片翻转动画（正面 Flipia 品牌字，背面圆点脉冲 loading）。`onReady()` 启动动画，`onShow()` 中 `await app.whenReady()` 后分支：
  - `needProfileSetup === true`（新用户）→ `wx.redirectTo("/pages/profile-setup/index")`
  - `needProfileSetup === false`（老用户）→ `wx.switchTab("/pages/index/index")`
- **`app.ts`**：去掉 `wx.showLoading`/`wx.hideLoading`、`redirectTo`/`switchTab`，仅完成 init 后 resolve `_ready`。
- **Profile-setup**：移除 `ready` 守卫、loading spinner、路由分支逻辑。仅 `wx.hideHomeButton()` + 幂等 `await whenReady()`。
- **效果**：新用户 splash 动画后进入资料设置页；老用户 splash 动画后直接首页，**从未见到资料设置页**。
- **效果**：新用户无中间跳转，直接看到资料设置页；老用户只看到加载态瞬间后进入首页。无 `redirectTo` 同页重载，无首页闪现。

### 2. `needProfileSetup` 判定简化
- **决定**：仅在 DB 无该用户记录时设为 `true`。移除自动昵称正则检测（`/^用户[a-z0-9]{6}$/`）。
- **理由**：新流程下 `users` 文档仅在用户点击「创建」时写入，不存在「跳过但留有脏数据」的场景，无需二次校验。

### 3. 用户文档延迟创建
- **决定**：`_ensureUserProfile` 不再调用 `db.collection("users").add()`。`users` 文档仅在 profile-setup 页 `onConfirm`（点击「创建」按钮）时写入。

### 4. 创建校验 — 昵称必填，头像可选
- **决定**：`onConfirm` 校验从「昵称或头像二选一」改为「昵称必填」。`canConfirm` 数据属性实时计算 `nickName.trim().length > 0`，驱动「创建」按钮 `disabled` 状态。

### 5. 页面文案
- 导航栏标题：`完善资料` → `加入 Flipia`
- intro 文字：`设置你的头像和昵称，让家人朋友能认出你` → `创建你的账号，快点加入 Flipia 吧`

### 6. Loading 态
- profile-setup 页 `data.ready` 初始为 `false`，WXML 渲染 loading spinner。`whenReady()` 完成后设 `ready: true` 展示表单。

### 7. 用户信息获取方式
- **调研**：`wx.getUserProfile`（基础库 2.27.1+ 已回收，返回灰头像+"微信用户"）、`agreePrivacyAuthorization` 组合 `getUserInfo`（同上，不会弹出身份选择器 UI）
- **决定**：仅使用官方推荐的 `<button open-type="chooseAvatar">` + `<input type="nickname">`

### 8. 底部按钮布局
- **决定**：纵向排列，「使用微信信息」（实心主按钮，`open-type="chooseAvatar"`）在上 +「创建」（描边次按钮，昵称为空时 disabled）在下
- **流程**：点击「使用微信信息」→ WeChat 原生头像选择器 → 选取后昵称输入框自动获焦 → WeChat 键盘上方展示昵称建议 → 输入昵称后按钮启用 → 点击「创建」保存 → `users` 文档写入

### 9. 头像获取双通道
- 「使用微信信息」按钮：`open-type="chooseAvatar"` → WeChat 原生头像选择器（包含微信头像库，底部也有相册/拍照入口 — 系统 UI，不可定制）
- 头像圆圈：`bindtap` → `wx.chooseMedia({ mediaType: ['image'], sourceType: ['album', 'camera'] })` → 仅拍照/相册，用于自定义头像

### 10. 导航栏 Home 图标
- **决定**：在 profile-setup 页 `onLoad` 中调用 `wx.hideHomeButton()` 隐藏左上角返回首页图标

## 涉及文件

| 文件 | 改动 |
|------|------|
| `miniprogram/app.json` | pages 首位为 `pages/splash/index` |
| `miniprogram/app.ts` | 去掉 `showLoading`/`hideLoading`、`redirectTo`/`switchTab`；`_ensureUserProfile` 仅设 globalData，不写 DB，移除自动昵称正则 |
| `miniprogram/pages/splash/index.json` | 新增：`navigationStyle: "custom"` |
| `miniprogram/pages/splash/index.wxml` | 新增：3D 卡片翻转动画（正面品牌字 + 背面脉冲点） |
| `miniprogram/pages/splash/index.ts` | 新增：`onReady` 启动动画，`onShow` 中 `await whenReady()` 后路由到 profile-setup 或首页 |
| `miniprogram/pages/splash/index.wxss` | 新增：卡片 3D 翻转 + dot pulse 动画 |
| `miniprogram/pages/profile-setup/index.json` | 标题 `加入 Flipia` |
| `miniprogram/pages/profile-setup/index.wxml` | intro 文案更新；头像展示 view；按钮纵向 + `disabled`；昵称 `focus` 绑定。移除 loading guard |
| `miniprogram/pages/profile-setup/index.ts` | `onLoad` 简化（路由由 splash 处理）；`canConfirm` 计算属性；昵称必填校验；`wx.chooseMedia`；`wx.hideHomeButton()`；auto-focus 昵称。移除 `ready` 数据和路由分支 |
| `miniprogram/pages/profile-setup/index.wxss` | `.avatar-display`；`.btn-row` 纵向；`.btn--wechat` 实心；`.btn--confirm` 描边 + `[disabled]`。移除 loading spinner |
