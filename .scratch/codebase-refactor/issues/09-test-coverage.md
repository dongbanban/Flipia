# 09 — 补充单元测试覆盖缺失场景

**What to build:** 对现有的 7 个 Vitest 测试文件进行缺口分析，补充 15 个缺失测试用例，覆盖边界条件、未测试分支和隐式行为。

**Blocked by:** 无 — 可立即开始。

**Status:** completed

- [x] `tests/init-data.test.ts`: `buildPresetDishes` 每道菜 categoryId 与预设分类匹配、总数 20 道
- [x] `tests/dish-pool.test.ts`: `sortDishes` 全部无 createdAt 保持原序、`buildImportDishData` 复制 cookingDescription
- [x] `tests/draw-engine.test.ts`: `drawDishes` 配置分类不在菜品池中返回空、disabled 菜品仍被抽取（行为文档化）
- [x] `tests/history.test.ts`: `isYesterday` 跨月/跨年边界、`groupByDay` 单条记录/降序排列、`getTodaySummary` 恰好 3 个抽签人/memberCount=2 边界
- [x] `tests/draw-config-manage.test.ts`: `validateGroupName` 恰好 100 字、`createDrawConfigGroup` 9→10 边界、`removeDrawConfigEntry` 空 config、`syncAllGroupNames` 多方案
- [x] `pnpm test` 全部通过 (179/179)

## Context

当前 7 个测试文件共覆盖 6 个核心纯函数模块（`init-data`、`dish-pool`、`draw-engine`、`history`、`category-manage`、`draw-config-manage`），每个导出函数均已有基础覆盖。但经过逐函数比对源码：

- 部分边界条件未覆盖（如 `isYesterday` 跨月场景、`getTodaySummary` 恰好 3 人的分支边界）
- 部分字段未验证（如 `buildImportDishData` 中的 `cookingDescription` 字段未在测试中出现）
- 部分行为未文档化（如 `drawDishes` 不按 `enabled` 过滤，依赖调用方预筛选）

另外 4 个模块（`sanitize.ts`、`confirm.ts`、`content-security.ts`、`upload-image.ts`）重度依赖微信小程序 API（`wx.*`），无法在 Vitest Node 环境下进行有意义的单元测试，不在本次补充范围。

## 涉及文件

| 文件 | 操作 |
|------|------|
| `tests/init-data.test.ts` | 添加 2 个测试用例 |
| `tests/dish-pool.test.ts` | 添加 2 个测试用例 |
| `tests/draw-engine.test.ts` | 添加 2 个测试用例 |
| `tests/history.test.ts` | 添加 5 个测试用例 |
| `tests/draw-config-manage.test.ts` | 添加 4 个测试用例 |

## Comments

