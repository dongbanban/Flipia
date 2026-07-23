# 05 — 迁移：剩余页面 + 样式清理

**What to build:** 将其余所有页面的 Unicode 图标替换为 `<app-icon>`，并处理 `.remove-badge` 与 `<app-icon>` 的样式整合。完成后整个项目零硬编码 Unicode 图标。

**Blocked by:** 02 — `<app-icon>` 组件 + WeUI adapter + adapter 单测

**Status:** done

- [x] `pages/draw-config-manage/index.wxml`：`×`→`CLOSE`（删除方案、移除分类）、`＋`→`ADD`（新建方案、添加分类）、`−`→`MINUS`（步进器）
- [x] `pages/category-manage/index.wxml`：`×`→`CLOSE`（删除分类）、`＋`→`ADD`（新增分类）
- [x] `pages/history/index.wxml`：`+`→`ADD`（上传图片占位）、`⬆`→`SHARE`（分享按钮）
- [x] `pages/group-manage/index.wxml`：`×`→`CLOSE`（踢人）、`›`→`CHEVRON_RIGHT`（厨房名编辑）
- [x] `pages/group-create/index.wxml`：`✓`→`TOGGLE_ON`（导入开关、分类选中）
- [x] `pages/profile-setup/index.wxml`：`👤`→`AVATAR`（头像占位）
- [x] `components/group-switcher/index.wxml`：`▼`→`CHEVRON_DOWN`（下拉箭头）、`✓`→`TOGGLE_ON`（活跃厨房标识）、`+`→`ADD`（新建厨房）
- [x] `components/modal/index.wxml`：`✕`→`CLOSE`（关闭按钮）
- [x] `.remove-badge` 样式审查与整合：确认圆形 badge 容器与内的 `<app-icon name="CLOSE" />` 无样式冲突，移除 badge 中已由 `<app-icon>` 覆盖的字体属性
- [x] 全局搜索确认无残留 Unicode 图标字符（`✕`、`×`、`＋`、`+`、`›`、`✓`、`▼`、`🔍`、`○`、`⬆`、`−`、`👤`），排除 `app-icon` 组件自身和注释中的引用

## Comments

- `ec1ad89` — 迁移所有页面 Unicode 图标为 <app-icon> + badge 样式整合
- 替换了 8 个文件中的 ~20 处 Unicode 图标为 `<app-icon>`：CLOSE×5 / ADD×5 / MINUS×1 / CHEVRON_RIGHT×1 / CHEVRON_DOWN×1 / TOGGLE_ON×4 / SHARE×1 / AVATAR×1
- CSS 清理：移除各页面/组件中 `font-size`/`color`/`font-weight`/`line-height`（图标渲染属性），保留容器布局样式
- `styles/badge.wxss` 中的 `.remove-badge` 类已精简为纯容器样式（移除 `color`/`font-size`/`font-weight`/`line-height`），与 `<app-icon>` 集成无冲突
- 全局搜索确认：11 个 Unicode 图标字符在全部 WXML/WXSS 文件中均已清零（排除 app-icon 组件自身）
- 本次迁移至此全部完成，总计 11 个语义名覆盖 10 个文件，约 35 处 `<app-icon>` 替换点
