# 04 — 迁移：dish-pool 页面图标替换

**What to build:** 将菜品池页面所有 Unicode 图标替换为 `<app-icon>` 组件。此页面是图标种类最多的单个页面（5 种语义名），也是用户操作最频繁的页面。

**Blocked by:** 02 — `<app-icon>` 组件 + WeUI adapter + adapter 单测

**Status:** done

- [x] 搜索栏：`🔍` → `<app-icon name="SEARCH" />`，保留 `search-bar__icon` 的容器/定位样式
- [x] 清除搜索：`✕` → `<app-icon name="CLOSE" />`
- [x] FAB 浮动按钮：`+` → `<app-icon name="ADD" />`，保留 `fab` 的圆形容器样式
- [x] 图片添加：`+` → `<app-icon name="ADD" />`，保留 `image-add` 容器样式
- [x] 图片移除：`×` → `<app-icon name="CLOSE" />`
- [x] 供应开关：`✓` / `○` → `<app-icon name="TOGGLE_ON" />` / `<app-icon name="TOGGLE_OFF" />`，保留切换按钮容器样式
- [x] 导入分类 checkbox：`✓` → `<app-icon name="TOGGLE_ON" />`
- [x] 清理原图标 CSS 类（`search-bar__icon`、`image-add`、`fab` 等）中与图标渲染相关的字体属性——这些由 `<app-icon>` prop 接管
- [x] 页面视觉回归：确认五种图标（关、加、搜、开、关-toggle）在各自场景下尺寸、颜色、对齐正确

## Comments

- `N/A` — 暂未提交
- 替换了 7 处 Unicode 图标为 `<app-icon>` 组件：SEARCH(搜索栏) / CLOSE×2(清除搜索+图片移除) / ADD×2(FAB+图片添加) / TOGGLE_ON(供应开关+导入checkbox) / TOGGLE_OFF(供应开关)
- CSS 清理：移除 `.search-bar__icon`、`.search-bar__clear`、`.fab`、`.image-add`、`.import-cat-check` 中的 `font-size`/`color` 等图标渲染属性，保留容器布局样式
- 注册 `app-icon` 组件到 `dish-pool/index.json`
- **2026-07-23 — TDesign 迁移**：
  - 所有 `color="var(--color-primary)"` → `#c8815e`，`color="var(--color-text-secondary)"` → `#888888`
  - 供应开关 TOGGLE_ON `color="#07c160"` 保持不变（绿色，设计意图）
  - ADD（FAB）`color="#fff"` 保持不变（白色浮动按钮，设计意图）
