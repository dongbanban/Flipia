# 06 — History Enhancements

**What to build:** 历史记录支持左滑删除（永久物理删除）、分享到微信聊天、生成当天菜单分享图（保存或分享到朋友圈）。

**Blocked by:** 01 — Content Security Service

**Status:** ready-for-agent

- [ ] 左滑删除：每条历史记录卡片支持左滑手势露出删除按钮。点击删除弹出 `wx.showModal` 二次确认（"确认删除该条记录？删除后不可恢复"）。确认后：
  - 调用 `draw_history.doc().remove()` 删除文档
  - 若记录有 `images` 字段，调用 `wx.cloud.deleteFile` 清理云存储
  - 从本地 `dayGroups` 数据中移除该条记录，恢复列表正常状态
  - 若某天分组下仅剩该一条记录，该天分组也一并从 `dayGroups` 移除
  - 清理文件失败（单个或全部）不阻塞删除主流程，仅 `console.error` 记录
- [ ] 分享到聊天：每条历史记录卡片底部增加分享入口——使用 `button open-type="share"`。Page 的 `onShareAppMessage` 在收到事件时返回自定义分享卡片：
  - 标题："【Flipia】今天吃了这些"（或其他简洁文案）
  - 图片：取该记录 `results` 中第一道菜品的 `imageUrl`，若无则用默认 logo
  - 路径 `/pages/index/index`（分享给好友后点开进入首页，不进入历史页）
- [ ] 生成分享图：当天分组（第一个 `dayGroup`）底部增加"保存为图片"按钮，点击后：
  - 使用 Canvas 绘制当天日期、所有记录的菜品列表（分类名 + 菜名）
  - 绘制背景为白色、文字为黑色，菜品名按分类分行
  - 调用 `wx.canvasToTempFilePath` 生成临时图片
  - 弹出选项供用户选择"保存到相册"（`wx.saveImageToPhotosAlbum`）或"发送给朋友"（`wx.shareFileMessage`）
  - 处理用户拒绝相册权限的情况（toast 提示引导开启权限）
- [ ] 左滑删除手势不与页面垂直滚动冲突
