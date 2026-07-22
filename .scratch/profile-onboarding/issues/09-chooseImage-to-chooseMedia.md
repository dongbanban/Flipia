# 09 — wx.chooseImage 迁移至 wx.chooseMedia

Status: resolved

## 问题

`wx.chooseImage` 已 deprecated。

## 修复

`profile-setup/index.ts` — `onTapAvatarDisplay` 方法：

```diff
- wx.chooseImage({
-   count: 1,
-   sizeType: ["compressed"],
-   sourceType: ["album", "camera"],
-   success: (res) => {
-     const avatarUrl = res.tempFilePaths[0];
+ wx.chooseMedia({
+   count: 1,
+   mediaType: ["image"],
+   sourceType: ["album", "camera"],
+   sizeType: ["compressed"],
+   success: (res) => {
+     const avatarUrl = res.tempFiles[0]?.tempFilePath;
```

- `mediaType: ["image"]` 显式声明媒体类型
- `res.tempFilePaths[0]` → `res.tempFiles[0]?.tempFilePath`
- `fail` `errMsg` 匹配改为 `"chooseMedia:fail cancel"`

## Comments
