# 02 — Content Security: Text Submissions

**What to build:** 在所有已有文本输入点接入 `lib/content-security.ts` 的 `checkText` 方法。用户提交菜品名、分类名、群组名、方案名、烹饪描述时，先检测敏感字和 URL，不通过则阻止提交并 toast 提示原因。

**Blocked by:** 01 — Content Security Service

**Status:** done

- [x] 菜品名（`dish-pool` 页 `onSaveDish`）：submit 时调用 `checkText`，不通过则 toast 提示并阻止保存
- [x] 分类名（`category-manage` 页 `onConfirmAdd` / `onConfirmRename`）：submit 时调用 `checkText`，不通过则 toast 提示并阻止保存
- [x] 群组名（`group-manage` 页编辑群组名、`group-create` 页新建群组）：submit 时调用 `checkText`
- [x] 抽取方案名（`draw-config-manage` 页创建/编辑方案）：submit 时调用 `checkText`
- [ ] 烹饪描述（`dish-pool` 页编辑菜品）：submit 时调用 `checkText`（与菜品名一起检测，任一不通过即阻止）— **BLOCKED: no cooking-description field exists in the dish-pool form. Needs UI addition first.**
- [x] 不通过时的 toast 文案根据 `reason` 展示："内容包含敏感信息，请修改后重试" 或 "内容包含链接，请移除后重试"

## Comments
- `3e598ba` — feat: add content security text checks to all text inputs
- 烹饪描述 checkbox blocked: no cooking-description field exists in dish-pool form. Needs UI addition first.
