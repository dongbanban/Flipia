# 13-refactor-splash-loading: Splash 页面改用 loading-card 组件

**Label:** done
**Created:** 2026-07-24
**Blocked by:** 11-loading-card-component
**Spec:** `spec.md#loading-ux-重构`

---

## 范围

将 splash 页面中内联的卡片翻转动画替换为 `<loading-card>` 组件，消除 splash 与组件之间的重复代码。Splash 保留自身特有的全屏渐变背景（`.splash`），动画完全委托给组件。

## 改动清单

- `index.json` — 注册 `"loading-card": "/components/loading/index"`
- `index.wxml` — 替换整个 `card-stage` 块为 `<loading-card loading="{{true}}" />`
- `index.wxss` — 删除 98 行重复的卡片动画 CSS（`.card-stage`、`.card`、`.card-face`、`.dot-pulse`、keyframes 等），保留 `.splash` 背景
- `index.ts` — 删除 `flipping` data 字段和 `onReady()` 生命周期（动画由组件内部管理）

## 代码量变化

| 文件 | 前 (行) | 后 (行) |
|------|---------|---------|
| `index.wxml` | 17 | 3 |
| `index.wxss` | 110 | 12 |
| `index.ts` | 23 | 16 |

## 验证

- [x] Splash 启动时展示与改动前完全一致的卡片翻转动画
- [x] 动画结束后正常跳转到 profile-setup 或首页
- [x] `.splash` 渐变背景保持不变

## Comments

`1b3b4ce` — feat: loading-card 组件 + 全局加载态替换。Splash 页面已改用 `<loading-card>` 组件，移除 98 行内联动画 CSS 和 `flipping`/`onReady` 逻辑，`.splash` 渐变背景保留不变。
