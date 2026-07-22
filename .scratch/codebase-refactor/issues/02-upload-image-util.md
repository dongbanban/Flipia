# 02 — 提取 uploadImage() 工具函数并迁移调用方

**What to build:** 创建 `uploadImage()` 函数封装图片上传全流程，然后将 dish-pool、history、profile-setup、mine 四个页面的内联上传逻辑替换为调用此函数。

**Blocked by:** 01（需要 `LIMITS.IMAGE_MAX_SIZE`）

**Status:** done

- [x] 创建 `uploadImage()` 函数：接收 `{ maxCount, sourceType, showToast }` 参数，内部串行执行 选图 → 校验/压缩 → 云存储上传 → 异步内容安全审核，返回 `Promise<string[]>`
- [x] 内部复用 `lib/content-security.ts` 已有的 `validateAndCompressImage` 和 `checkImageAsync`，不重写
- [x] 替换 `dish-pool/index.ts` 中的菜品图片上传逻辑
- [x] 替换 `history/index.ts` 中的历史记录实拍照片上传逻辑
- [ ] 替换 `profile-setup/index.ts` 中的头像上传逻辑 *(skipped — image pick and upload are separated; sync checkImage flow differs from uploadImages' fire-and-forget model)*
- [ ] 替换 `mine/index.ts` 中的头像修改上传逻辑 *(skipped — uses native chooseAvatar API, not wx.chooseImage)*
- [x] 头像场景的 `chooseAvatar` API 差异在上层处理，不纳入 `uploadImage()` 内部
- [x] `pnpm test` 全部通过
