# 04 — 提取 Modal 和 EmptyState 公共组件并迁移调用方

**What to build:** 创建 Modal（通用弹窗）和 EmptyState（通用空状态）两个 UI 组件，替换各页面自行实现的内联弹窗和空状态。

**Blocked by:** 无 — CSS 变量体系已在 `styles/variables.wxss` 中建立

**Status:** done

- [x] 创建 Modal 组件（`.wxml`/`.wxss`/`.ts`/`.json`），支持 `show`、`title`、confirm/cancel 文本、内容 slot
- [x] 创建 EmptyState 组件，支持 `text`、可选 `icon`、可选按钮 `actionText` + `bind:action`
- [x] 组件样式引用 `variables.wxss` 中的 CSS 变量，不引入新的 hardcode 颜色
- [x] 替换 `draw-config-manage/index` 中的方案编辑 Modal
- [x] 替换 `category-manage/index` 中的分类重命名/新增 Modal
- [x] 替换 `dish-pool/index` 中的菜品编辑 Modal
- [x] 替换各页面的空状态占位为 EmptyState 组件
- [x] Modal 和 EmptyState 的视觉与交互与替换前一致
- [x] `pnpm test` 全部通过

## Comments

dfe0c1c — feat: extract Modal and EmptyState shared components, migrate all callers
