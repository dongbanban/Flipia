# 17: 群组内导入菜品 — 从其他群组贡献菜品

**Status:** done
**Type:** implementation
**Blocked by:** 12, 13

## What

已在群组中的成员，可以从自己的其他群组导入菜品到当前群组。

## Why

成员加入家庭群组后，有自己积累的菜品想贡献给家庭。导入使这成为可能——B 加入"张家家庭厨房"后，从"我的厨房"导入他的拿手菜给全家用。

## Acceptance

- [x] 在菜品池页面（或群组管理页面）提供"导入菜品"入口
- [x] 选择源群组 → 勾选要导入的分类 → 确认导入
- [x] 导入语义：复制（源群组数据不变），`creatorId` 保留原创建者
- [x] 同名菜品不自动去重（允许群组中存在两道同名的菜，由不同人创建）
- [x] 导入的菜品 `enabled` 状态保持与源群组一致

## Comments

728a2dc feat: group import dishes — copy dishes from other groups with category selection
