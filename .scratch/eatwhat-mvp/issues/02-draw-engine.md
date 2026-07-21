# 02 — Draw Engine

**What to build:** 实现并充分测试抽取引擎纯函数。该函数接收启用菜品列表和抽取配置，返回按分类分组的抽取结果，保证同一分类内无重复。在 Node 环境（不依赖小程序运行时或云 SDK）中可独立运行测试。

**Blocked by:** 01 — 项目脚手架

**Status:** done

- [x] 实现 `drawDishes(pool, config)` 纯函数：按分类分组，对每组执行 Fisher-Yates shuffle 后取前 N 个
- [x] 同一分类内不出现重复菜品
- [x] 若某分类可用菜品数 < 配置数量，取实际数量（防御处理，不抛错）
- [x] 实现抽取前置校验纯函数 `validateDrawConfig(pool, config)`：返回 `{ valid: boolean, reason?: string }`
- [x] 单元测试覆盖：正常抽取、无重复验证、菜品不足防御、空输入、多次调用随机性
- [x] 测试覆盖前置校验函数：全部满足返回 valid、某分类不足返回具体原因文案
