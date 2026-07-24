# ADR-0008: 插件体系——云函数集中管理，用户手动解锁

**Status:** accepted

**Supersedes:** earlier draft of ADR-0008 (plugin-architecture-v1)

## Context

插件体系初始设计为：操作自动触发评估、前端乐观评估 + 云函数权威裁定、共享条件逻辑包、类式注册清单、PluginStore。经 grilling 推演后发现核心需求简单——用户手动在管理页触发解锁——大量机制为过度设计。决定收缩到极简模型。

## Decision

### 核心原则

1. **用户手动解锁。** 没有自动触发、没有事件驱动、没有乐观评估。用户打开插件管理页，看到条件进度，点击解锁，云函数校验。
2. **云函数即注册源。** 所有插件定义、评估逻辑集中在 `plugin-manage` 云函数内。前端不持有注册清单，不持有条件逻辑。
3. **`user_plugin` 懒创建。** 用户首次访问插件管理页时由 `plugin-manage` 创建初始文档（全 locked + 全 disabled），不需要 login 云函数介入。
4. **页面 WXML 硬编码。** 受小程序不支持动态组件标签名限制，每个页面直接在 WXML 中声明插件组件标签并 `wx:if` 绑定启用状态。

### 架构形态

```
用户操作用
   ↓
插件管理页 ──→ plugin-manage 云函数
  (list)        ├─ 返回插件清单 + 用户状态 + 评估进度
  (unlock)      ├─ 跑 assess() → 达标则写 unlocked
  (toggle)      └─ 写 enabled 字段

目标页面 ───→ 本地 enabled 状态 ──→ wx:if 渲染插件组件
```

### plugin-manage 云函数结构

```ts
// cloudfunctions/plugin-manage/index.ts
const pluginDefs = [
  { id: 'nutrition', name: '营养分析', description: '...', assess(stats) { ... } },
];

// action: 'list'   → 返回 pluginDefs + user_plugin 状态 + 未解锁插件的评估进度
// action: 'unlock' → 跑指定插件的 assess()，达标写 user_plugin
// action: 'toggle' → 切换 enabled 字段
```

### 评估函数签名

```ts
interface PluginAssessment {
  passed: boolean;
  progressHint: string;   // "累计创建 3/5 道菜品"
  current: number;
  target: number;
}
```

### 不需要的机制

- ❌ 前端注册清单（`plugins/registry.ts`）
- ❌ 共享条件逻辑包（`packages/plugin-conditions/`）
- ❌ PluginStore（westore）
- ❌ 事件驱动评估触发
- ❌ 乐观评估 + 动画队列
- ❌ UserStats 启动预加载
- ❌ Plugin 基类继承
- ❌ login 云函数创建 `user_plugin`
- ❌ 插件废弃清理流程

## Consequences

- 加新插件时：在 `plugin-manage` 云函数的 `pluginDefs` 数组中加一条定义 + 写 `assess` 函数 + 在前端对应页面 WXML 加组件标签 + `app.json` 声明专属页面（如有）。三处改动。
- 前端需在启动时或进入管理页时调一次 `list` 获取最新的启用状态集合，缓存到本地变量供各页面 `wx:if` 使用
