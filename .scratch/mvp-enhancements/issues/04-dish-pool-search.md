# 04 — Dish Pool Search

**What to build:** 菜品列表页顶部增加搜索输入框，在当前厨房跨全部分类模糊匹配菜品名。搜索结果复用菜品卡片展示（含图片、名称、分类名、启用状态、创建者标签），清空搜索词恢复原分类 tab 视图。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 搜索栏：分类 tab 栏上方新增搜索输入框（`<input type="text" placeholder="搜索菜品…">`），带清除按钮（输入内容后出现 × 图标）
- [ ] 输入后 300ms 节流查询 `dishes` 集合：`{groupId, name: db.RegExp({regexp: keyword, options: 'i'})}`，不分 `categoryId`
- [ ] 搜索结果显示：替换当前 `dishes` 列表展示，搜索模式下不显示分类 tab 栏，每条菜品卡片上显示其所属分类名（如标签 badge）
- [ ] 没有匹配结果时显示空状态："没有找到相关菜品"
- [ ] 清空搜索框（点击 × 或手动删除全部文字）→ 恢复分类 tab 视图、加载当前选中分类的菜品列表
- [ ] 搜索时隐藏浮动添加按钮（FAB），避免与搜索态视觉冲突
- [ ] 搜索模式下点击菜品卡片的行为与正常列表一致（进入编辑）
