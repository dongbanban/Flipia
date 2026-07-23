# 01 — Foundation：icon-config + adapter 类型 + 单测

**What to build:** 创建图标系统的纯逻辑基础层——语义映射表、全局后端配置、adapter 接口类型，附带单元测试。此工单不涉及任何 UI 或 WXML 改动，仅产出可被后续工单导入的 TS 模块。

**Blocked by:** 无 —— 可立即开始。

**Status:** done

- [x] `lib/icon-config.ts`：导出 `ICON_SEMANTIC_MAP`（11 个语义名 → WeUI 原生名的映射）、`DEFAULT_ICON_BACKEND` 常量（`'weui'`）、`getIconBackend(override?: string)` 函数（`override` 优先于全局默认）
- [x] `components/app-icon/adapters/types.ts`：定义 `UnifiedIconProps` 类型（`name`, `size`, `color`, `fillColor`, `strokeColor`, `strokeWidth`, `brand`, `backend`）、`AdapterOutput` 类型（`{ componentType, props, inlineStyle }`）、`IconAdapter` 函数签名
- [x] `lib/icon-config.test.ts`：覆盖语义名映射正确性、未命中 fallthrough、`getIconBackend` 优先级（实例 override > 全局默认）

## Comments

`4cbc075` — 创建图标系统基础层：语义映射表、adapter 类型定义、21 个单元测试全部通过。
