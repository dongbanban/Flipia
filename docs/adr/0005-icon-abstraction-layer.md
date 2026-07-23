# ADR-0005: 图标组件抽象层与多后端适配策略

Flipia 所有图标以 Unicode 文字/emoji 硬编码在 WXML 中（`✕`、`＋`、`›` 等），零图标库、零抽象。通过 `<app-icon>` 统一组件 + adapter 模式隔离后端，首后端 WeUI 因视觉质量不满足需求，已全面切换至 `@mp-svg-icons/wechat`（TDesign SVG 图标）。

**Status:** accepted

## Decision

- 抽象层：`<app-icon>` 组件，调用方始终使用语义名（如 `CLOSE`、`ADD`），不感知后端。
- 架构：Adapter 模式。组件接收统一 props → adapter 翻译为后端原生 props → WXML 按 `componentType` 条件渲染。
- 后端选择：全局配置（`lib/icon-config.ts`），实例可传 `backend` prop 覆盖。
- 当前后端：`@mp-svg-icons/wechat`（TDesign SVG 图标），通过 npm 安装，Data URI 方案渲染，包体积通过 CLI 按需裁剪至 ~4KB（11 图标）。
- WeUI 已废弃：`useExtendedLib.weui` 已移除，`mp-icon` 注册已删除，WeUI adapter 文件已清理。不再保留 WeUI 作为 fallback。
- 统一 Props：`name`, `size`, `color`, `fillColor`, `strokeColor`, `strokeWidth`, `brand`。`brand` 类型为 String（TDesign 后端透传品牌名）。
- 语义映射：`lib/icon-config.ts` 维护 `ICON_SEMANTIC_MAP`，adapter 先查表翻译，未命中则原样透传。

## Considered Options

- **不抽象，各处直接用后端组件** — 切换后端需改全部 WXML（~34 处），违反封装原则。拒绝。
- **单一组件内条件渲染（`wx:if` 多后端）** — 简单但每加一个新后端组件文件膨胀，且 adapter 逻辑和 UI 混杂。拒绝。
- **Adapter 模式** — 选择。语义映射表 + adapter 函数与 WXML 解耦，新增后端只需加一个 adapter 文件和一条 `usingComponents` 声明。
- **全局配置 vs 实例 prop 覆盖** — 取两者。默认全局一致，极少数场景可通过 `backend` prop 临时切换。
- **语义名 vs 后端原生名** — 选择语义名 + fallthrough。Flipia 实际使用 11 种图标，语义映射表维护成本极低，且切换后端时调用方零改动。
- **WeUI vs TDesign SVG** — 初始选 WeUI 因其零包体积（扩展库），但渲染质量差（icon font 在不同设备上大小/对齐不一致）且存在 3 个近似映射导致视觉不匹配。切换至 TDesign SVG 原生支持所有 11 个语义名的对应图标，且支持多色渲染。

## Timeline

- **2026-07 — 初始实现**：WeUI `mp-icon` 作为首后端，`<app-icon>` 组件 + weuiAdapter，11 个语义映射（含 3 个近似映射：CHEVRON_DOWN → arrow+rotate, TOGGLE_OFF → close, MINUS → delete）。
- **2026-07 — 后端切换**：WeUI 视觉效果不满意，全面切换至 `@mp-svg-icons/wechat`。语义映射重新审计为 11 个精确匹配的 TDesign 图标名（CHEVRON_DOWN → chevron-down, TOGGLE_OFF → circle, MINUS → minus, HELP → help 等）。移除 WeUI adapter、translate.ts 和 `useExtendedLib.weui`。

## Consequences

- 新增 `miniprogram/components/app-icon/` 组件（含 `adapters/tdesign.ts`、`index.json` / `.wxml` / `.ts` / `.wxss`）
- 新增 `miniprogram/lib/icon-config.ts`（全局配置 + 语义映射表）
- `miniprogram/package.json` 新增依赖 `@mp-svg-icons/wechat`
- 根 `package.json` 新增 dev 依赖 `@mp-svg-icons/utils`（图标裁剪 CLI）
- 所有 WXML 中的 Unicode 图标（~34 处）已替换为 `<app-icon name="语义名" />`
- 不再使用 `app.json` 的 `useExtendedLib` 配置
- `CONTEXT.md` 的"图标 (Icon)"术语已更新为 TDesign 后端
