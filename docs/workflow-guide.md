# Agent Workflow Guide

## 1. 大型探索（wayfinder）

**场景：** 绿场项目或超大功能构建，范围大到一次会话装不下，连从哪到哪的路径都看不清。

```
/wayfinder（建决策票地图，一次决议一张，产出决策而非交付物）
  → 路径清晰后 → /to-spec（把决策地图塌缩成可执行计划）
  → /to-tickets → /implement × N
```

**注意：** `/wayfinder` 只做探索和决策，不直接产出代码。范围明确的功能不要用它——直接走「新增需求」流程。

---

## 2. 外部需求流入（triage）

**场景：** Bug 报告、外部提的需求——不是你创建的，需要先分类、验证、写 agent-ready brief。

```
/triage（分类 → 验证 → 写 brief）
  → /implement（逐票执行）
```

**注意：** `/to-tickets` 产出的票已经是 agent-ready，**不要再 triage 它们**。triage 只用于外部流入的原始 issue。

---

## 3. 新增需求

**有代码库：**

```
/grill-with-docs → /to-spec → /to-tickets → /implement × N
```

**无代码库（全新项目）：**

```
/grill-me → /to-spec → /to-tickets → /implement × N
```

**支线 — 需要可运行答案时：** 在 grill 过程中，如果某个设计问题靠讨论解决不了（状态模型手感、UI 交互感觉），分叉到 prototype：

```
/grill-with-docs
  └─ 卡在某个设计问题
       → /handoff（导出当前上下文）
       → 新会话中 /prototype（建临时代码，得到答案，删掉代码）
       → /handoff（把结论带回原线程）
       → 继续 /grill-with-docs
```

---

## 4. 修改已有需求

**规模小（单模块内）：**

```
/grill-with-docs → /implement
```

**规模大（跨多模块）：**

```
/grill-with-docs → /to-spec → /to-tickets → /implement × N
```

---

## 5. 改 Bug

```
/diagnosing-bugs
  → /implement（修复 + 回归测试）
  → 若无好 seam 可锁住 bug → /improve-codebase-architecture
```

---

## 6. 重构

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

## 7. 技术栈升级

```
/research（调查目标版本 breaking changes 和迁移路径）
  → /grill-with-docs（把研究结论带入，决策迁移策略）
  → /to-spec → /to-tickets（拆 expand–contract 序列）
  → /implement × N
```

---

## 8. 折中方案先行（已知技术债）

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

## 9. 独立工具

这些 skill 不参与主流程管线，按需独立使用。

### `/prototype` — 用临时代码回答设计问题

**场景：** 某个设计问题纸上谈兵解决不了——状态机流转手感对吗？这个 UI 交互到底长什么样？——需要跑起来的代码来验证。

**原则：** 用完就扔。保留答案，删除代码。

**使用方式：**
- 作为主流程支线：通过 `/handoff` 从 grill 线程分叉出去，得到答案后 `/handoff` 回来
- 独立使用：任何需要可运行答案的设计问题都可以用它

### `/teach` — 跨会话学习

**场景：** 学一个新概念或技能，需要分多次会话、有状态地推进。工作区在当前目录下持久化，每次打开新会话都从上次进度继续。

**使用方式：** 直接调用 `/teach`，告诉它你要学什么。

### `/research` — 后台调查

**场景：** 需要调查一个问题但不想自己花时间读文档。扔给后台 agent，它去读一手资料，产出带引用的 Markdown 文件。

**使用方式：**
- 作为主流程前置（如技术栈升级中调查 breaking changes）
- 独立使用：任何需要阅读量的调查，产出文件可带入 `/grill-with-docs`

---

## 10. 底层词汇

这些 skill 不直接参与流程，而是其他 skill 的**语言基础**。当问题出在**词语本身**而非流程时，直接调用它们。

### `/codebase-design` — 深层模块设计词汇

**核心概念：** 模块、接口、深度、接缝（seam）、适配器、杠杆（leverage）、局部性（locality）。

**使用场景：** 设计模块接口形状——大量行为藏在简洁接口后面，挂在干净的接缝上。纠结接缝放哪、模块怎么分层、想让代码更好测或更利于 AI 导航时用它。

**调用方式：** 通常是 `/tdd` 和 `/improve-codebase-architecture` 自动拉它进来作为底层语言。单独调用它：当你要**设计一个模块的接口**，而不是走完整流程。

### `/domain-modeling` — 领域语言词汇

**核心概念：** 领域术语、普适语言（ubiquitous language）、ADR（架构决策记录）。

**使用场景：**
- 发现项目里同一个词干了多件事（如 "account" 既指用户又指财务账户），需要消歧
- 记录难以逆转的架构决策（ADR），放在 `docs/adr/` 下
- 打磨领域术语让 `CONTEXT.md` 更精确

**调用方式：** 通常由 `/grill-with-docs` 驱动。单独调用它：当问题出在**术语**上，而不是整个功能设计。

---

## 通用原则

| 原则           | 说明                                                         |
| -------------- | ------------------------------------------------------------ |
| 保持上下文     | grill → spec → tickets 在**同一上下文窗口**不中断            |
| 清空上下文     | 每个 `/implement` 开新会话，从票出发                         |
| 跨窗口桥接     | 上下文接近上限前用 `/handoff`，不强撑                        |
| 不重复 triage  | `/to-tickets` 产出的票已是 agent-ready，不需要再跑 `/triage` |
| bug 不走需求流 | 直接 `/diagnosing-bugs`，不先 grill                          |
| wayfinder 不施工 | 产出决策而非代码，路径清晰后交接给 `/to-spec`              |
| prototype 用完就扔 | 保留答案，删除临时代码                                   |
| vocabulary 按需调用 | `/codebase-design` 和 `/domain-modeling` 当词语本身是问题时直接调用，不需要走主流程 |
