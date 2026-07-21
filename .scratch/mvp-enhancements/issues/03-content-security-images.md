# 03 — Content Security: Image Uploads

**What to build:** 在所有已有图片上传点接入 `lib/content-security.ts` 的 `checkImage` 方法。用户选择图片后、上传到云存储前进行内容安全检测，违规图片被拦截并提示用户更换。

**Blocked by:** 01 — Content Security Service

**Status:** ready-for-agent

- [ ] 菜品图片（`dish-pool` 页 `onChooseImages`）：选图后、`_uploadImages` 前调用 `checkImage`，不通过则 toast "图片不合规，请更换"，不上传
- [ ] 历史实拍照片（`history` 页 `onRecordChooseImage`）：选图后、`_uploadHistoryImages` 前调用 `checkImage`，不通过则 toast "图片不合规，请更换"，不上传
- [ ] `checkImage` 每次只检测单张图片，选多张时逐一检测
- [ ] 合规图片正常上传，违规图片被单独拦截（不阻塞同批次其他合规图片上传）
