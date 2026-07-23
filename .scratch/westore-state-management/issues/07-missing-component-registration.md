# 07 — history 页面缺少 group-switcher 组件注册

**What to fix:** `pages/history/index.json` 的 `usingComponents` 缺少 `group-switcher` 声明，但 WXML 模板中使用了 `<group-switcher>` 标签。运行时触发 `Component is not found in path "wx://not-found"` 错误。

**Fix:** 在 `pages/history/index.json` 的 `usingComponents` 中补充 `"group-switcher": "/components/group-switcher/index"`。

**Status:** done

- [x] 排查所有页面的 `usingComponents` 配置
- [x] 确认仅有 history 页面缺失 `group-switcher`
- [x] 补充注册
- [x] 验证通过
