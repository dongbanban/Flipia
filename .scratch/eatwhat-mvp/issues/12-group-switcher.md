# 12: 群组切换器 — 顶部导航栏

**Status:** done
**Type:** implementation
**Blocked by:** 11

## Comments

356a61e feat: group switcher — top nav bar with group list popup, multi-group data switching
b2819e3 fix: replace HTML entity with Unicode arrow, add _openid fallback query for groups
5658ca8 fix: add whenReady() promise to prevent pages reading globalData before init completes

## What

在所有 4 个 tab 页面（首页/菜品池/历史/我的）顶部固定显示当前群组名 + 点击展开群组列表。选择一个群组后，页面数据切换到该群组。

## Why

用户可能同时属于多个群组（个人厨房 + 家庭厨房），需要在不同群组间快速切换。全局群组切换器避免了在"我的"页面进出群组管理的繁琐路径。

## Acceptance

- [x] 4 个 tab 页顶部固定显示当前群组名（不超过 8 字，超出省略）
- [x] 点击群组名弹出群组列表（群组名 + 成员数），显示"新建群组"入口
- [x] 选中某个群组后，所有页面的数据（菜品池、方案、历史）切换到该群组
- [x] 当前活跃群组持久化（写入 `user_config` 或 local storage / 云存储）
- [x] 列表为空时显示引导文案
