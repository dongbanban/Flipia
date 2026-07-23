# Icon 使用说明

Flipia 通过 `<app-icon>` 组件 + `@mp-svg-icons/wechat`（TDesign SVG 图标库）统一管理所有图标。调用方使用语义名（如 `CLOSE`、`ADD`），不感知后端实现。

## 在 WXML 中使用已有图标

```xml
<!-- 基础用法：语义名 + 尺寸(rpx) + 颜色（$token 语法） -->
<app-icon name="CLOSE" size="{{24}}" color="$primary" />

<!-- 无颜色 = 黑色描边默认值 -->
<app-icon name="CHEVRON_RIGHT" size="{{28}}" />
```

**颜色使用 `$token` 语法引用主题色**（如 `$primary`、`$white`），由适配器自动解析为具体色值。禁止直接使用 hex 色值或 CSS 变量。

### 可用颜色令牌

| Token | 色值 | 说明 |
|-------|------|------|
| `$primary` | `#c8815e` | 主题色 / 强调色 |
| `$text-secondary` | `#888888` | 次要文本 / 次级图标 |
| `$text-light` | `#ccc` | 浅色文本 / 分割线级图标 |
| `$text-muted` | `#999` | 置灰 / 禁用态图标 |
| `$white` | `#fff` | 白色（深色背景上） |
| `$green` | `#07c160` | 成功 / 开启态 |

## 当前已注册的图标（11 个）

| 语义名 | TDesign 图标 | 典型用途 |
|--------|-------------|---------|
| `CLOSE` | `close` | 关闭按钮、删除标签 |
| `ADD` | `add` | 新增按钮、FAB |
| `CHEVRON_RIGHT` | `chevron-right` | 菜单箭头 |
| `CHEVRON_DOWN` | `chevron-down` | 下拉指示器 |
| `TOGGLE_ON` | `check-circle-filled` | 供应开关-开、选中态 |
| `TOGGLE_OFF` | `circle` | 供应开关-关、未选中态 |
| `SEARCH` | `search` | 搜索栏图标 |
| `SHARE` | `share` | 分享按钮 |
| `AVATAR` | `user-avatar` | 头像占位 |
| `MINUS` | `minus` | 删除/移除 |
| `HELP` | `help` | 帮助/问号（卡片背面） |

可在 [TDesign 图标库](https://tdesign.tencent.com/icons) 预览所有可用图标。

## 新增图标的步骤

### 1. 确定 TDesign 图标名

在 [TDesign 图标库](https://tdesign.tencent.com/icons) 搜索匹配的图标，获取其 kebab-case 名称（如 `chevron-right`、`check-circle-filled`）。

### 2. 注册语义映射

编辑 `miniprogram/lib/icon-config.ts`，在 `ICON_SEMANTIC_MAP` 中添加新条目：

```ts
export const ICON_SEMANTIC_MAP: Record<string, string> = {
  // ... 已有条目 ...
  NEW_ICON: "tdesign-icon-name",  // ← 新增
};
```

### 3. 更新 tree-shaking 图标列表

编辑 `miniprogram/package.json` 的 `icon:clear` 脚本，把新图标名追加到 `--icons` 列表中：

```json
"icon:clear": "mp-svg-icons-clear --pkg-dir ./miniprogram_npm/@mp-svg-icons/wechat --icons close,add,...,tdesign-icon-name"
```

### 4. 运行 tree-shaking

```bash
cd miniprogram && pnpm run icon:clear
```

### 5. 在微信开发者工具中构建 npm

**"工具 → 构建 npm"**，使裁剪后的 `icons.js` 同步到 `miniprogram_npm`。

### 6. 在 WXML 中使用

```xml
<app-icon name="NEW_ICON" size="{{32}}" color="$primary" />
```

### 7. 在测试中覆盖

编辑 `tests/tdesign-adapter.test.ts`，在 `semanticMappings` 数组中追加映射验证：

```ts
["NEW_ICON", "tdesign-icon-name"],
```

运行 `pnpm test` 确认通过。

## 注意事项

- **颜色**：使用 `$token` 语法引用主题色，不用 hex 或 CSS 变量
- **尺寸**：数值单位为 rpx，组件内部自动适配
- **首次安装后**：需在微信开发者工具中执行"构建 npm"生成 `miniprogram_npm`
- **每次新增图标后**：需重新运行 tree-shaking + 构建 npm
- **Data URI 补丁**：`@mp-svg-icons/wechat` 通过 `pnpm patch` 打了 base64 兼容补丁，`pnpm install` 后需重新构建 npm
