# 01 — 创建统一配置文件 config.ts

**What to build:** 创建 `miniprogram/config.ts`，将当前散落在 10+ 个文件中的 hardcoded 常量收敛到一个文件中。不影响任何已有功能。

**Blocked by:** 无 — 可立即开始。

**Status:** done

- [x] 创建 `miniprogram/config.ts`，按职责分区导出 `LIMITS`、`QUERY`、`CLOUD`、`STRINGS`、`HISTORY_WINDOW_DAYS`、`INVITE_CODE_LENGTH`
- [x] `LIMITS` 收敛：图片大小上限、分类名/菜品名/方案名/厨房名长度限制、方案套数上限、单分类抽取数范围、厨房最大人数、批量导入上限、图片数量上限
- [x] `QUERY` 收敛：历史查询 limit、用户配置查询 limit、通用最大 limit
- [x] `CLOUD` 收敛：云环境 ID
- [x] `STRINGS` 收敛：默认厨房名、默认抽取方案名、品牌名
- [x] 预设数据（4 个默认分类、20 道预设菜品）留在 `lib/init-data.ts`，不迁入 config
- [x] 所有导出值的数值与原 hardcode 完全一致
- [x] `pnpm test` 全部通过（现有测试不依赖这些常量的具体来源）

## Comments

`a013dd9` — 创建 `miniprogram/config.ts` 收敛 13 个文件中的 hardcoded 常量，164 tests 全部通过。
