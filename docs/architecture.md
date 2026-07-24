# Flipia 技术架构文档

## 1. 项目概述

**Flipia** 是一款基于微信小程序的**家庭厨房随机菜单决策工具**。核心理念：让"今天吃什么"变成一个有趣的决定。

**核心功能**：
- 创建厨房（群组），与家人共享菜品池
- 管理菜品分类与菜品条目
- 按自定义抽取方案随机生成菜单（Fisher-Yates 算法）
- 查看7天内的抽取历史
- 通过插件系统扩展功能

**AppID**: `wx57c3f2bccee8e8b8`  
**云环境**: `cloud1-d5gwv3g0da9888b0e`

---

## 2. 技术栈

| 分层 | 技术 | 说明 |
|------|------|------|
| **平台** | 微信小程序 | 原生 WXML / WXSS / TypeScript |
| **后端** | 微信云开发 | Serverless Node.js 云函数 |
| **数据库** | 微信云数据库 | NoSQL 文档数据库（`wx.cloud.database()`） |
| **状态管理** | Westore 0.1.12 | 腾讯开源小程序状态管理库 |
| **图标系统** | @mp-svg-icons/wechat | TDesign SVG 图标（按需树摇至 ~4KB） |
| **语言** | TypeScript 6.0.3 | 小程序端 (ES2017) + 云函数端 (CJS) |
| **包管理** | pnpm | Workspaces 多包管理 |
| **测试框架** | Vitest 4.1.10 | 11 个单元测试覆盖核心逻辑 |
| **构建** | Vite 6.4.3 | 仅用于测试解析；小程序本体通过微信开发者工具编译 |

**未使用**: React/Vue、传统 ORM、Docker、CI/CD Pipeline。这是纯粹的微信小程序 + 云开发项目。

---

## 3. 架构总览

```
┌─────────────────────────────────────────────────────┐
│                    微信小程序端                        │
│                                                      │
│  app.ts ─ 启动编排                                    │
│    ├── cloud.init() + login → openid                 │
│    ├── user-store.ts ← 用户会话状态                    │
│    ├── group-store.ts ← 群组/厨房状态                  │
│    └── plugin-store.ts ← 插件启用状态缓存              │
│                                                      │
│  Pages (11页) ─ WXML + WXSS + TS                     │
│  Components (6个) ─ app-icon, modal, flip-card 等     │
│  Lib (13模块) ─ draw-engine, sanitize, upload 等      │
│  Stores (3个) ─ Westore Store + standalone cache      │
│                                                      │
├─────────────────────────────────────────────────────┤
│                微信云开发 Backend                      │
│                                                      │
│  Cloud Functions (5个, Node.js)                       │
│    ├── login ─ openid 获取                            │
│    ├── group-manage ─ 群组 CRUD                       │
│    ├── plugin-manage ─ 插件系统                        │
│    ├── content-security ─ 内容安全审核                  │
│    └── content-security-callback ─ 异步回调处理         │
│                                                      │
│  Cloud Database (NoSQL)                               │
│    ├── users ─ 用户资料                                │
│    ├── groups ─ 群组文档                               │
│    ├── dishes ─ 菜品数据                               │
│    ├── user_config ─ 分类 + 抽取方案                    │
│    ├── draw_history ─ 抽取历史                          │
│    ├── user_plugin ─ 用户插件状态                       │
│    └── content_checks ─ 异步审核追踪                    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 4. 领域模型

### 4.1 核心实体

| 实体 | 英文 | 定义 |
|------|------|------|
| **群组/厨房** | Group | **唯一的数据所有权单元**。所有菜品、分类、方案、历史均属于某个群组。单独用户 = 大小为1的群组。 |
| **菜品** | Dish | 带有名称、分类、图片、启用/禁用状态的条目。附「创建者」标签（仅展示，无权限意义）。 |
| **分类** | Category | 菜品组织维度（荤菜、素菜、主食、汤等）。新建群组时自动预置4个默认分类。 |
| **抽取方案** | Draw Config Group | 一组抽取规则：指定哪些分类参与、每个分类抽取几个（1–5）。每群最多10个，支持不同场景。 |
| **生效方案** | Active Config | 群组中当前「使用中」的抽取方案。首页抽取按钮始终读取此配置。 |
| **抽取历史** | Draw History | 用户确认的抽取结果，7天滚动窗口。按日期分组，标注抽取者。 |

### 4.2 插件系统实体

| 实体 | 定义 |
|------|------|
| **插件** | 内置于小程序代码中的功能扩展。用户需手动触发解锁（条件评估），解锁后永久有效。可独立开关。 |
| **用户统计** | 跨群组累积行为指标（总菜品数、总抽取天数等），作为插件解锁条件的输入。 |
| **插件状态** | 每个用户独立的 `user_plugin` 文档，包含两个字段：`unlocked`（布尔，解锁后永久为 true）和 `enabled`（布尔，仅解锁后可切换）。 |

---

## 5. 前端架构

### 5.1 项目目录结构

```
miniprogram/
├── app.ts                     # 应用入口：云初始化、登录、群组启动编排
├── app.json                   # 页面注册 + 4个Tab页
├── app.wxss                   # 全局样式变量
├── config.ts                  # 集中配置：CLOUD | LIMITS | QUERY | STRINGS
├── pages/                     # 11 个页面
│   ├── splash/                # 启动闪屏
│   ├── profile-setup/         # 用户资料设置
│   ├── index/                 # 首页（抽取入口）
│   ├── dish-pool/             # 菜品池管理
│   ├── history/               # 抽取历史
│   ├── mine/                  # 个人中心/设置
│   ├── category-manage/       # 分类 CRUD
│   ├── draw-config-manage/    # 抽取方案管理
│   ├── group-create/          # 创建/加入厨房
│   ├── group-manage/          # 成员管理
│   └── plugin-manage/         # 插件管理
├── components/                # 6 个公共组件
│   ├── app-icon/              # 语义化图标组件（适配器模式）
│   ├── empty-state/           # 空状态占位
│   ├── flip-card/             # 翻牌动画
│   ├── group-switcher/        # 厨房切换器
│   ├── loading/               # 加载指示器
│   └── modal/                 # 底部弹出模态框
├── lib/                       # 13 个纯函数/工具模块
├── stores/                    # 3 个状态管理单元
│   ├── user-store.ts          # Westore 用户会话状态
│   ├── group-store.ts         # Westore 群组会话状态
│   └── plugin-store.ts        # 独立插件缓存（非 Westore）
├── styles/                    # 共享样式
└── types/                     # TypeScript 类型定义
```

### 5.2 状态管理架构

采用 **Westore**（腾讯开源，4.3k Stars）作为会话状态管理器。

**设计原则**：
- Store 仅管理**会话状态**，不作为云数据库缓存（云数据库始终是单一数据源）
- 模块级单例（`stores/index.ts` 导出实例）
- 页面通过 Westore 的 `create()` 绑定，自动 diff 最小 `setData`
- `openid` 保留在 `app.globalData` 中（常量，无需响应式订阅）

**Store 清单**：

| Store | 管理状态 | Key 方法 |
|-------|---------|--------|
| `userStore` | `nickName`, `avatarUrl`, `needProfileSetup` | `setProfile()`, `skipProfileSetup()` |
| `groupStore` | `groupId`, `groups[]`, `activeConfigId`, `lastDrawnConfigId` | `switchGroup()`, `setGroups()`, `setActiveConfig()` |
| `pluginStore` | 各插件 enable 状态缓存 | `loadPluginStore()` |

### 5.3 页面布局策略

所有 `.page` 根容器统一使用**绝对定位**，禁止 `100vh`。

```
# 含 group-switcher + TabBar 的页面
.page {
  position: absolute;
  top: 88rpx;
  left: 0;
  right: 0;
  bottom: 0;
}

# 普通页面
.page {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
```

**原因**: 微信小程序 `100vh` 等于设备全屏高度（含状态栏/导航栏/TabBar），实际可见区域仅 `windowHeight`，会导致底部内容被遮挡。绝对定位自动适配系统元素。

### 5.4 图标系统

采用**适配器模式**的统一图标组件 `<app-icon>`。

```
调用方                           <app-icon>                         图标后端
semantic name ─────────────► adapter 翻译 ─────────────► TDesign SVG
"CLOSE"                      icon-config.ts              @mp-svg-icons/wechat
"ADD"                        ICON_SEMANTIC_MAP
"CHEVRON_DOWN"
```

- 调用方始终使用语义化名称，不知晓后端实现
- 全局后端配置在 `lib/icon-config.ts`，单个实例可通过 `backend` prop 覆盖
- 后端切换：`@mp-svg-icons/wechat`（TDesign SVG），Data URI 渲染
- 构建时树摇：CLI 工具将 ~34 个有用图标裁剪至 ~4KB（11 个实际使用的图标）
- 颜色支持 `$token` 语法引用 CSS 变量

### 5.5 抽取引擎

位置：`lib/draw-engine.ts`

**算法**：每个分类独立执行 **Fisher-Yates 洗牌**，取前 N 个结果。若分类可用菜品少于请求数，返回全部（不报错）。

```typescript
// 核心接口
interface Dish { id: string; name: string; categoryId: string; enabled: boolean; }

interface DrawConfigEntry {
  categoryId: string;
  categoryName: string;
  count: number;  // 1–5
}

// 主函数（纯函数，无副作用）
drawDishes(pool: Dish[], config: DrawConfigEntry[]): DrawResultGroup[]

// 预校验
validateDrawConfig(pool: Dish[], config: DrawConfigEntry[]): ValidationResult
```

---

## 6. 后端架构

### 6.1 云函数清单

| 云函数 | 类型 | 说明 |
|--------|------|------|
| `login` | 普通 | 通过 `wx.getWXContext()` 返回 `openid` |
| `group-manage` | 普通 | 群组生命周期管理（6个操作） |
| `plugin-manage` | 普通 | 插件系统后端（3个操作） |
| `content-security` | 普通 | 文本 + 图片内容安全审核 |
| `content-security-callback` | **HTTP** | 接收微信异步审核回调 |

### 6.2 数据库集合设计

| 集合 | 核心字段 | 说明 |
|------|---------|------|
| `users` | `_openid`, `nickName`, `avatarUrl` | 用户资料 |
| `groups` | `_openid`, `name`, `members[]`, `joinCode`, `createdAt` | 群组文档 |
| `dishes` | `groupId`, `name`, `categoryId`, `enabled`, `creatorId`, `imageUrl` | 菜品条目 |
| `user_config` | `_openid`, `groupId`, `categories[]`, `drawConfigGroups[]`, `activeDrawConfigGroupId` | 用户配置（分类 + 方案嵌套存单文档） |
| `draw_history` | `groupId`, `drawerId`, `results[]`, `images[]`, `confirmedAt`, `status` | 抽取历史 |
| `user_plugin` | `_openid`, `plugins: { [id]: { unlocked, enabled } }` | 用户插件状态（惰性创建） |
| `content_checks` | `trace_id`, `fileId`, `status`, `suggest`, `collectionName`, `docId` | 异步审核追踪 |

### 6.3 群组管理（group-manage）

**入口**: `exports.main = async (event, context)` — 按 `event.action` 分发

| 操作 | 权限 | 说明 |
|------|------|------|
| `rename` | 任意成员 | 重命名群组 |
| `generate-invite-code` | 任意成员 | 生成6位邀请码（排除易混淆字符 O/0/I/1） |
| `join` | 任何人 | 凭邀请码加入（校验重复成员 + 人数上限） |
| `leave` | 任意成员 | 退出群组；最后一人退出触发级联删除 |
| `kick` | **仅群主** | 踢出成员 |
| `dissolve` | **仅群主** | 解散群组，级联删除所有关联数据 |

**级联删除** (`deleteGroupData`): 删除 `groups` 文档后，分批（MAX_LIMIT=100）并行删除 `user_config`、`dishes`、`draw_history` 中的全部记录。

**配置** (`config.js`): 成员上限 5 人，邀请码 6 位，群名最长 12 字。

### 6.4 插件系统（plugin-manage）

**架构模式**: 云函数中心化，手动解锁

```
plugin-manage/cloudfunctions/
├── index.js              # 入口分发：list | unlock | toggle
├── handlers.js           # 核心逻辑 + ensureUserPluginDoc
├── plugin-registry.js    # 插件注册表（定义数组）
├── config.js             # 集合名常量
└── custom-handlers/      # 每个插件的 assess() 函数
    └── demo-avatar.js    # 示例插件
```

**新增插件步骤**：
1. 在 `plugin-registry.js` 添加插件定义 + `assess` 函数
2. 在目标页面 WXML 中添加 `<plugin-component wx:if="{{enabled}}">`
3. 如需独立页面，在 `app.json` 的 `pages` 数组中声明路径

**解锁流程**：
```
用户点击「解锁」→ plugin-manage.unlock(id)
  → assess(stats: UserStats) → { passed, current, target, progressHint }
  → passed === true? 
      → 写入 user_plugin: unlocked: true, enabled: true
      → 返回成功
      → 返回进度信息
```

---

## 7. 内容安全架构

### 7.1 审核流水线

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  客户端   │────►│  云存储上传   │────►│  异步审核触发  │────►│  微信审核服务器    │
│ 格式化+压缩 │     │  (直接上传)   │     │ mediaCheckAsync│     │  (5–30s 内完成)    │
└─────────┘     └──────────────┘     └──────┬───────┘     └────────┬─────────┘
                                            │                      │
                                            │                      ▼
                                     ┌──────┴───────┐     ┌──────────────────┐
                                     │ content_checks │◄────│ content-security- │
                                     │   记录trace_id  │     │ callback (HTTP)    │
                                     └──────┬───────┘     │ 接收wxa_media_check│
                                            │             └──────────────────┘
                                            ▼
                                    risy? → 删除云文件 + 清除引用
```

**关键变更** (ADR-0004): 从同步 `imgSecCheck`（v1，已弃用）迁移至异步 `mediaCheckAsync`（v2），支持 10MB 图片。

---

## 8. 关键架构决策

| ADR | 决策 | 核心理由 |
|-----|------|---------|
| 0001 | 支持多抽取方案（最多10个，一个生效） | 不同场景需不同规则（日常晚餐 vs 周末家宴） |
| 0002 | **群组是唯一数据所有权单元** | 避免双账户模型（个人+群组）的复杂迁移/合并语义 |
| 0003 | 页面布局使用绝对定位，禁止 `100vh` | 微信小程序 `vh` 与实际可见区域不一致 |
| 0004 | 内容审核从同步 v1 迁移至异步 v2 | v1 已弃用、1MB 限制、开始返回未授权错误 |
| 0005 | `<app-icon>` 统一图标组件 + 适配器模式 | 后端切换时无需修改~34处调用点 |
| 0006 | 引入 Westore 管理会话状态 | 替代分散的 `globalData` + `onShow` 模式 |
| 0007 | 插件状态属于用户级（非群组级） | 避免跨群组重复解锁，解锁条件基于跨群组累积行为 |
| 0008 | 插件采用云函数中心化 + 手动解锁 + 硬编码组件注入 | 微信小程序不支持动态组件标签，手动解锁避免过度设计 |

---

## 9. 关键数据流

### 9.1 应用启动

```
app.onLaunch()
  ├── wx.cloud.init()
  ├── wx.cloud.callFunction("login") → openid → globalData
  ├── loadPluginStore() (fire-and-forget)
  ├── 查询 users 集合 → userStore
  │     └── 无记录? → 生成临时名, needProfileSetup = true
  └── 查询 groups 集合 → groupStore
        └── 无群组? → 自动创建 "我的厨房" + 默认分类 + 预置菜品
```

### 9.2 抽取流程

```
用户点击抽取
  → 读 groupStore.activeConfigId
  → 读取 user_config 中的生效抽取方案
  → 读取对应分类的菜品池
  → draw-engine.drawDishes(pool, config)
  → 展示结果（flip-card 动画）
  → 用户确认
  → 写入 draw_history
  → groupStore.setLastDrawnConfig(configId)
```

---

## 10. 工程实践

### 10.1 Monorepo 结构

```yaml
# pnpm-workspace.yaml
packages:
  - "miniprogram"
  - "cloudfunctions/*"
```

### 10.2 测试策略

- 11 个 Vitest 单元测试覆盖全部 `lib/` 模块
- 测试覆盖核心纯函数逻辑：`draw-engine`、`icon-config`、`sanitize`、`category-manage`、`dish-pool`、`draw-config-manage`、`history`、`init-data`、`plugin-manage`、`plugin-store`
- Vite 仅用于 Vitest 的路径别名解析

### 10.3 编码规范

- **集中配置**: 所有数值/字符串常量必须引用 `miniprogram/config.ts` 中的 `LIMITS`/`QUERY`/`STRINGS`
- **确认弹窗**: 必须使用 `lib/confirm.ts` 的 `showConfirm()` 包装，禁止直接调用 `wx.showModal`
- **输入清洗**: 文本输入统一通过 `lib/sanitize.ts` 的 `sanitizeInput()` 管道处理
- **图片上传**: 统一通过 `lib/upload-image.ts` 的 `uploadImages()` 管道，内含格式验证、压缩（>1MB）、直接上传和异步审核触发
- **存储键**: 所有 `wx.setStorageSync` / `wx.getStorageSync` 键名从 `constants/storage-keys.ts` 引用

---

## 11. 部署架构

- **无 Docker/CI/CD**：纯微信云开发 Serverless 部署
- **发布流程**：微信开发者工具 "上传" → 提交审核 → 审核通过后发布
- **云函数部署**：通过微信开发者工具逐个上传至云环境
- **HTTP 云函数**：`content-security-callback` 需额外配置 HTTP 触发器路径和消息推送 WebHook

---

*文档生成日期: 2026-07-24*  
*基于代码版本: 当前工作区*
