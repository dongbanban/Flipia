# Agent Workflow Guide

## 1. 新增需求

**有代码库：**

```
/grill-with-docs → /to-spec → /to-tickets → /implement × N
```

**无代码库（全新项目）：**

```
/grill-me → /to-spec → /to-tickets → /implement × N
```

---

## 2. 修改已有需求

**规模小（单模块内）：**

```
/grill-with-docs → /implement
```

**规模大（跨多模块）：**

```
/grill-with-docs → /to-spec → /to-tickets → /implement × N
```

---

## 3. 改 Bug

```
/diagnosing-bugs
  → /implement（修复 + 回归测试）
  → 若无好 seam 可锁住 bug → /improve-codebase-architecture
```

---

## 4. 重构

**常规重构：**

```
/improve-codebase-architecture（扫描 deepening opportunity）
  → /grill-with-docs
  → /to-spec → /to-tickets → /implement × N
```

**大范围机械重构（expand–contract）：**

```
ticket: expand（新形式加在旧形式旁，不破坏现有调用）
ticket: migrate × N（分批迁移，每批一张票，CI 始终绿）
ticket: contract（删旧形式，所有调用已迁移）
  → /implement 逐票执行
```

---

## 5. 技术栈升级

```
/research（调查目标版本 breaking changes 和迁移路径）
  → /grill-with-docs（把研究结论带入，决策迁移策略）
  → /to-spec → /to-tickets（拆 expand–contract 序列）
  → /implement × N
```

---

## 6. 折中方案先行（已知技术债）

某需求暂时采用保守实现，后期需调整。

**实施阶段（在主流程内进行）：**

```
/grill-with-docs
  ├─ 讨论中明确折中点 → /domain-modeling 记录 ADR（docs/adr/）
  │    ADR 内容：折中决策、原因、已知局限、触发重新评估的条件
  └─ /to-spec → /to-tickets
       ↑ 在对应 ticket 的 acceptance criteria 末尾注明折中点和 ADR 引用
  → /implement（按折中方案实现）
```

**后期调整时：**

```
/improve-codebase-architecture   ← 扫描时发现 ADR 标记的 deepening opportunity
  → /grill-with-docs（以 ADR 为输入讨论完整方案）
  → /to-spec → /to-tickets → /implement × N
```

**时间线说明：**

| 步骤              | 在哪个 skill 内完成                                       |
| ----------------- | --------------------------------------------------------- |
| 记录 ADR          | `/grill-with-docs` 阶段，决策形成时立即记录               |
| ticket 注明折中点 | `/to-tickets` 阶段，写票时在 acceptance criteria 末尾追加 |
| 按折中方案实现    | `/implement` 阶段                                         |
| 触发改进          | 后期跑 `/improve-codebase-architecture` 时发现            |

---

## 通用原则

| 原则           | 说明                                                         |
| -------------- | ------------------------------------------------------------ |
| 保持上下文     | grill → spec → tickets 在**同一上下文窗口**不中断            |
| 清空上下文     | 每个 `/implement` 开新会话，从票出发                         |
| 跨窗口桥接     | 上下文接近上限前用 `/handoff`，不强撑                        |
| 不重复 triage  | `/to-tickets` 产出的票已是 agent-ready，不需要再跑 `/triage` |
| bug 不走需求流 | 直接 `/diagnosing-bugs`，不先 grill                          |
