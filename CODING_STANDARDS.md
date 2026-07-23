# Coding Standards

> 项目配置文件与公共方法/组件的完整说明见 [docs/config-and-utils.md](docs/config-and-utils.md)。新增常量或工具函数前请先查阅，避免重复造轮子。

## Remove badge

When an element needs a remove / delete badge, use the shared `.remove-badge` class from `miniprogram/styles/badge.wxss` (imported globally via `app.wxss`).

**Shared visual style (`.remove-badge`):** white circular badge, primary-color icon and ring, subtle drop shadow. The icon character is `×` (U+00D7).

```css
/* miniprogram/styles/badge.wxss */
.remove-badge {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #fff;
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 0 2rpx var(--color-primary),
    0 1rpx 4rpx rgba(0, 0, 0, 0.1);
  line-height: 1;
}
```

**Positioning** is *not* part of the shared class — each usage decides its own position by adding a second class:

| Usage | Class | Position |
|---|---|---|
| Image upload remove | `.image-remove` | `absolute; top: -16rpx; right: -14rpx` (overlaps parent corner) |
| Tag remove | `.tag-delete` | `margin-left: 12rpx; flex-shrink: 0` (inline, inside parent flow) |

In WXML, compose with `class="remove-badge image-remove"` or `class="remove-badge tag-delete"`.

**References:** `miniprogram/styles/badge.wxss`, `miniprogram/pages/dish-pool/index.wxss`, `miniprogram/pages/category-manage/index.wxss`.

## Theme color

All UI components that accept a color (confirm buttons, highlights, accents, etc.) must use the system theme color:

- **CSS:** `var(--color-primary)` (defined as `#c8815e` in `miniprogram/styles/variables.wxss`)
- **JS (e.g. `wx.showModal` `confirmColor`):** `"#c8815e"`

Never hardcode red (`#ff4d4f`) for confirm/destructive actions unless the action is genuinely irreversible (e.g. permanent data deletion with no undo). Even then, prefer a secondary confirmation step over a red button.

## Page layout

All `.page` containers MUST use absolute positioning instead of `100vh`. See [ADR-0003](docs/adr/0003-page-layout-no-100vh.md).

| Page type | CSS |
|---|---|
| With `group-switcher` (tab pages) | `position: absolute; top: 88rpx; left: 0; right: 0; bottom: 0; overflow-y: auto;` |
| Without `group-switcher` | `position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow-y: auto;` |

Never use `100vh`, `min-height: 100vh`, or `height: 100vh` in any `.wxss` file.

## Package manager

本项目的所有依赖安装统一使用 **pnpm**。禁止使用 npm 或 yarn。

```bash
# 根目录安装 dev 依赖
pnpm add -w -D <package>

# miniprogram 目录安装运行时依赖
cd miniprogram && pnpm add <package>
```

## Icons

所有图标通过 `<app-icon>` 统一组件使用，详见 [docs/icon-guide.md](docs/icon-guide.md)。关键规则：

- 调用方始终使用语义名（如 `CLOSE`、`ADD`），不感知后端实现
- `<app-icon color="...">` 必须用具体色值（`#c8815e`、`#fff`），禁止 CSS 变量（`var(--color-*)` 在 Data URI 中不生效）
- 新增图标需同步更新 `ICON_SEMANTIC_MAP`、`icon:clear` 脚本、tree-shaking、npm 构建、测试

## Comments

所有注释统一使用简体中文。这是硬性规则，不允许混用中英文注释。

### 规则

| 规则 | 说明 |
|------|------|
| 注释语言 | 简体中文 |
| JSDoc 标签 | `@param`、`@returns`、`@typedef` 等标签保留英文，描述文字用中文 |
| 代码符号 | 注释中引用的函数名、变量名、文件路径保留原文 |
| 分隔线 | `// ── 分区名 ──` 保留视觉结构，分区名翻译为中文 |
| 编译器指令 | `@ts-ignore`、`@ts-expect-error`、`eslint-disable` 等工具指令不翻译 |
| TODO 标记 | `TODO:` 可保留英文或中文，不做强制要求 |

### 示例

```ts
/** 对菜品列表按拼音排序并附加创建者昵称。 */
function sortDishes(dishes: Dish[]): Dish[] { ... }

/**
 * 上传图片到云存储。
 * @param options - 上传配置选项
 * @param options.maxCount - 最大选图数，默认 1
 * @returns 上传成功后的 cloud fileID 数组
 */
function uploadImage(options: UploadOptions): Promise<string[]> { ... }

// ── 搜索 ──────────────────────────────────────────────────
const keyword = e.detail.value
```
