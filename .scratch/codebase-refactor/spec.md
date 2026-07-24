# 代码库重构：公共组件/工具提取 + Hardcode 收敛

**Label:** ready-for-agent  
**Created:** 2026-07-22

---

## Problem Statement

当前项目在 MVP 快速迭代后积累了以下技术债务：

1. **Hardcode 分散**：图片上传大小限制（1MB）在 3 处重复定义，分类名/菜品名/厨房名的长度限制、查询 limit 值、云环境 ID 等散落在 10+ 个文件中
2. **图片上传逻辑重复**：profile-setup、mine、history、dish-pool 四个页面各自实现了选图→校验/压缩→云存储上传→内容安全审核的完整流程，代码高度相似
3. **文本安全校验重复**：各页面的输入框都独立调用 `checkTextWithToast`，样板代码重复
4. **UI 组件缺失**：Modal 弹窗在 4+ 个页面各自写了一套样式和逻辑，空状态占位在多个页面写法不统一
5. **`wx.showModal` confirmColor 硬编码**：`#c8815e` 在 11 处出现

这些问题导致修改一个限制需要跨多个文件搜索替换，新增图片上传场景需要复制粘贴大量代码，UI 一致性难以保证。

## Solution

在不改变任何已有功能行为的前提下，执行一次系统性的代码整理：

1. **创建统一配置文件** `miniprogram/config.ts`，收敛所有 hardcoded limits、阈值、云环境 ID、查询限制值、品牌文案
2. **提取三个工具函数**：`uploadImage()`（图片上传全流程）、`sanitizeInput()`（文本安全校验）、`showConfirm()`（封装 confirmColor）
3. **提取两个 UI 组件**：Modal（通用弹窗）、EmptyState（通用空状态）
4. **页面替换引用**：所有页面从直接 hardcode 改为引用 config 和公共模块

## User Stories

### 配置文件

1. 作为开发者，我希望能在一个地方找到所有阈值和限制常量，以便修改时不需要搜索多个文件。
2. 作为开发者，我希望云环境 ID、查询 limit 值等环境相关参数集中管理，以便切换环境时只需改一处。
3. 作为开发者，我希望品牌文案和默认值集中管理，以便统一对外展示文案。

### 图片上传复用

4. 作为开发者，我希望调用一个 `uploadImage()` 函数就能完成图片上传全流程，以便新增图片上传场景时只需传参不需要复制代码。
5. 作为开发者，我希望 `uploadImage()` 支持配置 maxCount、sourceType 等参数，以便不同场景（头像/菜品图/历史记录图）灵活使用。

### 文本安全校验

6. 作为开发者，我希望调用 `sanitizeInput()` 函数完成文本安全审核和 toast 提示，以便在各页面输入处理中减少样板代码。
7. 作为开发者，我希望长度限制从 config 读取而非各页面独立复制，以便修改限制时统一生效。

### 公共 UI 组件

8. 作为开发者，我希望使用公共 Modal 组件构建弹窗，以便弹窗样式和行为保持一致。
9. 作为开发者，我希望使用公共 EmptyState 组件展示空状态，以便列表为空时体验统一。
10. 作为开发者，我希望调用 `showConfirm()` 而非 `wx.showModal`，以便不需要每次传入 confirmColor。

### 云函数

11. 作为开发者，我希望云函数的 hardcode 收敛到各自的 `config.js`，以便云函数侧也有统一的管理入口。

---

## Implementation Decisions

### 配置文件架构

创建单一配置文件 `miniprogram/config.ts`，按职责分区导出：

```ts
// 结构示意（非最终代码）
export const CLOUD = { envId: 'cloud1-...' }

export const LIMITS = {
  IMAGE_MAX_SIZE: 1024 * 1024,   // 图片上传上限
  CATEGORY_NAME_MAX: 10,          // 分类名最大长度
  DISH_NAME_MAX: 20,              // 菜品名最大长度
  DRAW_CONFIG_NAME_MAX: 100,      // 抽取方案名最大长度
  GROUP_NAME_MAX: 12,             // 厨房名最大长度（云函数侧）
  DRAW_CONFIG_GROUP_MAX: 10,      // 方案套数上限
  DRAW_COUNT_MIN: 1,              // 每分类最少抽取数
  DRAW_COUNT_MAX: 5,              // 每分类最多抽取数
  KITCHEN_MEMBER_MAX: 5,          // 厨房最大人数
  DISH_IMPORT_MAX: 500,           // 批量导入菜品上限
  HISTORY_IMAGE_MAX: 3,           // 历史记录最大实拍数
  DISH_IMAGE_MAX: 3,              // 菜品最大图片数
}

export const QUERY = {
  LIMIT_HISTORY: 50,              // 历史查询 limit
  LIMIT_USER_CONFIG: 20,          // 用户配置查询 limit
  LIMIT_GENERIC_MAX: 100,         // 通用最大 limit
}

export const STRINGS = {
  DEFAULT_GROUP_NAME: '我的厨房',
  DEFAULT_DRAW_CONFIG_NAME: '雨露均沾',
  BRAND_NAME: 'Flipia时刻',
}

export const HISTORY_WINDOW_DAYS = 7
export const INVITE_CODE_LENGTH = 6
```

CSS 变量（`variables.wxss` 中的 `--color-primary` 等）与 config.ts 各自独立维护——它们是同一设计意图在不同技术层的表达，不存在"谁管谁"的问题。

预设数据（4 个默认分类、20 道预设菜品）保留在 `lib/init-data.ts`，不属于配置参数，不迁入 config.ts。

### 图片上传工具函数：`uploadImage()`

封装完整的图片上传流水线：选图 → 客户端校验/压缩 → 云存储上传 → 异步内容安全审核 → 返回 fileID。

```
uploadImage(options: {
  maxCount?: number         // 最大选图数，默认 1
  sourceType?: string[]     // album / camera，默认 ['album', 'camera']
  showToast?: boolean       // 是否显示成功/失败 toast，默认 false
}): Promise<string[]>       // 返回 cloud fileID 数组
```

内部复用 `lib/content-security.ts` 中已有的 `validateAndCompressImage` 和 `checkImageAsync`。各页面的上传代码替换为调用此函数。

不封装头像上传的 `chooseAvatar` 场景——`chooseAvatar` 使用的是 `chooseMedia`/`chooseAvatar` 的不同 API，头像场景只有 profile-setup 和 mine 两个页面，封装收益低。

### 文本安全校验工具函数：`sanitizeInput()`

```
sanitizeInput(options: {
  value: string
  maxLength: number         // 从 LIMITS 读取
  fieldName: string         // 字段名，用于 toast 提示
  showToast?: boolean       // 默认 true
}): Promise<{ valid: boolean; value: string }>
```

内部执行：trim → 长度校验（失败 toast + 返回 valid:false）→ `checkTextWithToast`（失败 toast + 返回 valid:false）→ 返回 valid:true。

各页面的长度硬编码替换为从 `LIMITS` 读取后传入。

### 公共组件：Modal

接受 `show`、`title`、`content` slot（WXML template slot）和 `confirmText`/`cancelText`。覆盖现有 4+ 处弹窗的使用场景。样式统一使用 CSS 变量，不引入新的硬编码颜色。

### 公共组件：EmptyState

接受 `icon`（可选）、`text`、`actionText`（可选按钮）和 `bind:action` 事件。覆盖现有菜品池空态、历史空态等场景。

### 确认弹窗工具函数：`showConfirm()`

```
showConfirm(options: {
  title?: string
  content: string
  confirmText?: string
  cancelText?: string
}): Promise<boolean>  // true = 确认，false = 取消
```

预设 `confirmColor` 等默认参数，替代所有页面中直调 `wx.showModal({ confirmColor: '#c8815e', ... })` 的写法。

### 云函数配置文件

`cloudfunctions/group-manage/config.js`：存放 `MAX_MEMBERS`、`INVITE_CODE_LENGTH`、`GROUP_NAME_MAX_LENGTH` 等。

其余云函数（login、content-security、content-security-callback）hardcode 极少，视情况单独收敛或在同一个 config 中。

### 实施分阶段策略

| 阶段 | 内容 | 依赖 |
|------|------|------|
| 1 | 创建 `miniprogram/config.ts` + 云函数 `config.js` | 无 |
| 2 | 提取 `uploadImage()`、`sanitizeInput()`、`showConfirm()` | config.ts |
| 3 | 提取 Modal、EmptyState 组件 | 变量体系（已有） |
| 4 | 页面替换：各页面引用 config 和公共模块 | 阶段 1-3 |

每阶段完成后验证（测试通过 + 关键用户流程手动回归），确认无误再进下一阶段。

---

## Testing Decisions

### 验证原则

这是纯重构，不应引入任何行为变化。验证的核心目标是：**重构前能跑的，重构后照样能跑。**

### 验证维度（从高到低）

**1. 现有单元测试 —— 最高优先级 seam**

7 个 Vitest 测试文件覆盖 `draw-engine`、`dish-pool`、`history`、`category-manage`、`draw-config-manage`、`init-data`、`group-create`。这些模块中大部分不直接涉及 hardcode（纯函数逻辑），重构后应全部通过。

```bash
pnpm test
```

**2. 页面行为不变 —— 手动回归**

重构涉及改动的页面在微信开发者工具中逐页手动验证关键用户路径：

- 菜品池：添加菜品（含图片）、搜索、编辑
- 历史：上传实拍照片、查看记录
- profile-setup / mine：头像上传、昵称修改
- 分类管理：增删改名弹窗
- 抽取方案：Modal 编辑弹窗
- 首页：抽取流程校验和按钮状态

**3. 新增函数类型安全**

确保 `uploadImage()`、`sanitizeInput()`、`showConfirm()` 的类型签名正确，所有调用点不产生 TypeScript 编译错误。

**4. 数据库查询 limit 一致性**

替换后的 limit 值与替换前一致——通过 `grep` 交叉比对替换前后的值即可。

### 不做的事

- 不为 `uploadImage` 编写单元测试——其核心逻辑依赖微信 SDK（`wx.chooseMedia`、`wx.cloud.uploadFile`），无法在 Vitest Node 环境下模拟
- 不为 UI 组件编写渲染测试——小程序没有可用的组件级测试框架
- 不做全量自动化回归

---

## 单元测试覆盖率补充（09-test-coverage）

重构完成后，对现有 7 个 Vitest 测试文件进行逐函数缺口分析，补充 15 个缺失的边界/分支/行为文档化用例：

| 测试文件 | 新增用例数 | 关键缺口 |
|----------|-----------|---------|
| `init-data.test.ts` | 2 | `buildPresetDishes` categoryId 匹配、总数验证 |
| `dish-pool.test.ts` | 2 | `sortDishes` 全无 createdAt 排序、`buildImportDishData` cookingDescription 字段 |
| `draw-engine.test.ts` | 2 | 未匹配分类空结果、disabled 菜品行为文档化 |
| `history.test.ts` | 5 | `isYesterday` 跨月边界、`groupByDay` 单条/排序、`getTodaySummary` 3 人边界 |
| `draw-config-manage.test.ts` | 4 | `validateGroupName` 100 字边界、9→10 方案边界、空 config 删除、多方案名同步 |

不在此范围：4 个依赖 `wx.*` API 的模块（`sanitize`、`confirm`、`content-security`、`upload-image`）因无法在 Vitest Node 环境测试，不新增用例。

验证：`pnpm test` 全部通过。

## 代码注释中文化

在完成上述重构后，统一将项目所有源代码中的英文注释（包括单行注释、块注释、JSDoc、HTML 注释）翻译为简体中文。这是一个纯文档性质的工作，不涉及任何逻辑或行为变更。

### 翻译范围

| 目录 | 文件数 | 说明 |
|------|--------|------|
| `cloudfunctions/` | 6 | 云函数 index.js + config.js |
| `miniprogram/lib/` | 7 | 工具函数库 |
| `miniprogram/pages/` | 16 | 8 个页面的 ts + wxml |
| `miniprogram/components/` | 6 | 3 个组件的 ts + wxml |
| `miniprogram/config.ts` | 1 | 统一配置文件 |
| `miniprogram/app.ts` | 1 | 应用入口 |
| `tests/` | 7 | Vitest 测试文件 |

### 翻译原则

- JSDoc 标签（`@param`、`@returns` 等）保留英文，仅翻译描述文字
- 代码符号引用（函数名、变量名、路径）保留原文
- 分隔线中的分段名翻译为中文，保留视觉结构
- 已是中文的注释不重复翻译
- 编译器/工具指令（`@ts-ignore`、`eslint-disable` 等）不翻译

### 验证

- `pnpm test` 全部通过 —— 纯注释修改，行为不发生任何变化
- 全局 grep 确认无英文注释遗漏

## Splash 页面延迟跳转（08-splash-delay）

在 `pages/splash/index.ts` 的 `onShow()` 中，`await app.whenReady()` 之后插入 500ms 固定延迟再执行路由跳转。当前快速登录场景下 `whenReady()` 可能在卡片翻转动画中途就 resolve，导致用户看不到完整动画。增加延迟后，splash 页面作为启动 banner 的展示时间得到保证。

改动范围：仅 `pages/splash/index.ts` 一处文件，`onShow()` 第 17 行后插入 `await new Promise(r => setTimeout(r, 500))`。

## Pages 纯函数提取（10-extract-pure-functions）

将 `miniprogram/pages/` 下各模块中嵌入在 Page 对象内的纯函数提取到模块级 `lib/` 目录，解耦业务逻辑与数据转换/工具函数。

### 识别依据

纯函数定义：无副作用（不读写 DB、不调 `setData`、不调 `wx.*` API），不依赖 `this.data`/`this._*` 实例字段，相同输入始终返回相同输出。

### 提取清单

#### 共享工具（→ `miniprogram/lib/group-utils.ts`）

| 函数 | 当前位置 | 说明 |
|------|---------|------|
| `getMemberCount(groups, groupId)` | `index/index.ts:154`, `dish-pool/index.ts:922`, `history/index.ts:82` | 三处完全相同的实现，提取到共享 lib |

#### index/（→ `pages/index/lib/helpers.ts`）

| 函数 | 说明 |
|------|------|
| `buildDrawCards(results, dishPool?)` | 将 `drawDishes()` 返回的抽取结果转为 UI 卡片数组 |
| `cardsToResults(cards)` | 将翻牌后的卡片数组反序列化为 `draw_history.results` 格式 |

#### dish-pool/（→ `pages/dish-pool/lib/helpers.ts`）

| 函数 | 说明 |
|------|------|
| `escapeRegex(str)` | 正则特殊字符转义，用于数据库模糊搜索 |

#### group-manage/（→ `pages/group-manage/lib/helpers.ts`）

| 函数 | 说明 |
|------|------|
| `buildProfileMap(profiles)` | `UserProfile[] → Record<string, string>` |
| `buildMemberInfoList(memberOpenids, profileMap, ownerOpenid)` | 构建成员信息列表（含 fallback 昵称） |
| `buildFallbackNickname(openid)` | 生成 `用户${openid.slice(-6)}` |

#### history/（→ `pages/history/lib/helpers.ts`）

| 函数 | 说明 |
|------|------|
| `buildRecordDisplayFields(dayGroups)` | 为 `groupByDay()` 结果中的每条 record 注入 `time` 和 `drawerLabel` 显示字段 |

#### history/（可选 → `pages/history/lib/canvas.ts`）

| 函数 | 说明 |
|------|------|
| `roundRect(ctx, x, y, w, h, r)` | Canvas 圆角矩形绘制（有 ctx 副作用但属于工具层） |
| `lineH(fs)` | 行高计算 |
| `measure(ctx, text, fs, bold?)` | 文本宽度测量 |

### 不作为提取的模块

- **splash** — 仅 25 行纯路由逻辑
- **mine** — 无纯函数可提取
- **profile-setup** — 无纯函数可提取
- **category-manage** — 所有逻辑依赖 `this.data`/`this._db`
- **draw-config-manage** — 所有逻辑依赖 `this.data`/`this._db`/storage
- **group-create/category-filter.wxs** — 已是独立文件

### 第二轮：大文件拆分与 DB 逻辑模块提取

第一轮提取后，部分页面文件仍超过 500 行。第二轮将 DB 密集型逻辑从 Page 方法中提取为独立模块（接受 `db`/`groupId` 等上下文参数，返回结果，不做 `setData`/toast），Page 方法退化为薄编排层。

| 页面 | 前 | 后 | 新增模块 |
|---|---|---|---|
| `dish-pool/index.ts` | 938 | 835 | `lib/search.ts` (74行) — `searchDishes`; `lib/import.ts` (133行) — `getImportSources`/`loadSourceCategories`/`executeImport`; `lib/save.ts` (87行) — `addDishToDb`/`updateDishInDb`/`diffRemovedImages`; `lib/helpers.ts` 追加 `buildCategoryMap` |
| `history/index.ts` | 655 | 430 | `lib/canvas.ts` 追加 `drawShareImage` (241行) — Canvas 分享图片绘制 |
| `index/index.ts` | 582 | 482 | `lib/helpers.ts` 追加 `archiveOldRecords`/`loadEnabledDishes`/`loadTodayRecords` (142行) |
| `group-manage/index.ts` | 494 | 494 | 未改动（已在阈值内） |

提取原则：
- DB 操作模块接受 `ctx: { db, groupId, ... }` 参数，返回纯数据
- 所有 toast、loading、setData 留在 Page 方法中
- 注释使用简体中文（遵循 CODING_STANDARDS.md）

### 验证

- `pnpm test` 全部通过
- 微信开发者工具中逐页回归关键用户路径

---

## Out of Scope

- 深层架构变更：纯函数模块（draw-engine、dish-pool、history、category-manage 等）的接口和实现不变
- 新增任何面向用户的功能（splash 延迟除外）
- 修改任何数据库 Schema 或云函数业务逻辑
- 引入第三方 UI 库或组件框架
- 云函数 `content-security` 和 `content-security-callback` 的代码整理（hardcode 极少，当前改动收益低）
- 样式系统重构：CSS 变量体系保持现状，config.ts 不从 WXSS 中提取颜色
- 国际化 / i18n 准备

---

## Further Notes

- 重构时不创建新的数据库集合或修改云开发配置
- config.ts 中不包含需要运行时动态计算的值（如从云函数获取的 appid 等）
- 所有函数签名遵循项目已有的 TypeScript 规范（`CODING_STANDARDS.md`）
- 本次重构产生的所有改动应在一次代码审查中审视，分阶段实施但合并为一个功能分支

---

## Loading UX 重构（#11–#13）

### Problem Statement

当前所有页面使用内联 `<text>加载中…</text>` 作为加载态，视觉效果单调；splash 页面有卡片翻转动画但代码无法复用；plugin-manage 页面同时显示系统弹窗 `wx.showLoading` 和内联加载文字，冗余。

### Solution

1. 从 splash 页面提取卡片翻转动画为可复用组件 `<loading-card>`，支持可选文案（默认 splash 品牌文案）
2. 全部 5 个页面替换内联加载文字为组件
3. Splash 页面自身也改用组件，消除 ~98 行重复 CSS

### 组件接口

```
<loading-card
  loading="{{Boolean}}"   // 显隐控制
  text="Flipia"           // 正面主文案，默认 "Flipia"
  subtext="让做饭不再纠结～" // 正面副文案，默认 "让做饭不再纠结～"
/>
```

### 实施

| Ticket | 内容 | 依赖 |
|--------|------|------|
| #11 | 创建 `loading-card` 组件 | 无 |
| #12 | 替换 5 个页面的内联加载态 + 移除 plugin-manage 冗余 toast | #11 |
| #13 | Splash 页面改用组件 | #11 |
| #14 | Splash 预取首页数据，消除过渡空白 | #13 |

### 涉及页面

- `category-manage`、`draw-config-manage`、`history`、`plugin-manage`、`index` — 替换内联 `loading-state`/`loading-hint`
- `splash` — 删除内联卡片动画，委托给组件
- plugin-manage — 额外移除 `wx.showLoading("加载中…")` 系统弹窗

### 验证

- 所有页面加载时展示统一卡片翻转动画，无文字闪烁
- Splash 启动视觉与改动前一致
- 无 `wx:else`/`wx:elif` 孤儿条件链错误
- 各页面 WXSS 中 `.loading-state`/`.loading-hint` 已清除

## Splash 预取首页数据（#14）

### Problem Statement

Splash → 首页的过渡链路存在四段视觉跳跃：splash loading → 首页空白 → 首页 loading-card → 首页内容。空白段来自 `switchTab` 后首页 `onLoad`/`onShow` 执行期间 `<loading-card>` 组件尚未完成首次渲染，短暂露出纯底页面。

### Solution

在 splash 的 1s 品牌延迟期间，并行预取首页所需的云端数据（`user_config` + `dishes` + `draw_history`），预取结果通过 `wx.setStorageSync(HOME_PREFETCH_KEY)` 传递给首页。首页 `onLoad` 检测到预取数据后直接恢复完整页面状态（`loadingConfig: false`），跳过加载态。

预取失败时静默降级：首页走原有自加载流程。

### 改动

| 文件 | 改动 |
|------|------|
| `constants/storage-keys.ts` | 新增 `HOME_PREFETCH_KEY` 键名 |
| `pages/splash/index.ts` | `onShow` 中并发预取首页数据，与 1s 延迟并行；预取结果 `setStorageSync` |
| `pages/index/index.ts` | `onLoad` 检查 storage 预取数据，命中则直接恢复状态；`onShow` 通过 `_prefetched` 标志跳过重复加载 |

### 验证

- Splash 期间静默预取，跳转到首页后直接展示内容
- 预取失败时首页自行加载
- 直接进入首页（非 splash 路由）不受影响
- 不污染 `globalData`，使用 `wx.*StorageSync` 传递
