# 05 — Dish Pool Add Form Overhaul

**What to build:** 重构新增菜品弹层——将手动添加和批量导入整合为 form-sheet 内 tab 切换；手动添加 tab 分类选择器底部支持快速创建分类（仅新增）；编辑模式增加烹饪描述 textarea；删除列表页上的独立"导入菜品"入口。

**Blocked by:** 01 — Content Security Service

**Status:** done

- [x] form-sheet 顶部增加"手动添加"/"批量导入"两个 tab，`formMode === 'add'` 时显示，`formMode === 'edit'` 时不显示（编辑模式保持原样）
- [x] 手动添加 tab：保持现有表单（菜品名、分类 picker、图片上传），新增以下内容：
  - 分类 picker 底部追加"+ 新建分类"选项。选中后 picker 下方展开 inline 输入框 + 确认/取消按钮，输入名称后调用 `checkText` 校验（见 Ticket 02），通过后写入 `user_config` 的 `categories` 数组并自动选中新分类
- [x] 批量导入 tab：复用现有导入流程 UI（选源厨房 → 勾选分类 → 确认导入），内部数据管理逻辑不变，`importStep` 初始化为 `selectGroup`。关闭 form 时关闭导入流程
- [x] 编辑模式新增烹饪描述：图片区域下方新增 textarea 组件，`maxlength="200"`，placeholder "烹饪要点、备注…"，双向绑定 `cookingDescription`。`dishes` 集合写入时带此字段。新增模式不显示此字段
- [x] 移除列表页上的独立"导入菜品"入口（`import-entry` 所在 view 块）
- [x] 新建分类不提供改名和删除能力（仅新增），新分类会被写入 `user_config.categories`
