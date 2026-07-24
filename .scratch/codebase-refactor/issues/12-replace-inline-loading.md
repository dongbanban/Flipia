<!--
 * @file: /Users/i104/Flipia/.scratch/codebase-refactor/issues/12-replace-inline-loading.md
 * @author: dongyang
-->

# 12-replace-inline-loading: 全部页面内联加载态替换为 loading-card

**Label:** done
**Created:** 2026-07-24
**Blocked by:** 11-loading-card-component
**Spec:** `spec.md#loading-ux-重构`

---

## 范围

将全部 5 个页面中重复的 `<view wx:if="{{loading}}" class="loading-state"><text class="loading-hint">加载中…</text></view>` 替换为 `<loading-card loading="{{loading}}" />`。同时清理每个页面 WXSS 中重复的 `.loading-state` / `.loading-hint` CSS 规则，修复替换后产生的 `wx:else`/`wx:elif` 孤儿条件链。

plugin-manage 页面额外移除页面加载时的 `wx.showLoading("加载中…")` 系统弹窗（与内联加载态冗余）。

## 涉及页面

| 页面                 | data 属性       | 条件链修复                                             |
| -------------------- | --------------- | ------------------------------------------------------ |
| `category-manage`    | `loading`       | `wx:else` → `wx:if="{{!loading}}"`                     |
| `draw-config-manage` | `loading`       | `wx:else` → `wx:if="{{!loading}}"`                     |
| `history`            | `loading`       | `wx:elif`/`wx:else` → `wx:if="{{!loading && ...}}"` 链 |
| `plugin-manage`      | `loading`       | 同上 + 移除 `wx.showLoading`/`wx.hideLoading`          |
| `index`              | `loadingConfig` | `wx:else` → `wx:if="{{!loadingConfig}}"`               |

## 每页改动清单

- `index.json` — 注册 `"loading-card": "/components/loading/index"`
- `index.wxml` — 替换加载块，修复条件链
- `index.wxss` — 删除 `.loading-state` 和 `.loading-hint` 规则
- `plugin-manage/index.ts` — 删除 `_fetchPlugins()` 中的 `wx.showLoading`/`wx.hideLoading`

## 验证

- [ ] 5 个页面加载时显示卡片翻转动画，不再显示"加载中…"文字
- [ ] 加载完成后内容正常渲染，无 `wx:else`/`wx:elif` 孤儿错误
- [ ] plugin-manage 页面进入时仅显示卡片动画，无系统弹窗
- [ ] 所有页面 `.wxss` 中不再残留 `.loading-state` / `.loading-hint` 规则
