# 05 — 替换剩余散落 hardcode：query limits、云环境 ID、品牌字符串

**What to build:** 将 app.ts 和各页面中尚未被 Ticket 02-04 覆盖的散落 hardcode（数据库查询的 magic number limit、云环境 ID、默认厨房名等）替换为 config.ts 引用。

**Blocked by:** 01（需要 config.ts 已创建）

**Status:** done

- [x] `app.ts` 中云环境 ID 替换为 `CLOUD.envId` (already resolved by ticket 02/03)
- [x] `app.ts` 中默认厨房名 `"我的厨房"` 替换为 `STRINGS.DEFAULT_GROUP_NAME` (already resolved)
- [x] `lib/init-data.ts` 中默认方案名 `"雨露均沾"` 替换为 `STRINGS.DEFAULT_DRAW_CONFIG_NAME` (already resolved)
- [x] 各页面 `.limit(1)`、`.limit(20)`、`.limit(50)`、`.limit(100)` 替换为 `QUERY.LIMIT_*` 命名常量 (already resolved; `.limit(1)` left as-is per standard pattern)
- [x] 抽签方案管理页面的方案上限 10 替换为 `LIMITS.DRAW_CONFIG_GROUP_MAX` (already resolved)
- [x] 历史分享图品牌名 `"Flipia时刻"` 替换为 `STRINGS.BRAND_NAME`
- [x] 替换前后的值完全一致，通过 grep 交叉比对验证
- [x] `pnpm test` 全部通过 (164 tests, 7 files)
