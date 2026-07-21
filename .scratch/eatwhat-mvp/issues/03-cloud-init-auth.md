# 03 — 云初始化 & 静默登录

**What to build:** 实现首次启动检测与数据初始化流程。用户打开小程序后自动静默登录，检测是否已有 group 记录；若无，则依次创建 group、user_config（含默认分类和抽取配置）和预设菜品，整个过程对用户透明（显示加载态）。

**Blocked by:** 01 — 项目脚手架

**Status:** done

- [x] 在 `app.ts` 中调用 `wx.login` 获取 openid（通过云函数或云调用），写入全局状态
- [x] 查询 `groups` 集合：若当前 openid 已有记录则跳过初始化
- [x] 首次初始化：创建 `groups` 文档（单成员 owner → 群组模型升级后无 role 字段，由 `_openid` 判断群主；群组默认名"我的厨房"）
- [x] 首次初始化：创建 `user_config` 文档，默认分类为荤菜/素菜/主食/汤四个分类，默认抽取方案为 preset 分类各 1 道。`activeDrawConfigGroupId` / `lastDrawnGroupId` 已迁移至本地存储，不再写入云端
- [x] 首次初始化：批量写入预设菜品（各分类各 5 道常见家常菜）到 `dishes` 集合
- [x] 初始化过程中全局显示加载态，完成后进入首页
- [x] 非首次启动：直接读取现有数据，无额外写操作
- [x] groupId 写入全局状态，供各页面查询时使用
