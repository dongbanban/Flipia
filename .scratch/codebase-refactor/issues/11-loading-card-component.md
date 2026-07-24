# 11-loading-card-component: 提取 loading-card 可复用组件

**Label:** in-progress
**Created:** 2026-07-24
**Blocked by:** None — 可直接开始
**Spec:** `spec.md#loading-ux-重构`

---

## 范围

从 splash 页面提取卡片翻转动画为可复用的 `<loading-card>` 组件，替换项目中所有页面的内联"加载中…"文字提示。组件提供统一的加载视觉体验，消除各页面重复的 `.loading-state`/`.loading-hint` CSS 和 WXML 模板。

## 组件接口

- `loading`：Boolean，控制组件显隐，默认 `false`
- `text`：String，卡片正面主文案，默认 `"Flipia"`
- `subtext`：String，卡片正面副文案，默认 `"让做饭不再纠结～"`

未传 text/subtext 时卡片正面仅显示品牌渐变色底，无文字。

## 视觉规格

提取自 splash 页面的 3D 卡片翻转动画：

- 卡片正面：`linear-gradient(135deg, #c8815e, #e0b398)` + 可选文案（白色、居中）
- 卡片背面：`linear-gradient(135deg, #e0b398, #c8815e)` + 三点脉冲动画（dot-pulse，错开延迟）
- 透视距离：800rpx，卡片尺寸：280×360rpx
- 动画：cardLoop（1.8s 循环翻转） + dotBounce（1.4s 依次弹跳）
- 覆盖层：`min-height: 100vh`，flex 居中，透明背景（页面背景透出）

## 文件清单

- `miniprogram/components/loading/index.json` — 组件声明
- `miniprogram/components/loading/index.ts` — properties 定义
- `miniprogram/components/loading/index.wxml` — 卡片动画模板
- `miniprogram/components/loading/index.wxss` — 所有动画 CSS（cardLoop、dotBounce）

## 验证

- [ ] 组件在页面 loading 时展示卡片翻转动画
- [ ] 传入 text/subtext 时正面显示文案，不传时仅显示渐变色底
- [ ] 默认文案与 splash 页面一致（Flipia / 让做饭不再纠结～）
- [ ] 动画连续播放，无闪烁或跳帧
