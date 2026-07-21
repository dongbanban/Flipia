# 07 — User Profile Setup & Edit

**What to build:** 新用户首次进入小程序看到引导页设置头像昵称（可跳过）；「我的」页面支持后续修改头像和昵称；群组成员列表和菜品创建者标签展示真实头像昵称。

**Blocked by:** 01 — Content Security Service

**Status:** done

- [x] 新增页面 `pages/profile-setup/index`（非 tab 页，纯导航页）：
  - 展示简介文案（"设置你的头像和昵称，让家人朋友能认出你"）
  - `<button open-type="chooseAvatar" bind:chooseavatar="onChooseAvatar">` 展示当前选中头像或默认占位
  - `<input type="nickname" placeholder="请输入昵称">` 用于填写昵称
  - 底部两个按钮："确认"和"跳过"。"确认"时调用 `checkImage` 校验头像（若已选）→ 头像上传到云存储 → 写入/更新 `users` 集合（`{nickName, avatarUrl}`）→ 更新 `app.globalData` → 跳转首页；"跳过"时若为新用户则写入默认昵称（`用户${openid.slice(-6)}`），若为已有用户则保留原 profile
- [x] `app.ts` `_ensureUserProfile` 改造：
  - 查询到用户记录后，若 `nickName` 为随机生成的格式（`/^用户[a-z0-9]{6}$/`）且 `avatarUrl` 为空字符串，标记 `needProfileSetup = true`
  - 初始化完成后若 `needProfileSetup`，跳转到 `profile-setup` 页面
  - 已有真实头像昵称的用户不受影响，正常进入首页
- [x] 「我的」页面改造：
  - 头像区域包裹 `button open-type="chooseAvatar"`，用户点击可重新选择头像
  - 昵称区域改为可点击编辑（或使用 `input type="nickname"`），修改后写入 `users` 集合并更新 `globalData`
  - 头像和昵称更新后须同步影响：群组成员列表、菜品创建者标签、抽取人标注——这些页面在 `onShow` 时从 `globalData` 或 `users` 重新获取数据即可，不强制 push 更新
- [x] 头像上传到云存储路径 `avatars/${openid}/${timestamp}_avatar.jpg`

## Comments
- `431112f` feat: user profile setup and edit — 10 files, 526+ 12-
- Code reviewed: security check added to mine page, state bug fixed (needProfileSetup cleared), dead code removed, redundant upload comparison fixed
