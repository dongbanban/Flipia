# Icon 图标组件抽象层

**Status:** in-progress（已上线 TDesign，细节调优中）

## Problem Statement

Flipia 当前所有图标以 Unicode 文字/emoji 硬编码在 10 个 WXML 文件中（`✕`、`＋`、`›`、`✓` 等），约 34 处使用点。存在的问题：

- **视觉不一致**：Unicode 字符在不同设备、不同系统版本上渲染效果差异大（字重、大小、对齐）
- **可维护性差**：修改一个图标（如"关闭"从 `✕` 改为 `×`）需要搜索替换所有 WXML，无中心化入口
- **无法扩展**：无法使用多色 SVG 图标、无法切换图标库、无法按需引入新图标
- **无语义约束**：同一个操作（如"添加"）在不同页面分别用了 `＋`（全角）和 `+`（半角），语义混乱

## Solution

创建 `<app-icon>` 统一图标组件，提供语义化图标 API。调用方通过语义名引用图标（如 `CLOSE`、`ADD`），组件内部通过 adapter 模式适配不同的图标后端库。

**当前后端**：`@mp-svg-icons/wechat`（TDesign SVG 图标，v0.0.2），npm 安装 + tree-shaking 裁剪至 ~4KB。通过 Data URI（base64 格式）在 `<image>` 中渲染。

**历史**：首后端为 WeUI 扩展库 `mp-icon`，因视觉质量不满足（icon font 跨设备渲染不一致 + 3 个近似映射图标视觉不匹配），已于 2026-07 全面切换至 TDesign。

## User Stories

1. 作为开发者，我希望用 `<app-icon name="CLOSE" />` 替换所有硬编码的 `✕`/`×` 文字，以便关闭图标的视觉风格全局统一
2. 作为开发者，我希望用 `<app-icon name="ADD" />` 替换所有 `＋`/`+`，以便添加按钮的图标在一处配置即可全局生效
3. 作为开发者，我希望用 `<app-icon name="CHEVRON_RIGHT" />` 替换所有 `›`，以便所有菜单箭头风格一致
4. 作为开发者，我希望用 `<app-icon name="SEARCH" />` 替换搜索栏的 `🔍` emoji，以便搜索图标不再依赖 emoji 字体
5. 作为开发者，我希望用 `<app-icon name="SHARE" />` 替换分享按钮的 `⬆`，以便分享图标语义更清晰
6. 作为开发者，我希望用 `<app-icon name="AVATAR" />` 替换头像占位的 `👤`，以便个人中心头像占位风格统一
7. 作为开发者，我希望 `<app-icon>` 组件支持 `color` prop 控制颜色，以便图标颜色可与页面主题保持一致而不需额外 CSS
8. 作为开发者，我希望 `<app-icon>` 组件支持 `size` prop 控制尺寸（rpx），以便不同场景下的图标大小由调用方精确控制
9. 作为架构师，我希望通过修改全局配置文件即可将所有图标从 WeUI 切换到 TDesign，以便切换后端时零 WXML 改动
10. 作为开发者，我希望语义名映射表未覆盖的图标名降级为纯文本在原位渲染，以便使用未注册图标时不出现空白
11. 作为开发者，我希望 `<app-icon>` 的 `CHEVRON_DOWN` 语义名对应一个下箭头图标，以便厨房切换器下拉箭头由图标组件统一渲染
12. 作为开发者，我希望 `<app-icon>` 的 `TOGGLE_ON` / `TOGGLE_OFF` 语义名分别对应勾选和未选中状态，以便菜品供应开关的状态视觉明确
13. 作为架构师，我希望 `<app-icon>` 预留 `fillColor`、`strokeColor`、`strokeWidth`、`brand` props，以便切换到多色 SVG 方案时调用方无需改组件接口
14. 作为维护者，我希望 adapter 函数和语义映射表有独立的纯逻辑单元测试，以便修改映射或新增 adapter 时能快速验证正确性

## Implementation Decisions

### 组件架构：Adapter 模式

`<app-icon>` 作为桥接层，内部维护 adapter 注册表。adapter 函数接收统一 props（`name`, `size`, `color`, `fillColor`, `strokeColor`, `strokeWidth`, `brand`, `backend`），输出 `{ componentType, props, inlineStyle }` 结构供 WXML 消费。

WXML 根据 `componentType` 字段（`'mp-icon'` / `'text'` 等）条件渲染对应的后端组件或降级纯文本。新增后端只需：添加一个 adapter 文件 + 在 `index.json` 声明 `usingComponents` + 在 WXML 加一个 `wx:elif` 分支。

### 统一 Props 设计

`<app-icon>` 暴露以下属性，全覆盖三个候选后端的最大能力：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | String | — | 语义化图标名（必填），如 `"CLOSE"`、`"ADD"` |
| `size` | Number | 24 | 图标尺寸（px），透传或转为后端对应属性 |
| `color` | String | — | 单色图标颜色（HEX / rgb / rgba），WeUI 后端通过 CSS `color` 控制 |
| `fillColor` | String \| String[] | — | 填充色，多色 SVG 后端使用，WeUI 后端忽略 |
| `strokeColor` | String \| String[] | — | 描边色，多色 SVG 后端使用，WeUI 后端忽略 |
| `strokeWidth` | Number | 2 | 描边宽度（px），多色 SVG 后端使用 |
| `brand` | String | — | 图标品牌/来源，多后端时指定图标集 |
| `backend` | String | — | 覆盖全局配置的后端选择，不传则读全局配置 |

### 后端选择：全局配置 + 实例覆盖

- 全局默认后端在 icon-config 中定义为一个常量，所有 `<app-icon>` 实例默认使用
- 单个实例可通过 `backend` prop 覆盖，适用于极少数需混用后端的场景
- 实例未传 `backend` 时回退到全局配置

### 当前后端：TDesign（`@mp-svg-icons/wechat`）

- 通过 npm 安装 (`pnpm add @mp-svg-icons/wechat`)，tree-shaking 后 ~4KB
- 组件注册：`"t-icon": "@mp-svg-icons/wechat/icon"` 声明在 `app-icon/index.json`
- 渲染方式：`<image>` + Data URI（base64 格式），非 icon font
- `color` prop 同时映射到 `fillColor` 和 `strokeColor`（不同图标的渲染通道不同：stroke-based 图标如箭头/加号需要 `strokeColor`，fill-based 图标如 TOGGLE_ON 需要 `fillColor`）
- `size` prop 转为 `rpx` 字符串传给 t-icon（`"24rpx"`），因为 t-icon 将其直接用作 CSS 值，rpx 能正确适配不同屏幕宽度
- `brand` prop 类型为 String，未设时默认 `"tdesign"`（匹配 t-icon 内部默认值，传空字符串会覆盖默认值导致图标查找失败）
- 不再保留 WeUI fallback；WeUI adapter 和 `useExtendedLib.weui` 已移除

### TDesign 接入关键决策

#### Data URI 编码：base64

`@mp-svg-icons/wechat@0.0.2` 原始的 `data:image/svg+xml;charset=utf-8,<partial-encoded SVG>` 格式在真机（尤其是 Android）上存在兼容问题。社区一致验证有效的方案是 base64 编码。

通过 `pnpm patch` 创建了永久补丁（`patches/@mp-svg-icons__wechat.patch`），将 t-icon 的 Data URI 生成逻辑改为：
```
data:image/svg+xml;base64,${wx.arrayBufferToBase64(buffer)}
```
每次 `pnpm install` 自动应用。需配合微信开发者工具"构建 npm"使 `miniprogram_npm` 同步。

#### 颜色：CSS 变量 → token 系统

WXML 中所有 `<app-icon color="var(--color-*)">` 已替换为 `$token` 语法：

| Token | 色值 | 用途 |
|-------|------|------|
| `$primary` | `#c8815e` | 主题色（按钮、高亮、箭头） |
| `$text-secondary` | `#888888` | 次要文字色（分类标签、开关关闭态） |
| `$text-light` | `#ccc` | 浅灰文字（我的页面菜单箭头） |
| `$text-muted` | `#999` | 弱化色（历史页、群组管理页箭头） |
| `$white` | `#fff` | 白色（FAB 浮动按钮、卡片背面图标） |
| `$green` | `#07c160` | 绿色（供应开关-开） |

Token 定义在 `lib/theme.ts`（颜色唯一真相源），适配器通过 `resolveColor()` 自动解析 `$` 前缀。调用方在 WXML 中使用：
```xml
<app-icon name="ADD" color="$primary" />
```
而非硬编码 `#c8815e`。修改主题色只需改 `lib/theme.ts` 一处。

原因：Data URI `<image>` 是独立文档上下文，CSS 自定义属性无法跨文档继承，但 JS 层面的 token 解析可以正常工作。

#### tree-shaking

全量 `icons.js` 包含 2347 个 TDesign 图标（~1MB）。通过 `@mp-svg-icons/utils` 的 `mp-svg-icons-clear` CLI 裁剪至 11 个图标（~4KB）。

```bash
cd miniprogram && pnpm run icon:clear
```

脚本已写入 `miniprogram/package.json`。每次新增图标后需重新运行。

#### `brand` 类型变更

从 `Boolean`（WeUI 时期不需要）改为 `String`，默认 `""` → adapter 转 `"tdesign"`。传空字符串会覆盖 t-icon 内部默认值导致图标查找失败。

### 历史：WeUI 扩展库（已废弃）

- ~~通过 `app.json` 的 `useExtendedLib.weui: true` 引入，零包体积~~
- ~~组件内部固定使用 `type="outline"`（描边风格），不暴露 `type` 给调用方~~
- ~~WeUI adapter 将 `color` prop 翻译为 CSS `color` 内联样式，将 `size` prop 翻译为 CSS `font-size`~~
- ~~多色 props（`fillColor`、`strokeColor`、`strokeWidth`、`brand`）在 WeUI adapter 中被静默忽略~~

### 语义名映射（当前：TDesign）

11 个 Flipia 语义图标名 → TDesign 原生图标名映射，全部精确匹配，无近似映射：

| 语义名 | TDesign `name` | 颜色通道 | 备注 |
|--------|---------------|---------|------|
| `CLOSE` | `close` | stroke | 精确匹配 |
| `ADD` | `add` | stroke | 精确匹配 |
| `CHEVRON_RIGHT` | `chevron-right` | stroke | 精确匹配，无需旋转 |
| `CHEVRON_DOWN` | `chevron-down` | stroke | 精确匹配，无需旋转 |
| `TOGGLE_ON` | `check-circle-filled` | fill | 实心勾选圆 |
| `TOGGLE_OFF` | `circle` | fill+stroke | 空心圆，与 TOGGLE_ON 成对 |
| `SEARCH` | `search` | stroke | 精确匹配 |
| `SHARE` | `share` | fill+stroke | 精确匹配 |
| `AVATAR` | `user-avatar` | fill+stroke | TDesign 专用头像占位图标 |
| `MINUS` | `minus` | stroke | 精确匹配 |
| `HELP` | `help` | stroke | 精确匹配 |

### 历史映射（WeUI，已废弃）

| 语义名 | WeUI `icon` | 备注 |
|--------|------------|------|
| `CLOSE` | `close` | 精确匹配 |
| `ADD` | `add` | 精确匹配 |
| `CHEVRON_RIGHT` | `arrow` | WeUI 默认右箭头 |
| `CHEVRON_DOWN` | `arrow` | 同 `arrow`，通过 `rotate(90deg)` 内联样式旋转 |
| `TOGGLE_ON` | `done` | 勾选标记 |
| `TOGGLE_OFF` | `close` | 细 X 作为未选中态（近似映射） |
| `SEARCH` | `search` | 精确匹配 |
| `SHARE` | `share` | 精确匹配 |
| `AVATAR` | `me` | 人物轮廓 |
| `MINUS` | `delete` | 横线图标（近似映射） |
| `HELP` | — | 映射表无此项，adapter 降级为纯文本渲染 |

### 替换范围

需替换的现有 Unicode 图标及其分布：

| 语义名 | 原 Unicode | 出现次数 | 涉及文件 |
|--------|-----------|---------|---------|
| `CLOSE` | `✕` / `×` | 7 | modal, draw-config-manage, category-manage, dish-pool, group-manage |
| `ADD` | `＋` / `+` | 8 | draw-config-manage, category-manage, dish-pool, history, group-switcher |
| `CHEVRON_RIGHT` | `›` | 6 | index, mine, group-manage |
| `TOGGLE_ON` | `✓` | 5 | dish-pool, group-create, group-switcher |
| `TOGGLE_OFF` | `○` | 1 | dish-pool |
| `CHEVRON_DOWN` | `▼` | 1 | group-switcher |
| `SEARCH` | `🔍` | 1 | dish-pool |
| `HELP` | `?` | 1 | index |
| `SHARE` | `⬆` | 1 | history |
| `MINUS` | `−` | 1 | draw-config-manage |
| `AVATAR` | `👤` | 2 | mine, profile-setup |

合计 11 个语义名，约 34 处替换点，覆盖 10 个 WXML 文件。

### `.remove-badge` 样式审查

`styles/badge.wxss` 中的 `.remove-badge` 类（圆形 × 容器）目前通过 CSS 伪元素或文本渲染 `×`。替换为 `<app-icon>` 后需确保该样式与组件不冲突——若 `.remove-badge` 仅提供容器样式（圆形背景），则保留；若其定义了自己的 `×` 文字，则移除文字部分，改为在 WXML 中嵌入 `<app-icon name="CLOSE" />`。

## Testing Decisions

### 测试哲学

只测试外部行为（给定输入 → 期望输出），不测试实现细节（内部函数调用次数、中间变量形态）。

### 接缝 1：adapter 函数

纯 TypeScript 逻辑，可在 Node 环境直接运行。测试用例覆盖：
- 语义名映射：`translate('CLOSE', 'weui')` → `'close'`
- fallthrough 降级：未映射名称 → adapter 输出 `componentType: "text"`，`props.text` 为原始 name，style 包含 color + font-size
- Props 归一化：输入统一 props → 输出 `AdapterOutput`（WeUI 后端忽略多色 props，`color` 转为 CSS `color`，`size` 转为 CSS `font-size`）
- 内联 style 生成：`CHEVRON_DOWN` → style 包含 `transform: rotate(90deg)`
- 空 props 默认值：未传 `size` → 默认 24

### 接缝 2：icon-config 配置逻辑

测试用例覆盖：
- 全局配置读取正确性
- `getIconBackend()` 优先级：`backend` prop > 全局配置
- 语义映射表结构完整性：每个声明的后端都有映射条目

### 不需要测试

- WXML 条件渲染正确性（框架层，手动验证）
- WeUI `mp-icon` 内部行为（外部依赖）
- 替换后的视觉一致性（UI review / 截图对比）

## Out of Scope

- 多色 SVG 图标的实际使用场景——Flipia 当前无多色图标需求（尽管 TDesign 已支持）
- 图标动画（hover/active 状态）——WXML `<image>` Data URI 模式不支持 SVG 交互动画
- TabBar 图标——`app.json` tabBar 当前为纯文字，不在本次替换范围
- `<empty-state>` 组件的 `icon` prop——该 prop 为 `<image>` 图片路径，语义不同于功能图标，不做迁移
- 主题/暗色模式下的图标颜色自适应——后续按需扩展
- 图标 CDN 远程加载或按需懒加载——所有图标均打包到本地

## Further Notes

- TDesign 图标均为精确匹配，不存在 WeUI 时期的近似映射问题
- WeUI adapter（`weui.ts`）、translate.ts、`useExtendedLib.weui` 均已删除
- `@mp-svg-icons/wechat` 通过 `pnpm patch` 打了 Data URI base64 补丁，`pnpm install` 后需重新"构建 npm"
- 新增图标时：在 `icon-config.ts` 的 `ICON_SEMANTIC_MAP` 添加映射 → 更新 `icon:clear` 脚本 → 运行 tree-shaking → 构建 npm
- `brand` 类型为 String（不是 Boolean），未设时 adapter 默认 `"tdesign"`
- `size` 通过 rpx 字符串传给 t-icon，视觉大小与原设计一致
- 所有 `<app-icon color="...">` 不得使用 CSS 变量，必须用具体色值
