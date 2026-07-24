# Plugin System — Spec

**Status:** ready-for-agent

## Problem Statement

用户在 Flipia 中使用核心功能（菜品管理、抽取、历史记录）时，无法获取超出基础功能范围的能力。随着产品演进，需要引入新的增值功能（如营养分析、周报统计），但这些功能不应强制推送给所有用户——应允许用户按需解锁、按需启用。同时，部分功能希望设置一个门槛（如"连续使用 7 天后解锁"），以激励持续使用。

## Solution

引入插件体系：将新功能以"插件"形式内置于小程序中，用户在**插件管理页**查看可用插件列表、查看解锁条件及当前进度、手动触发解锁。解锁条件为一次性校验，通过后永久解锁，用户可随时启用/禁用。启用后的插件通过 WXML 组件标签注入到对应页面中，或作为独立专属页面访问。

## User Stories

1. 作为用户，我希望在一个集中页面看到所有可用插件的列表，了解每个插件的功能和用处
2. 作为用户，我希望看到每个未解锁插件的解锁条件及我的当前进度（如"累计创建 3/5 道菜品"），以便知道还需做什么才能解锁
3. 作为用户，我希望点击"解锁"按钮后系统立即判定我是否满足条件——满足则解锁成功，不满足则提示我还差什么
4. 作为用户，我希望已解锁的插件永久保持解锁状态，不会因任何操作而重新锁定
5. 作为用户，我希望已解锁的插件可以随时手动启用或禁用，控制哪些功能出现在我的使用中
6. 作为用户，我希望禁用插件后，该插件的 UI 立即隐藏，但插件已产生的数据不丢失（重新启用后数据仍可见）
7. 作为用户，我希望在另一台设备上登录后，我的插件解锁和启用状态与之前保持一致
8. 作为用户，我希望看到已解锁但未启用的插件被标记出来，以便我能发现并尝试新功能
9. 作为用户，当我解锁一个新插件时，希望能看到一个确认反馈（如成功提示），让我知道解锁已生效
10. 作为用户，我可以在菜品详情页看到已启用插件注入的额外信息（如营养数据面板）
11. 作为用户，我可以通过已启用插件的专属页面进入其完整功能界面

## Implementation Decisions

### 架构

- 插件定义集中在 `plugin-registry.js`，评估逻辑集中在 `custom-handlers/`，状态管理集中在 `plugin-manage` 云函数内。前端不持有插件注册清单、不持有条件判断逻辑。
- `plugin-manage` 的 `list` 操作有两个触发点：
  - **启动时**：小程序启动时调用一次，缓存 enabled 状态映射供所有目标页面 `wx:if` 使用。不拉时目标页面无法判断是否渲染插件组件
  - **进入插件管理页时**：再次调用获得最新状态和评估进度（管理页自身需要），确保显示实时数据
- 前端不创建 `user_plugin` 文档——`plugin-manage` 云函数在 `list` 或 `unlock` 操作中发现文档不存在则自动创建初始状态（全 locked + 全 disabled）。login 云函数不参与插件初始化。
- 不接受共享条件逻辑包（`packages/`）或前端注册清单——当前插件数量少，不因"将来可能有"而过度设计。

### `plugin-manage` 云函数

- 通过 `action` 参数区分三种操作：
  - `list`：返回所有插件定义（名称、描述）+ 用户当前状态（unlocked/enabled）+ 未解锁插件的评估进度（progressHint、current、target）
  - `unlock`：接收插件 ID，对该插件运行 `assess` 评估函数。若 `passed: true`，将 `user_plugin` 文档中对应条目设为 `unlocked: true, enabled: true`；若 `passed: false`，返回评估结果（进度信息），不修改状态
  - `toggle`：接收插件 ID 和 `enabled: boolean`，仅对 `unlocked: true` 的插件写入。已锁定插件拒绝操作
- 插件定义集中在 `plugin-registry.js` 中声明，是一个数组，每个条目包含 `id`、`name`、`description`。各插件的评估逻辑放在 `custom-handlers/` 目录下，每个插件自带 `assess(db, openid)` 函数
- `assess` 函数签名返回：

```ts
interface PluginAssessment {
  passed: boolean;
  progressHint: string;   // 如 "累计创建 3/5 道菜品"
  current: number;
  target: number;
}
```

- `assess` 函数直接接收 `db` 和 `openid` 参数，在函数内部自行查询所需数据。查询失败时返回错误，不进行部分评估
- `list` 操作返回已解锁插件的评估结果（passed: true，便于管理页展示完成状态）

### 数据模型

- `user_plugin` 云数据库集合，每个用户一条文档，结构：

```json
{
  "_openid": "xxx",
  "plugins": {
    "<pluginId>": { "unlocked": true, "enabled": false }
  }
}
```

- 文档在首次访问插件管理页时懒创建，初始值全 `unlocked: false, enabled: false`（即全部锁定、全部禁用）。后续由 `unlock` 和 `toggle` 操作增量更新对应条目
- 加新插件时，已有用户文档中不存在该插件的条目——`list` 操作检测到缺失时自动补初始化条目并向文档写入

### 前端

- `stores/plugin-store.ts`：轻量缓存模块。暴露 `load()`（调 `plugin-manage` 的 `list`，由 `app.ts` 在启动时调用）、获取 enabled 状态映射供各页面 `wx:if` 使用。不继承现有 westore Store。管理页进入时独立调用 `list` 获取实时进度数据，不依赖 `plugin-store` 缓存
- **插件管理页**：`miniprogram/pages/plugin-manage/`
  - 2 列网格布局（`grid-template-columns: 1fr 1fr`），每张卡片使用 `<flip-card>` 通用组件
  - 调用 `plugin-manage` 的 `list` 渲染列表。解锁（调用 `unlock`）和开关切换（调用 `toggle`）均通过该云函数
  - 未解锁卡片（背面，默认可见）：插件名称 → 环形进度指示器（`conic-gradient`，中心显示百分比）→ 说明文字 → 解锁按钮（进度未满时 `disabled`）
  - 解锁后触发 3D 翻转动画（`rotateY(180deg)`），展示正面
  - 已解锁卡片（正面）：插件名称 → 功能说明 → 启用/禁用开关（`<switch>`，左侧状态文案，右侧开关）
  - 色值方案复用首页抽取卡片：背面 `linear-gradient(135deg, #c8815e, #d9a98c)`，正面 `var(--color-primary-light)` 底 + `var(--color-primary)` 边框
- **`components/flip-card/`**：通用 3D 翻牌卡片组件。属性 `flipped`（控制翻转）、`redrawing`（快速过渡）、`width`/`height`（尺寸）。两个具名 slot：`back`（背面，渐变背景）和 `front`（正面，浅色背景）。动画参数：`perspective: 1200rpx`, `transition: transform 0.6s ease`, `backface-visibility: hidden`。首页抽取卡片和插件管理页共用此组件
- `handleUnlock` 解锁达标时同时写入 `unlocked: true` + `enabled: true`，前端不再冗余判断解锁条件（按钮 `disabled` 已兜底）
- 目标页面 WXML：硬编码插件组件标签，`wx:if` 绑定 `plugin-store` 的启用状态。无中心化 `<plugin-injector>` 组件
- 插件专属页面：在 `app.json` 的 `pages` 数组中直接声明路径
- 导航入口位于「我的」页面菜单列表（`mine/index.wxml` 中新增"插件管理"菜单项）

### 废弃插件处理

- `plugin-registry.js` 中移除条目即视为废弃。`list` 操作检测到 `user_plugin` 文档中存在但不在当前 defs 中的条目时，自动清理

## Testing Decisions

### 测试原则

- 测试外部行为，不测试内部实现细节
- 云函数测试关注：给定输入 + 数据库状态，验证输出和数据库写入是否正确

### 测试对象

1. **`plugin-manage` 云函数**（主要）：覆盖 `list`、`unlock`、`toggle` 三种操作的输入输出及数据库副作用。vitest + 模拟/真实云数据库环境
2. **`stores/plugin-store.ts`**（次要）：单元测试，模拟 `plugin-manage` 返回，验证缓存逻辑和 `isEnabled` 查询
3. 插件管理页及目标页面 WXML 渲染逻辑：手动验证/截图回归（不编写自动化 UI 测试）

### 测试用例覆盖

- `list`：新用户（无文档）→ 自动创建 + 返回全 locked+disabled；已有用户 → 返回正确状态 + 评估进度
- `unlock`：条件达标 → unlocked 设为 true 并成功返回；条件不达标 → 返回评估结果，不修改状态；重复 unlock → 幂等
- `toggle`：locked 插件 → 拒绝；unlocked 插件 → 更新 enabled；非 exist 插件 → 报错
- 废弃插件在 `list` 中被清理

### Prior art

现有测试在 `tests/` 目录下，使用 vitest + `describe/it/expect`。测试纯逻辑模块（如 `draw-engine`、`dish-pool`）——通过直接 import 被测试模块并调用函数。此模式可直接应用于 `plugin-store` 测试。

## Out of Scope

- 插件间的依赖关系（如 B 依赖 A 已解锁）
- 插件的卸载或从包体中删除的条件
- 基于用户操作自动触发解锁（全部手动触发）
- 插件条件的新维度（如积分、连续签到）——各插件可自行扩展 `assess` 查询，暂不定义
- 插件的 A/B 测试或灰度发布

## Further Notes

- 加新插件的主要改动点：`plugin-registry.js`（加插件声明条目）、`custom-handlers/`（加对应的 `assess(db, openid)` 处理器）、对应页面 WXML（加 `wx:if` 组件标签）、`app.json`（如有专属页面）。每加一个插件涉及 3-4 处改动。
- 后续引入实际统计维度时在对应插件的 `assess` 函数内自行扩展查询逻辑即可，不涉及架构变更。
- 架构决策详见 ADR-0007（用户级数据）和 ADR-0008（插件架构）。
