# 05 — westore 传递依赖 rfdc 未安装

**What to fix:** `westore` 运行时依赖 `rfdc`（deep clone），但 pnpm workspace 下传递依赖不会自动提升到 `miniprogram/node_modules/`，导致 WeChat "构建 npm" 时 `rfdc` 未被处理到 `miniprogram_npm/`。运行时 `westore/index.js` 执行 `require('rfdc')` 失败 → Store 类无法加载 → stores 模块初始化失败。

**Root cause:** `westore` 的 `miniprogram_npm` 构建产物声明了 `//miniprogram-npm-outsideDeps=["rfdc"]`，但 `rfdc` 既不在 `miniprogram/node_modules/` 也不在 `miniprogram_npm/`。

**Fix:** `pnpm add rfdc --filter @flipia/miniprogram` 将 `rfdc` 添加为直接依赖，然后在微信开发者工具中"构建 npm"。

**Status:** done

- [x] 确认 `rfdc` 不存在于 `miniprogram/node_modules/` 和 `miniprogram_npm/`
- [x] `pnpm add rfdc --filter @flipia/miniprogram`
- [x] 微信开发者工具中构建 npm，`rfdc` 已生成到 `miniprogram_npm/rfdc/`
