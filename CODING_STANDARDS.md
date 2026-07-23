# 编码规范

> 项目配置文件与公共方法/组件的完整说明见 [docs/config-and-utils.md](docs/config-and-utils.md)。新增常量或工具函数前请先查阅，避免重复造轮子。

## 移除标记

当元素需要移除/删除标记时，使用 `miniprogram/styles/badge.wxss` 中的共享 `.remove-badge` 类（已通过 `app.wxss` 全局引入）。

**共享视觉样式（`.remove-badge`）：** 白色圆形标记，主题色图标和圆环，微弱投影。图标字符为 `×` (U+00D7)。

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

**定位**不属于共享类的职责——每个使用场景通过追加第二个类自行决定位置：

| 场景 | 类名 | 位置 |
|---|---|---|
| 图片上传移除 | `.image-remove` | `absolute; top: -16rpx; right: -14rpx`（覆盖父容器角落） |
| 标签移除 | `.tag-delete` | `margin-left: 12rpx; flex-shrink: 0`（行内，参与父级流布局） |

WXML 中组合使用：`class="remove-badge image-remove"` 或 `class="remove-badge tag-delete"`。

**参考：** `miniprogram/styles/badge.wxss`、`miniprogram/pages/dish-pool/index.wxss`、`miniprogram/pages/category-manage/index.wxss`。

## 主题色

所有接受颜色属性的 UI 组件（确认按钮、高亮、强调色等）必须使用系统主题色：

- **CSS：** `var(--color-primary)`（定义于 `miniprogram/styles/variables.wxss`，值为 `#c8815e`）
- **JS（如 `wx.showModal` 的 `confirmColor`）：** `"#c8815e"`

禁止将红色（`#ff4d4f`）用于确认/破坏性操作，除非该操作确实不可逆（如无撤销机制的永久数据删除）。即使如此，也优先采用二次确认而非红色按钮。

## 页面布局

所有 `.page` 容器必须使用绝对定位而非 `100vh`。参见 [ADR-0003](docs/adr/0003-page-layout-no-100vh.md)。

| 页面类型 | CSS |
|---|---|
| 含 `group-switcher`（Tab 页面） | `position: absolute; top: 88rpx; left: 0; right: 0; bottom: 0; overflow-y: auto;` |
| 不含 `group-switcher` | `position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow-y: auto;` |

禁止在任何 `.wxss` 文件中使用 `100vh`、`min-height: 100vh` 或 `height: 100vh`。

## 包管理器

本项目的所有依赖安装统一使用 **pnpm**。禁止使用 npm 或 yarn。

```bash
# 根目录安装 dev 依赖
pnpm add -w -D <package>

# miniprogram 目录安装运行时依赖
cd miniprogram && pnpm add <package>
```

## 图标

所有图标通过 `<app-icon>` 统一组件使用，详见 [docs/icon-guide.md](docs/icon-guide.md)。关键规则：

- 调用方始终使用语义名（如 `CLOSE`、`ADD`），不感知后端实现
- `<app-icon color="...">` 必须用具体色值（`#c8815e`、`#fff`），禁止 CSS 变量（`var(--color-*)` 在 Data URI 中不生效）
- 新增图标需同步更新 `ICON_SEMANTIC_MAP`、`icon:clear` 脚本、tree-shaking、npm 构建、测试

## 注释

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
