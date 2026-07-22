# Flipia MVP 增强

**Label:** ready-for-agent  
**Created:** 2026-07-21  

---

## Problem Statement

Flipia MVP 已覆盖核心流程（菜品池管理、抽取、历史、群组协作），但在以下方面存在体验缺口：

- **厨房切换入口不完整**：厨房管理子页面无法切换厨房，用户必须返回 tab 页再切，打断管理流程。
- **菜品录入效率低**：新增菜品时无法顺手创建分类，须跳转到「分类配置」页操作后返回，路径割裂。导入菜品入口裸露在列表页，与新增入口分离，概念不聚合。
- **菜品检索能力缺失**：菜品池仅支持按分类 tab 浏览，无关键词搜索，厨房菜品数量增长后查找困难。
- **菜品信息维度单一**：仅有名称和图片，无法记录烹饪要点（如"少油"、"先焯水"），用户需依赖外部笔记。
- **历史记录管理薄弱**：不支持删除误确认的记录，不支持分享菜单到社交场景。
- **内容安全空白**：所有用户输入和图片上传无任何审核，存在合规风险（微信小程序内容安全规范要求对 UGC 做审核）。
- **用户画像缺失**：当前使用随机生成的昵称和空白头像，无法利用微信头像昵称能力，群组成员无法识别彼此。

## Solution

在 MVP 基础上补全上述 9 项能力，不改动核心数据模型和抽取引擎，所有改动均为页面交互增强、内容安全基础设施和用户画像流程。

## User Stories

### 厨房切换

1. 作为用户，我希望在厨房管理子页面顶部也能看到厨房切换器，以便在管理当前厨房时发现数据归属不对能立即切换到目标厨房，而不必退出管理页。

### 菜品录入增强

2. 作为用户，我希望在新增菜品的分类选择器中看到一个"+ 新建分类"选项，以便在发现分类不满足时当场创建、不用跳转到分类管理页。
3. 作为用户，我希望新增分类的交互足够轻量——选中"+ 新建分类"后弹出一个 inline 输入框，输入名称确认即完成创建，不提供改名或删除操作，以便专注录入效率。
4. 作为用户，我希望新增菜品的表单与导入菜品在同一个弹层内通过 tab 切换（"手动添加"/"批量导入"），而不是两个分散的入口，以便对"往厨房加菜"这个意图的所有操作聚合在一起。
5. 作为用户，我希望批量导入时可以从源厨房选择指定分类（可多选），勾选后一次性导入所选分类的全部菜品，以便精准导入自己需要的部分而非全部品类。

### 菜品搜索

6. 作为用户，我希望在菜品列表页顶部有一个搜索输入框，以便输入关键词在当前厨房的**全部**分类范围中搜索菜品。
7. 作为用户，我希望搜索结果保留菜品卡片原有展示（图片缩略图、名称、启用/禁用状态、创建者标签），非当前分类的菜品也能出现在结果中。

### 烹饪描述

8. 作为用户，我希望在编辑菜品时看到一个"烹饪描述"文本域（textarea），以便记录该菜品的烹饪要点、备注等信息，最多 200 个汉字。
9. 作为用户，我希望烹饪描述仅在编辑菜品时可见和可编辑，在菜品列表卡片和抽取结果中不展示，以便保持列表简洁。

### 历史记录管理

10. 作为用户，我希望在历史记录卡片上左滑露出删除按钮，以便删除误操作或不满意的记录。
11. 作为用户，我希望删除操作是物理删除（文档从 `draw_history` 集合中 `remove`，同时清理关联的历史实拍照片），不可恢复，以便保持历史列表干净且不占用存储。
12. 作为用户，我希望在删除前有一个确认弹窗提示"确认删除该条记录？删除后不可恢复"，以便防止误操作。
13. 作为用户，我希望每条历史记录卡片上有分享入口（分享到微信聊天），以便将菜单分享给家人朋友。
14. 作为用户，我希望在历史记录卡片上有一个"生成图片"入口，将当天菜单渲染为一张图片保存到相册或分享，以便发朋友圈。

### 内容安全

15. 作为产品所有者，我希望所有用户手动输入的地方（菜品名、分类名、群组名、方案名、烹饪描述）在提交前进行敏感字检测，检测不通过时阻止提交并提示用户修改，以便符合平台合规要求。
16. 作为产品所有者，我希望检测到用户输入中包含 URL 时阻止提交并提示"内容包含链接，请移除后重试"，以便防止垃圾内容。
17. 作为产品所有者，我希望所有图片上传点（菜品图片、历史记录实拍照片、用户头像）在选择图片后上传前进行图片内容安全检测（色情/暴力/恐怖），检测不通过时提示具体原因（如"图片过大""图片格式不支持""图片包含违规内容"等），违规图片不上传至云存储。

### 用户头像与昵称

18. 作为新用户，我希望首次打开小程序时看到一个引导页，引导我设置头像和昵称，以便在小程序内拥有可识别的个人形象。
19. 作为用户，我希望在「我的」页面看到编辑头像和昵称的入口，以便后续随时修改。
20. 作为用户，我希望头像设置使用微信的 `<button open-type="chooseAvatar">` 能力触达系统相册或拍照，而不是仅限于预设头像库，以便灵活选择。
21. 作为用户，我希望昵称设置使用微信的 `<input type="nickname">` 能力，以便利用微信键盘的昵称联想功能快速输入。
22. 作为用户，我希望头像和昵称保存到 `users` 集合，群组成员列表、菜品创建者标签、抽取人标注均能显示我的真实形象。

---

## Implementation Decisions

### 模块切缝

该 spec 的实现按 5 个独立的边界（seam）进行组织，每个 seam 可独立开发和测试：

**A. Content Security Service（新增）**

- 新增云函数 `content-security`，封装微信开放能力。action router 模式，支持以下 actions：
  - `textCheck` — 依次执行 `security.msgSecCheck` v2（scene=2）和自定义 URL 正则过滤
  - `imageCheck` — [DEPRECATED] 调用已废弃的 `security.imgSecCheck` v1（仅保留给头像等同步场景，可能返回 `degraded: true`）
  - `imageCheckAsync` — 接收已上传的 `cloudFileID`，获取临时 URL 后调用 `security.mediaCheckAsync` v2，返回 `trace_id` 并存储到 `content_checks` 集合
- 新增云函数 `content-security-callback`（HTTP 触发），作为微信消息推送回调端点：
  - 处理 MP 后台的 GET URL 验证（echostr 解密）
  - 接收 POST 加密消息，解密后处理 `wxa_media_check` 事件
  - `suggest: "risky"` → 删除云存储文件 + 清理 dishes/draw_history 中的引用
  - `suggest: "pass"` → 更新 `content_checks` 记录状态
  - 需要配置环境变量 `WX_MSG_TOKEN` 和 `WX_MSG_ENCODING_AES_KEY`
- 新增客户端工具模块 `lib/content-security.ts`，暴露：
  - `checkText(text)` / `checkTextWithToast(text)` — 文本安全检测（同步）
  - `validateAndCompressImage(tempFilePath)` — 客户端校验格式 + 压缩至 ≤1MB（超限时 quality 80→60→40→20 逐级重试），返回最终上传路径
  - `checkImageAsync(cloudFileID)` — fire-and-forget 异步图片送审（不阻塞上传流程）
  - `checkImage(tempFilePath)` — [DEPRECATED] 同步 v1 检测（供头像等场景兼容）
- 图片上传流程（菜品/历史）：`validateAndCompressImage` → `wx.cloud.uploadFile` → `checkImageAsync`（非阻塞）
- 头像上传（mine/profile-setup 页）仍使用 `checkImage`（同步 v1，兜底放行）

**B. Dish Pool 页面重构**

- 搜索栏：在分类 tab 栏上方新增搜索输入框。输入关键词后延迟 300ms 节流，调用 `dishes` 集合查询 `{groupId, name: db.RegExp({regexp: keyword, options: 'i'})}`，不分 categoryId。搜索结果替换当前 `dishes` 列表展示，清空搜索词时恢复分类 tab 视图。搜索结果中每道菜旁边标注其所属分类名。
- 新增/导入 tab：新增菜品的 form-sheet 顶部增加两个 tab——"手动添加"和"批量导入"。手动添加 tab 保留当前表单内容；批量导入 tab 复用现有导入流程 UI（两步：选源厨房 → 勾选分类），内部数据管理逻辑不变，但比原来多一个 importStep "selectTab"。
- 新建分类入口：手动添加 tab 的分类 picker 底部追加一个"+ 新建分类"选项（value 为特殊标记）。选中后 picker 下方展开一个 inline 输入框，输入名称后调用 `checkText` 校验，通过后写入 `user_config` 的 `categories` 数组，自动选中新分类。仅新增，无改名/删除操作。
- 烹饪描述：编辑模式（`formMode === 'edit'`）时，图片区域下方新增 textarea 组件，`maxlength="200"`，显示已保存的 `cookingDescription`。新增模式不展示此字段。
- 导入入口移除：原列表页上的"导入菜品"入口（`import-entry`）移除。

**C. History 页面扩展**

- 左滑删除：使用 `movable-view` 或自定义 touch 事件实现左滑露出删除按钮。点击删除弹出 `wx.showModal` 二次确认（"确认删除该条记录？删除后不可恢复"）。确认后调用 `draw_history` 文档的 `remove()`，同时清理 `images` 中所有云存储文件。
- 分享到聊天：每条历史记录卡片右上角分享图标 → Canvas 生成分享图 → `wx.showShareImageMenu` 弹出系统分享菜单。分享菜单含发送给朋友、分享到朋友圈、收藏、保存。卡片底部操作按钮已移除。Page 的 `onShareAppMessage` 保留用于右上角「…」菜单分享。

**D. 用户 Profile 流程**

- 新增页面 `pages/profile-setup/index`：首次使用引导页，展示 `button open-type="chooseAvatar"` 和 `input type="nickname"`。用户可跳过（跳过后使用默认昵称和空头像）。确认后写入 `users` 集合，更新 `app.globalData.nickName` 和 `avatarUrl`。
- `app.ts` 改造：`_ensureUserProfile()` 中，如果 `users` 集合中用户记录无 `avatarUrl`（空字符串），且新建用户时 `nickName` 仍为随机生成的格式（`用户XXXXXX`），则在初始化完成后跳转到 `profile-setup` 页面。
- 「我的」页面改造：头像区域增加点击编辑能力，修改昵称和头像后更新 `users` 集合和 `globalData`。昵称修改后需要同步更新涉及 creatorName/drawerName 显示的页面（菜品池、历史）。

**E. 厨房管理页切换器**

- `group-manage/index.wxml` 顶部添加 `<group-switcher>` 组件，与所有 tab 页一致的 props 和事件绑定。复用组件已有能力，无需修改 `group-switcher` 组件本身。

### Schema 变更

**`dishes` 集合新增字段：**

```
cookingDescription: string   // 烹饪描述，最多 200 汉字，新增菜品时为空字符串
```

**`users` 集合字段使用方式变化：**

现有的 `avatarUrl` 字段先前为空字符串或未使用，现通过 `chooseAvatar` 填充云存储 fileID。`nickName` 不再由系统随机生成，改由用户通过 `input type="nickname"` 提供。

### 云函数

- 新增 `cloudfunctions/content-security/index.js`，action router 模式：
  - `textCheck` — 依次执行 `security.msgSecCheck` v2 和自定义 URL 正则过滤
  - `imageCheck` — [DEPRECATED] 调用已废弃的 `security.imgSecCheck` v1，兜底放行
  - `imageCheckAsync` — 接收 `cloudFileID`，获取临时 URL 后调用 `security.mediaCheckAsync` v2，存储 `trace_id` 到 `content_checks` 集合
- 新增 `cloudfunctions/content-security/config.json`，声明 `security.msgSecCheck`、`security.imgSecCheck`、`security.mediaCheckAsync` 的云调用权限。
- 新增 `cloudfunctions/content-security-callback/index.js`（HTTP 云函数），接收微信消息推送：
  - GET：处理 MP 后台 URL 验证（echostr 解密）
  - POST：解密 `wxa_media_check` 事件，`risky` 时删除云存储文件并清理 dishes/draw_history 引用；`pass` 时更新 `content_checks` 记录
  - 需要环境变量：`WX_MSG_TOKEN`、`WX_MSG_ENCODING_AES_KEY`
  - 依赖 WeChat 消息加密（AES-256-CBC + PKCS7）
- 配置 `cloudfunctionRoot` 已在 `project.config.json` 中指向 `cloudfunctions/`。

### 边界约束

- 烹饪描述不在历史记录、抽取结果、菜品列表卡片中展示，仅在编辑表单中可见。
- 历史记录生成的分享图仅针对当天分组的第一组 dayGroup，不遍历所有历史。
- 内容安全检测失败时仅阻止当前提交，不触发全局状态回滚或页面刷新。
- `group-switcher` 组件本身不做修改，仅改变使用它的页面范围（新增 group-manage 页引用）。

---

## Testing Decisions

### 测试范围

本项目仅对纯函数模块进行自动化测试（Draw Engine 有 52 个 Vitest 用例），UI 交互层不写单元测试。本 spec 中唯一的纯函数扩展点：

- `lib/content-security.ts` 中 `checkText` / `checkImage` 是对微信 API 的 thin wrapper，不包含自有业务逻辑 → **不写自动化测试**。
- `lib/dish-pool.ts` 中可能需要增加搜索相关的 query builder 纯函数（若搜索结果需要客户端排序/过滤则测试之），否则不测试。

### 验收标准（手动验证点）

| Seam | 验证点 |
|------|--------|
| A | 输入敏感字后提交被拦截并提示；输入含 URL 的文本被拦截并提示；上传违规图片被拦截（可使用微信提供的测试素材验证） |
| B | 搜索关键词返回匹配菜品，清除后恢复 tab 视图；新增表单 tab 切换流畅；+"新建分类"创建后自动选中；编辑模式可见烹饪描述 field |
| C | 左滑露出删除按钮，确认后记录消失且历史列表更新；点击卡片右上角分享图标生成分享图并弹出系统分享菜单（含发送给朋友、分享到朋友圈、保存） |
| D | 新用户首次启动进入引导页，可设置头像昵称或跳过；「我的」页面可修改头像和昵称；群成员列表和菜品创建者标签显示真实头像昵称 |
| E | `group-manage` 页面顶部有厨房切换器，点击切换后页面数据跟随当前厨房 |

---

## Out of Scope

- 烹饪描述在历史记录或抽取结果中展示
- 高级搜索（按分类过滤、按启用/禁用状态过滤）
- 全文索引或 Elasticsearch 级别的搜索能力（继续使用 `db.RegExp` 模糊匹配）
- 分享图的自定义模板或样式编辑
- ~~分享到朋友圈的 API 能力（微信小程序不支持，分享图作为替代方案）~~ **已实现：** `wx.showShareImageMenu` 基础库 3.8.2+ 支持全平台分享到朋友圈
- 用户头像昵称的审核或举报机制
- 内容安全检测的详细日志或 dashboard
- `draw_history` 中 archived 记录的物理删除（已由 7 天滚动窗口软删除机制覆盖）

---

## Further Notes

- 内容安全检测的云函数需要云开发环境开通云调用权限。当前云环境 ID 为 `cloud1-d5gwv3g0da9888b0e`，需确认云调用已启用（通常默认开通）。
- `db.RegExp` 模糊搜索有性能上限（微信云数据库 regexp 匹配非全文索引），但预计 MVP 阶段单个厨房菜品数在 100 道以内，性能可接受。
- 图片检测已迁移至 `security.mediaCheckAsync` (v2)。流程：客户端 `validateAndCompressImage` 校验格式+压缩 → `wx.cloud.uploadFile` 上传云存储 → `checkImageAsync` 调用云函数送审（fire-and-forget，不阻塞上传）→ 云函数获取临时 URL 后调用 `mediaCheckAsync`，返回 `trace_id` 存入 `content_checks` 集合 → 微信异步推送回调至 `content-security-callback` HTTP 云函数 → 违规时自动删除云存储文件并清理 dishes/draw_history 引用。回调云函数需要配置：1) MP 后台消息推送 URL（CloudBase HTTP 访问地址）2) 环境变量 `WX_MSG_TOKEN` 和 `WX_MSG_ENCODING_AES_KEY` 3) CloudBase 控制台开启 HTTP 访问。头像上传仍使用已废弃的 `imgSecCheck` v1 同步检测（兜底放行）。
- 历史记录分享到聊天时，分享卡片标题建议为"【Flipia】今天吃了这些"，图片使用当天第一条记录的菜品首张图片或默认 logo。
- 删除历史记录时需清理 `images` 字段中的云存储文件，调用 `wx.cloud.deleteFile`。注意处理部分文件删除失败的情况（容错，不阻塞主流程）。
