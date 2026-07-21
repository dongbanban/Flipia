# 06 — 分类管理

**What to build:** 在「我的」页面提供分类配置入口。用户可新增自定义分类、重命名已有分类、删除分类。删除分类时级联移除 `user_config.drawConfig` 中对应的配置条目，并删除 `dishes` 集合中该分类下的所有菜品，保持数据一致性。

**Blocked by:** 03 — 云初始化 & 静默登录

**Status:** done

- [x] 「我的」页面提供「分类配置」入口，进入分类管理页
- [x] 分类管理页展示当前所有分类列表（从 `user_config.categories` 读取）
- [x] 支持新增分类：输入分类名（不可为空，不可与已有分类重名），写入 `user_config.categories`
- [x] 支持重命名分类：点击分类名进入编辑状态，保存后更新 `user_config.categories` 中对应条目
- [x] 支持删除分类：需二次确认；删除后同步遍历 `user_config.drawConfigGroups` 中所有方案的 `entries` 清理该分类条目，保证每组至少一条；同时级联删除 `dishes` 集合中 `categoryId` 匹配的所有菜品
- [x] 删除后若所有方案的 entries 均为空，自动将剩余第一个分类加入默认方案（count: 1），保证至少一条
- [x] 分类列表变更后，菜品池页面的分类 tab 同步更新
