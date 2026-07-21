# 15: 菜品列表 — 展示创建者标签

**Status:** done
**Type:** implementation
**Blocked by:** 11

## What

在菜品池页面的菜品列表中，每道菜展示创建者标签（如"大厨：张三"）。群组成员数 ≤ 1 时不展示。

## Why

多人群组中，菜品由不同成员添加。展示创建者帮助区分"谁往里放了这个菜"，但不赋予特殊权限——所有成员仍可对任何菜品执行增删改禁用。

## Acceptance

- [x] 群组成员数 > 1 时，每道菜品卡片展示创建者昵称（格式："大厨：XXX"）
- [x] 群组成员数 = 1 时，不展示创建者标签（无信息增量）
- [x] 创建者昵称使用微信昵称
- [x] 导入菜品时保留原创建者 ID，昵称按该 openid 显示

## Comments

e3bd5ad feat: show dish creator label on dish pool cards when group has >1 members
