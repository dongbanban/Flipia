# ADR-0005: 图标组件抽象层与多后端适配策略

Flipia 当前所有图标以 Unicode 文字/emoji 硬编码在 WXML 中（`✕`、`＋`、`›` 等），零图标库、零抽象。采用 WeUI 扩展库 `mp-icon` 作为首后端，通过 `<app-icon>` 统一组件 + adapter 模式隔离后端，为未来切换 `@mp-svg-icons/wechat` 等多色 SVG 方案预留接口。

**Status:** accepted

## Decision

- 抽象层：`<app-icon>` 组件，调用方始终使用语义名（如 `CLOSE`、`ADD`），不感知后端。
- 架构：Adapter 模式。组件接收统一 props → adapter 翻译为后端原生 props → WXML 按 `componentType` 条件渲染。
- 后端选择：全局配置（`lib/icon-config.ts`），实例可传 `backend` prop 覆盖。
- 首后端：WeUI `mp-icon`，通过 `app.json` 扩展库引入，零包体积。内部固定 `type="outline"`（描边风格），不暴露给调用方。
- 统一 Props：`name`, `size`, `color`, `fillColor`, `strokeColor`, `strokeWidth`, `brand`。多色 props 在 WeUI 后端被忽略。
- 语义映射：`lib/icon-config.ts` 维护 `ICON_SEMANTIC_MAP`，adapter 先查表翻译，未命中则原样 fallthrough。

## Considered Options

- **不抽象，各处直接用后端组件** — 切换后端需改全部 WXML（~34 处），违反封装原则。拒绝。
- **单一组件内条件渲染（`wx:if` 多后端）** — 简单但每加一个新后端组件文件膨胀，且 adapter 逻辑和 UI 混杂。拒绝。
- **Adapter 模式** — 选择。语义映射表 + adapter 函数与 WXML 解耦，新增后端只需加一个 adapter 文件和一条 `usingComponents` 声明。
- **全局配置 vs 实例 prop 覆盖** — 取两者。默认全局一致，极少数场景（未来可能的填充风格图标）可通过 `backend` prop 临时切换。
- **语义名 vs 后端原生名** — 选择语义名 + fallthrough。Flipia 实际使用约 11 种图标，语义映射表维护成本极低，且切换后端时调用方零改动。

## Consequences

- 新增 `miniprogram/components/app-icon/` 组件（含 `adapters/`、`index.json` / `.wxml` / `.ts` / `.wxss`）
- 新增 `miniprogram/lib/icon-config.ts`（全局配置 + 语义映射表 + adapter 注册）
- `app.json` 新增 `"useExtendedLib": { "weui": true }`
- 所有现有 WXML 中的 Unicode 图标（~34 处）需替换为 `<app-icon name="语义名" size="{{...}}" color="..." />`
- `styles/badge.wxss` 的 `.remove-badge` 可能与 `<app-icon>` 的样式产生重叠/冲突，需审查
- 语义映射表中 `CHEVRON_DOWN`（`arrow` + `rotate(90deg)`）、`TOGGLE_OFF`（`close`）、`MINUS`（`delete`）为近似映射，视觉上与原 Unicode 有差异，需 UI review
- `CONTEXT.md` 新增"图标 (Icon)"术语
