# Config Files & Public Utilities

本文件收录项目中所有配置文件的职责说明以及公共方法/组件的功能描述。新增常量或工具函数时，优先归入已有模块。

---

## 配置文件

### 1. `miniprogram/config.ts` — 小程序端统一配置

分散在 10+ 个文件中的 hardcode 常量的唯一事实来源。按职责分区导出：

| 导出 | 类型 | 说明 |
|---|---|---|
| `CLOUD` | `{ envId }` | 云开发环境 ID |
| `LIMITS` | object | 所有数值上限/阈值：图片大小、各类名称长度、方案套数、抽取数范围、成员上限、导入上限、图片数量等 |
| `QUERY` | object | 数据库查询分页大小：历史记录、用户配置、通用最大 limit |
| `STRINGS` | object | 品牌与默认文案：默认厨房名、默认方案名、品牌名 |
| `HISTORY_WINDOW_DAYS` | `number` | 抽签历史归档窗口（天） |
| `INVITE_CODE_LENGTH` | `number` | 邀请码长度 |

**使用规则：**
- 任何页面或 lib 文件中的数字/字符串字面量，若对应 `LIMITS` / `QUERY` / `STRINGS` 中的已有常量，必须从 `config.ts` 引用。
- 仅页面内的 toast 提示文案允许保留在各页面（不迁入 config）。

### 2. `cloudfunctions/group-manage/config.js` — 厨房管理云函数配置

| 常量 | 说明 |
|---|---|
| `MAX_MEMBERS` | 厨房最大成员数 |
| `INVITE_CODE_LENGTH` | 邀请码长度 |
| `INVITE_CODE_CHARS` | 邀请码字符集（不含易混淆字符） |
| `GROUP_NAME_MAX_LENGTH` | 厨房名最大长度 |
| `MAX_LIMIT` | 数据库查询上限 |

### 3. `cloudfunctions/content-security/config.js` — 内容安全云函数配置

| 常量 | 说明 |
|---|---|
| `SCENE_MSG_SEC_CHECK` / `VERSION_MSG_SEC_CHECK` | 文本安全审核 API 参数 |
| `MEDIA_TYPE_IMAGE` / `VERSION_MEDIA_CHECK` / `SCENE_MEDIA_CHECK` | 图片异步审核 API 参数 |
| `ERR_CODE_RISKY` | 微信风控错误码 |
| `URL_REGEX` | URL 过滤正则 |
| `COLLECTION_CONTENT_CHECKS` | 审核记录集合名 |
| `STATUS_PENDING` / `SUGGEST_RISKY` | 审核状态/建议值 |

### 4. `cloudfunctions/content-security-callback/config.js` — 内容安全回调云函数配置

| 常量 | 说明 |
|---|---|
| `COLLECTION_DISHES` / `COLLECTION_CONTENT_CHECKS` / `COLLECTION_DRAW_HISTORY` | 数据库集合名 |
| `FIELD_*` | 数据库字段名常量（`imageUrl`、`images`、`trace_id`、`status`、`suggest` 等） |
| `QUERY_LIMIT_HISTORY` / `QUERY_LIMIT_SINGLE` | 查询分页大小 |
| `STATUS_RISKY` / `STATUS_PASS` | 审核结果状态值 |
| `EVENT_WXA_MEDIA_CHECK` / `EVENT_TYPE_EVENT` | 微信回调事件类型 |

---

## 公共方法

### `uploadImages(options)` — 图片上传全流程

**文件：** `miniprogram/lib/upload-image.ts`

封装图片上传的完整管线：选图 → 校验/压缩 → 云存储上传 → 异步内容审核。

```ts
function uploadImages(options: UploadImageOptions): Promise<string[]>
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `count` | `number` | 最大选择图片数 |
| `sourceType` | `Array<"album" \| "camera">` | 图片来源，默认 `["album", "camera"]` |
| `showToast` | `boolean` | 是否显示上传中 toast，默认 `true` |

**返回值：** `Promise<string[]>` — 上传成功后的云存储 fileID 数组。

**内部流程：**
1. `wx.chooseImage` — 用户选图
2. `validateAndCompressImage` — 格式校验 + 超过 1MB 时压缩
3. `wx.cloud.uploadFile` — 上传至云存储
4. `checkImageAsync` — fire-and-forget 异步内容安全审核（不阻塞返回）

**不适用场景：**
- 使用 `wx.chooseAvatar` API 的头像场景（`profile-setup`、`mine` 页面）—— 选图和上传流程分离，不适用此封装。

---

### `sanitizeInput(options)` — 文本输入安全校验

**文件：** `miniprogram/lib/sanitize.ts`

统一的用户文本输入清洗与校验管线。

```ts
function sanitizeInput(options: SanitizeOptions): Promise<SanitizeResult>
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `value` | `string` | 原始输入文本 |
| `maxLength` | `number` | 最大允许长度 |
| `fieldName` | `string` | 字段中文名（用于 toast） |
| `showToast` | `boolean` | 校验失败时是否显示 toast，默认 `true` |

**返回值：** `Promise<{ valid: boolean; value: string }>` — `valid` 表示是否通过，`value` 为 trim 后的文本。

**校验顺序：** trim → 非空检查 → 最大长度检查 → `checkTextWithToast` 内容安全审核。任一环节失败即返回 `{ valid: false }`。

**使用规则：**
- 长度参数 `maxLength` 必须从 `config.ts` 的 `LIMITS` 中读取，禁止 hardcode。
- toast 提示文案保留在各页面调用处，不传入 `sanitizeInput`。

---

### `showConfirm(options)` — 统一样式的确认弹窗

**文件：** `miniprogram/lib/confirm.ts`

封装 `wx.showModal`，预设主题色 `confirmColor`，确保全局确认按钮视觉一致。

```ts
function showConfirm(options: ConfirmOptions): Promise<boolean>
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `title` | `string` | 弹窗标题 |
| `content` | `string` | 弹窗内容 |
| `confirmText` | `string` | 确认按钮文案，默认 `"确认"` |
| `cancelText` | `string` | 取消按钮文案，默认 `"取消"` |

**返回值：** `Promise<boolean>` — 用户点击确认为 `true`，取消或关闭为 `false`。

**使用规则：**
- 所有需要确认弹窗的场景必须使用 `showConfirm()`，禁止直接调用 `wx.showModal` 并硬编码 `confirmColor`。

---

## 公共组件

### Modal — 通用底部弹出弹窗

**文件：** `miniprogram/components/modal/`（`.ts` / `.wxml` / `.wxss` / `.json`）

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `show` | `Boolean` | `false` | 是否显示 |
| `title` | `String` | `""` | 标题 |
| `confirmText` | `String` | `""` | 确认按钮文案 |
| `cancelText` | `String` | `""` | 取消按钮文案 |

| 事件 | 说明 |
|---|---|
| `bind:confirm` | 点击确认 |
| `bind:cancel` | 点击取消 |
| `bind:close` | 点击遮罩关闭 |

支持 `<slot />` 插入自定义内容。样式通过 CSS 变量引用主题色，无硬编码颜色值。

---

### EmptyState — 通用空状态占位

**文件：** `miniprogram/components/empty-state/`（`.ts` / `.wxml` / `.wxss` / `.json`）

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `text` | `String` | `""` | 空状态提示文案 |
| `icon` | `String` | `""` | 可选图标（为空时不显示） |
| `actionText` | `String` | `""` | 可选操作按钮文案（为空时不显示） |

| 事件 | 说明 |
|---|---|
| `bind:action` | 点击操作按钮 |

样式通过 CSS 变量引用主题色和间距，无硬编码值。
