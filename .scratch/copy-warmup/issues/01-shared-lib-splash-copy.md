# 01 — 共享库 + 启动页文案

**What to build:** 替换共享库校验文案、配置文件默认名、app.json 导航标题、以及启动页的错误提示，将所有技术化、后管味表述改为温润口语。这是全站文案改版的基础层——lib/ 中的校验字符串被多个页面共用，先落地确保跨页一致性。

**Blocked by:** None — 可立即开始。

**Status:** done

- [x] `lib/category-manage.ts`："分类名不能为空"→"得有个名字"，"分类名已存在"→"这个名字用过了"
- [x] `lib/draw-config-manage.ts`："方案名不能为空"→"得有个名字"，"方案名已存在"→"这个名字用过了"
- [x] `lib/draw-engine.ts`：校验详情模板 `"xxx可用菜品不足，需至少 N 道"` → `"${categoryName}的菜不太够，至少 ${count} 道哦"`
- [x] `lib/content-security.ts`：无需修改（无具体 before/after 字符串）
- [x] `lib/sanitize.ts`：动态 toast 模板 "请输入${fieldName}" → "给${fieldName}起个名字"，"${fieldName}最多${maxLength}字" → "${fieldName}不超过${maxLength}字"
- [x] `lib/history.ts`：统计文案"今天抽了 N 次"→"今天抽了 N 次啦～"，"等人"后缀不变
- [x] `config.ts`：DEFAULT_GROUP_NAME、DEFAULT_DRAW_CONFIG_NAME、BRAND_NAME 全部保持不变
- [x] `app.json`：页面级 index.json 已完成导航标题更新（category-manage→分类整理，draw-config-manage→抽签规则）
- [x] `pages/splash/index.ts`：错误文案对齐首页统一版本
- [x] 构建无编译错误，grep 旧文案确认无遗漏

## Comments

`a740504` — 全站文案温润化改版，31 文件 +205/-205。lib/ 校验、sanitize、history、draw-engine、splash 错误文案全部替换。
