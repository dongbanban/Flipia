# 06 — stores/ 目录无法被 WeChat 运行时解析为模块

**What to fix:** `import { x } from "@/stores"` 触发 `module 'stores.js' is not defined` 错误。无论目录内是 barrel 重导出还是合并代码，只要通过目录路径引用就失败。平文件 `stores.ts` 和目录内直接文件引用（如 `@/stores/user-store`）均正常。

**Root cause:** WeChat 小程序运行时对目录模块的 `index.ts` → `index.js` 解析存在兼容性问题。`resolveAlias` 配置（`"@/*": "/*"`）经排查无问题。

**Fix:**
1. 删除 `stores/index.ts`（barrel 重导出）
2. 保留 `stores/user-store.ts` 和 `stores/group-store.ts` 分类存放
3. `app.ts` 和全部 10 个页面改为直接引用具体文件：
   - `import { userStore } from "@/stores/user-store"`
   - `import { groupStore } from "@/stores/group-store"`

**Status:** done

- [x] 排查 `resolveAlias` 配置 — 无误
- [x] 排查 `westore`/`rfdc` 依赖 — 另有问题（见 05）
- [x] 隔离测试：零依赖 stub + 平文件 → 正常
- [x] 隔离测试：零依赖 stub + 目录 → 失败
- [x] 隔离测试：零依赖 stub + 目录内直接文件 → 正常
- [x] 恢复真实代码，改为直接文件引用
- [x] 全部 11 个文件导入路径更新完毕
- [x] TypeScript 编译通过
- [x] 微信开发者工具中全页面正常
