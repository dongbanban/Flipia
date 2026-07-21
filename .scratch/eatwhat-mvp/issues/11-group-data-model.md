# 11: 群组数据模型 — 数据库 Schema 更新

**Status:** done
**Type:** implementation
**Blocked by:** 01, 02, 03, 04, 05, 06, 07 — 所有已实现票均基于旧 schema，需统一更新

## What

按"一切皆群组"模型（ADR-0002）更新数据库集合 schema，并适配所有已实现代码。

- `groups`：移除 `members[].role` 字段（所有成员平权，群主由 `_openid` 判断）
- `dishes`：新增 `creatorId` 字段（添加菜品的成员 openid，仅展示用）
- `draw_history`：新增 `drawerId` 字段（执行抽取的成员 openid）
- 数据库权限：从 `_openid == auth.openid` 改为校验 openid ∈ `group.members`
- 适配已实现代码：`init-data.ts`、`buildDefaultUserConfig()`、所有读写 services、03-07 票相关代码

## Why

ADR-0002 决定采用单一数据维度。Schema 需反映"菜品有创建者"和"历史记录有抽取人"两个新领域概念。

## Acceptance

- [x] `groups` 文档不包含 `role` 字段
- [x] `dishes` 文档包含 `creatorId`，创建菜品时自动填入当前用户 openid
- [x] `draw_history` 文档包含 `drawerId`，确认抽取时自动填入当前用户 openid
- [x] 所有集合的读写权限改为基于群组成员列表校验
- [x] 初始化流程（`init-data.ts`）创建单人群组时正确设置以上字段

## Comments

0667141 feat: group data model — add creatorId to dishes, drawer_history collection, remove role semantics
