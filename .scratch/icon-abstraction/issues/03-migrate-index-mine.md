# 03 — 迁移：index + mine 页面图标替换

**What to build:** 将首页和"我的"页面上所有 Unicode 图标替换为 `<app-icon>` 组件。这两个页面是用户进入小程序后最先看到的核心页面，`CHEVRON_RIGHT` 箭头贯穿所有菜单入口。

**Blocked by:** 02 — `<app-icon>` 组件 + WeUI adapter + adapter 单测

**Status:** done

- [x] `pages/index/index.wxml`：替换所有 `›` → `<app-icon name="CHEVRON_RIGHT" />`（配置切换器、今日摘要）、`?` → `<app-icon name="?" />`（未映射降级为纯文本渲染，卡片背面图标）
- [x] `pages/mine/index.wxml`：替换所有 `›` → `<app-icon name="CHEVRON_RIGHT" />`（菜单项：分类配置、抽取方案、厨房管理）、`👤` → `<app-icon name="AVATAR" />`（头像占位）
- [x] 原图标对应的 CSS 类（如 `config-arrow`、`summary-arrow`、`menu-arrow`、`profile-avatar__icon`）中仅保留布局/容器样式，移除与图标渲染相关的 `font-size`、`color`、`font-weight` 等声明——这些由 `<app-icon>` 的 prop 接管
- [x] 页面视觉回归：确认替换后的箭头和头像图标尺寸、颜色、对齐与原 Unicode 版本一致

## Comments

- `0fc90ee` — migrate: replace Unicode icons with `<app-icon>` in index + mine pages
- `cc7bd9d` — feat(app-icon): fallthrough unmapped names to plain text render（`?` 卡片背面图标生效）
- **2026-07-23 — TDesign 迁移**：
  - `pages/index/index.wxml`：`name="?"` 改为 `name="HELP"`（TDesign 原生支持 help 图标，不再依赖降级文本渲染）
  - 所有 `color="var(--color-primary)"` → `color="$primary"`，`color="#ccc"` → `color="$text-light"`
