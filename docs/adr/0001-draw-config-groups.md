# ADR-0001: 抽取方案支持多套配置组

**Status:** accepted

## Context

MVP 初期计划为单套抽取配置——用户只能调整一组固定的分类+数量的抽签规则。但在实际需求推敲中发现用户在不同场景下（日常晚餐、周末聚餐、宴请）需要的抽签规则差异很大。每次手动改配置反而比只改一次更烦人。

## Decision

支持多套抽取方案（`drawConfigGroups`），每套是一组分类+数量的组合。用户最多保存 10 套，可增删改查，其中一套为当前生效方案（`activeDrawConfigGroupId`）。首页抽取始终使用当前生效方案。

数据结构嵌套在 `user_config` 文档内而非单独建表——方案始终与 `categories` 一起读写，单文档原子更新，数据量小到无需分表。

## Considered Options

- **单独 `draw_config_groups` 集合** — 查询需要额外 IO，无独立查询场景，拒绝。
- **保持单套配置 + 快捷切换预设** — 本质上是同一问题换个解法，用户体验不如多套方案直观。
- **方案可跨群组导入** — 在 ADR-0002"一切皆群组"模型下，方案自然在群组内共享。跨群组导入方案的场景极少（导入菜品时方案一般重新配置），标记为 future consideration。
- **方案可能提供排序/置顶能力** — 当前无需求，只做基础 CRUD。

## Consequences

- `init-data.ts` 需迁移旧 `drawConfig` 数据到第一个 `drawConfigGroup`
- `category-manage.ts` 删除分类时需遍历所有 group 的 entries
- Issue 07 需完全重写，Issue 08 需微调（解析 active group entries）
