# 06 — 延迟 users 文档创建至用户确认

Status: resolved

## 问题

首次打开小程序时，`_ensureUserProfile` 在 `app.ts` init 阶段就直接往 `users` 集合写入自动生成昵称的文档。用户尚未进行任何操作，DB 已有脏数据。

## 修复

### `miniprogram/app.ts` — `_ensureUserProfile`
- 移除 `db.collection("users").add()` 调用
- 新用户路径只设 `globalData` 和 `needProfileSetup = true`，不写 DB

### 写入时机
`users` 文档仅在 `profile-setup/index.ts` 的 `onConfirm`（用户点击「创建」按钮）时通过以下路径写入：
```ts
// onConfirm → 验证通过 → 上传头像 → 查询 users 集合
if (userRes.data.length > 0) {
  await db.collection("users").doc(...).update({ data: updateData });
} else {
  await db.collection("users").add({ data: ... });  // ← 仅此处首次写入
}
```

## Comments
