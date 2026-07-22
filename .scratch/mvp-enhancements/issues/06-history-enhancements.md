# 06 — History Enhancements

**What to build:** 历史记录支持左滑删除（永久物理删除）、分享到微信聊天、生成当天菜单分享图（保存或分享到朋友圈）。

**Blocked by:** 01 — Content Security Service

**Status:** done

- [x] 左滑删除：每条历史记录卡片支持左滑手势露出删除按钮。点击删除弹出 `wx.showModal` 二次确认（"确认删除该条记录？删除后不可恢复"）。确认后：
  - 调用 `draw_history.doc().remove()` 删除文档
  - 若记录有 `images` 字段，调用 `wx.cloud.deleteFile` 清理云存储
  - 从本地 `dayGroups` 数据中移除该条记录，恢复列表正常状态
  - 若某天分组下仅剩该一条记录，该天分组也一并从 `dayGroups` 移除
  - 清理文件失败（单个或全部）不阻塞删除主流程，仅 `console.error` 记录
- [x] 分享到聊天：保留 Page 的 `onShareAppMessage` 支持右上角菜单分享，返回自定义分享卡片：
  - 标题："【Flipia】今天吃了这些"（或其他简洁文案）
  - 图片：取该记录 `results` 中第一道菜品的 `imageUrl`，若无则用默认 logo
  - 路径 `/pages/index/index`（分享给好友后点开进入首页，不进入历史页）
- [x] 生成分享图：每条历史记录卡片右上角放置分享图标（⬆），点击后：
  - 使用 Canvas 绘制该条记录的菜品列表（含图片缩略图、分类名 + 菜名、时间、抽取人）
  - 调用 `wx.canvasToTempFilePath` 生成临时图片
  - 调用 `wx.showShareImageMenu({ path })` 弹出系统分享菜单（含发送给朋友、分享到朋友圈、收藏、保存），替代了原自定义 ActionSheet + `wx.shareFileMessage`
  - 卡片底部操作按钮（分享给朋友 + 保存为图片）已移除
  - 废弃 API 同步清理：`getSystemInfoSync` → `getWindowInfo`、`chooseImage` → `chooseMedia`、`mask: true` 移除
- [x] 左滑删除手势不与页面垂直滚动冲突

## Comments
- Commit: history-enhancements: swipe-delete, share-to-chat, share-image

### 2026-07-22 — 分享实现演进

**原始实现：**
- 分享到聊天：卡片底部 `button open-type="share"` → `onShareAppMessage`
- 生成分享图：dayGroup 底部按钮 → Canvas → 自定义 ActionSheet（"保存到相册"/"发送给朋友"）→ `saveImageToPhotosAlbum` / `shareFileMessage`

**最终实现：**
- 每条历史卡片右上角分享图标（⬆）→ `onGenerateShareImage` → Canvas → `wx.showShareImageMenu({ path })`
- 系统分享菜单覆盖全部需求：发送给朋友、分享到朋友圈（3.8.2+）、收藏、保存
- 移除卡片底部操作按钮、自定义 ActionSheet、`shareFileMessage`
- 同步清理废弃 API：`getSystemInfoSync` → `getWindowInfo`、`chooseImage` → `chooseMedia`、`mask: true` 移除
- 用户手动关闭分享菜单不提示"分享失败"（过滤 `cancel` 场景）

### 2026-07-22 — 细节优化

- Canvas 无历史实拍图片时不再绘制占位符区域（虚线框 + "+" + 品牌文案），信息区从卡片左侧填满整行
- 卡片占位符（无图记录的 `+` 号）和 Canvas 分享图中的 `+` 号统一使用主题色（`var(--color-primary)` / `C_PRIMARY`）
- `showShareImageMenu` fail 回调过滤 `cancel`，用户手动关闭不弹 toast
