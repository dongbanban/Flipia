# 09 — 历史页

**What to build:** 实现历史记录页面：展示最近 7 天（滚动）内全部已确认记录，按天分组展示，每条显示确认时间、抽取人和菜品列表，支持为每条记录上传并查看 1-3 张实拍照片。

**Blocked by:** 08 — 抽取功能、11 — 群组数据模型

**Status:** done

- [x] 历史页查询 `draw_history`（过滤 `status == 'active'`），按 `confirmedAt` 倒序排列
- [x] 记录按天分组展示，分组头显示日期（「今天」「昨天」或「M月D日」）
- [x] 每条记录展示：确认时间（格式化为 HH:mm）、抽取人（群组成员数>1 时显示，如「张三」）、各分类菜品名列表
- [x] 每条记录底部展示实拍照片区：若已有照片则显示缩略图（最多 3 张），若无则显示「添加照片」入口
- [x] 点击「添加照片」调用 `wx.chooseImage` 上传至云存储，fileID 追加写入 `draw_history.images`（上限 3 张）
- [x] 点击照片缩略图可全屏预览（调用 `wx.previewImage`）
- [x] 无历史记录时展示空状态占位
- [x] 页面加载时展示加载态

## Comments

- `557a5a0` feat(history): add photo upload, display and preview on history records
