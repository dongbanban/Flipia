# 10-extract-pure-functions: 从 pages 模块提取纯函数

**Label:** done  
**Created:** 2026-07-22  
**Depends on:** 01-create-config, 03-sanitize-confirm-utils  
**Spec:** `spec.md#pages-纯函数提取`

---

## 范围

将 `miniprogram/pages/` 下各模块中嵌入在 Page 对象内的纯函数（无副作用、不依赖 `this.data`/`wx.*`/DB）提取到各模块或共享目录下，解耦业务逻辑与数据转换/工具函数，保持页面文件职责单一。

## 识别出的纯函数清单

### 1. `pages/index/index.ts` — 首页

| 函数 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `_getMemberCount` | 154-160 | `(groups, groupId) => number` | 从群组列表中查找指定群组的成员数。**同时出现在 `dish-pool`（922-924）和 `history`（82-84）中** |
| `buildDrawCards` | 402-418 (内联) | `(results: DrawCategoryResult[], dishPool?: Dish[]) => DrawCard[]` | 将 `drawDishes()` 返回的抽取结果转换为 UI 卡片数组 |
| `cardsToResults` | 500-523 (内联) | `(cards: DrawCard[]) => Array<{categoryId, categoryName, dishes: Array<{dishId, dishName, imageUrl}>}>` | 将翻牌后的卡片数组反序列化为 `draw_history` 的 results 格式 |

### 2. `pages/dish-pool/index.ts` — 菜品池

| 函数 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `_escapeRegex` | 228-229 | `(str: string) => string` | 对正则特殊字符进行转义，用于数据库模糊搜索 |

### 3. `pages/group-manage/index.ts` — 厨房管理

| 函数 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `buildProfileMap` | 227-230 (内联) | `(profiles: UserProfile[]) => Record<string, string>` | 将用户档案数组转换为 `{openid: nickName}` 映射 |
| `buildMemberInfoList` | 232-237 (内联) | `(memberOpenids: string[], profileMap: Record<string, string>, groupOwnerOpenid: string) => MemberInfo[]` | 根据成员 openid 列表和昵称映射，生成成员信息列表（含 fallback 昵称"用户xxxxxx"和首字提取） |
| `buildFallbackNickname` | 244 (内联) | `(openid: string) => string` | 生成默认昵称 `用户${openid.slice(-6)}` |

### 4. `pages/history/index.ts` — 历史记录

| 函数 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `buildDateLabel` | 193-200 (内联) | `(records: DrawHistoryRecord[]) => DayGroup[]` 中的 label 构建逻辑 | 将 `groupByDay()` 结果中的每个 record 注入 `time` 和 `drawerLabel` 显示字段 |
| Canvas 布局/绘制工具 | 464-484 (内联) | `roundRect`, `lineH`, `measure` | 分享图片 Canvas 绘制的辅助函数（`roundRect` 有 ctx 副作用，但属于工具层的可分离关注点） |

## 目标目录结构

```
miniprogram/pages/
├── index/
│   ├── index.ts          ← 精简后的页面逻辑
│   └── lib/              ← NEW
│       └── helpers.ts    ← buildDrawCards, cardsToResults
├── dish-pool/
│   ├── index.ts
│   └── lib/              ← NEW
│       └── helpers.ts    ← escapeRegex
├── group-manage/
│   ├── index.ts
│   └── lib/              ← NEW
│       └── helpers.ts    ← buildProfileMap, buildMemberInfoList, buildFallbackNickname
├── history/
│   ├── index.ts
│   └── lib/              ← NEW
│       └── helpers.ts    ← buildRecordDisplayFields (time/drawerLabel 注入)
│       └── canvas.ts     ← roundRect, lineH, measure（可选，视复杂度收益）
└── lib/
    └── group-utils.ts    ← NEW（共享）
                          ← getMemberCount（从 index/dish-pool/history 三处提取到一处）
```

共享的 `_getMemberCount` 因在 3 个页面中重复出现，提取到 `miniprogram/lib/group-utils.ts` 而非任一页面的 `lib/` 下。

## 实施步骤

### Step 1: 创建 `miniprogram/lib/group-utils.ts`
- 导出 `getMemberCount(groups, groupId): number`
- 替换 `index/index.ts`、`dish-pool/index.ts`、`history/index.ts` 中的 `_getMemberCount` 调用

### Step 2: 提取各页面纯函数
- 为 `index/`、`dish-pool/`、`group-manage/`、`history/` 创建 `lib/` 目录和对应的 `helpers.ts`
- 将纯函数移入，页面中改为 import 调用

### Step 3: 内联逻辑函数化
- 将 `buildDrawCards`、`cardsToResults`、`buildProfileMap`、`buildMemberInfoList` 等当前以内联代码块存在于 async 方法中的逻辑，提取为独立具名函数并导出
- `buildDrawCards` 和 `cardsToResults` 的签名需考虑 `Dish` 类型来自 `draw-engine.ts`

### Step 4 (可选): 提取 Canvas 纯工具
- 将 `pages/history/index.ts` 中 `_drawShareImage` 内的 `roundRect`、`lineH`、`measure` 提取到 `pages/history/lib/canvas.ts`
- `roundRect` 接受 `ctx` 参数（有副作用，但属于工具层)，与布局计算逻辑解耦

## 不作为
- `pages/splash/index.ts`：无纯函数可提取（仅 25 行，纯路由逻辑）
- `pages/mine/index.ts`：无纯函数可提取
- `pages/profile-setup/index.ts`：无纯函数可提取
- `pages/category-manage/index.ts`：所有逻辑依赖 `this.data`/`this._db`，无可提取的纯函数
- `pages/draw-config-manage/index.ts`：所有逻辑依赖 `this.data`/`this._db`/storage
- `pages/group-create/category-filter.wxs`：已是独立文件，无需移动

## 验证
- `pnpm test` 全部通过
- [x] `pnpm test` 全部通过
- [x] TypeScript 编译无错误
- [ ] 微信开发者工具中逐页回归关键路径：首页抽取、菜品池搜索/编辑、厨房成员管理、历史记录分享图生成

## Comments

- **Commit:** `350605d` — refactor: extract pure functions from pages into lib modules
- **Summary:** 创建了 1 个共享模块 (`lib/group-utils.ts`) 和 5 个页面级 helper 模块，从 4 个页面中提取了 11 个纯函数。所有 179 个测试通过，TypeScript 编译无错误。消除了 `_getMemberCount` 在 3 个页面中的重复定义。
