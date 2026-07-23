# 02 — `<app-icon>` 组件 + WeUI adapter + adapter 单测

**What to build:** 实现 `<app-icon>` 组件本体及 WeUI adapter。组件接收统一 props → adapter 翻译为 WeUI 原生 props → WXML 渲染 `<mp-icon>`。完成后在任意页面放置 `<app-icon name="CLOSE" />` 即可看到 WeUI 描边风格的关闭图标。

**Blocked by:** 01 — Foundation：icon-config + adapter 类型 + 单测

**Status:** done

- [x] `components/app-icon/index.json`：声明 `mp-icon` 为 `weui-miniprogram/icon/icon`，注释中记录 TDesign 引用路径供后续扩展
- [x] `components/app-icon/index.wxml`：单一 `<mp-icon>` 节点，绑定 adapter 输出的 `icon`、`type="outline"`、内联 `style`
- [x] `components/app-icon/index.ts`：接收所有统一 props → 调用 `translate()` 翻译语义名 → 调用 WeUI adapter 生成 `AdapterOutput` → setData。`observers` 监听 props 变化触发重新计算
- [x] `components/app-icon/index.wxss`：基础样式（`display: inline-flex`、`align-items: center`），以及 `CHEVRON_DOWN` 对应的 `rotate(90deg)` 条件样式
- [x] `components/app-icon/adapters/weui.ts`：实现 `weuiAdapter(props: UnifiedIconProps): AdapterOutput`。将 `color` → CSS `color` 内联 style，`size` → CSS `font-size`，静默忽略多色 props。`CHEVRON_DOWN` 附加 `transform: rotate(90deg)`
- [x] `components/app-icon/adapters/weui.test.ts`：覆盖单色 props 翻译、多色 props 被忽略、`CHEVRON_DOWN` 旋转、空 props 默认值
- [x] `app.json`：添加 `"useExtendedLib": { "weui": true }`

## Comments

- `4e15721` — 创建 `<app-icon>` 组件（.json / .wxml / .ts / .wxss）、translate.ts 映射表、weui adapter、weui-adapter 单测（21 cases），app.json 添加 useExtendedLib。共 42 个测试通过（21 icon-config + 21 weui-adapter）。
- **2026-07-23 — TDesign 迁移**：
  - 后端从 WeUI 切换至 `@mp-svg-icons/wechat`（TDesign SVG），移除 WeUI adapter 和 translate.ts
  - 新增 `adapters/tdesign.ts`：`color` 同时映射到 `fillColor` 和 `strokeColor`（不同图标渲染通道不同），`size` 转为 rpx 字符串，`brand` 默认 `"tdesign"`
  - `index.json` 注册从 `mp-icon` 改为 `t-icon: @mp-svg-icons/wechat/icon`
  - `index.wxml` `<mp-icon>` 替换为 `<t-icon>`，kebab-case prop 绑定
  - `brand` prop 类型从 Boolean 改为 String
  - `app.json` 移除 `useExtendedLib.weui`
  - 新增 `tdesign-adapter.test.ts`（26 个测试，当前 46 个测试全部通过）
  - 通过 `pnpm patch` 修复 t-icon Data URI 真机兼容问题（`charset=utf-8` → `base64` via `wx.arrayBufferToBase64`）
  - tree-shaking 裁剪 icons.js（1MB → 3.7KB，11 图标）
  - **颜色 token 系统**：适配器新增 `resolveColor()` 解析 `$token` 前缀，颜色唯一真相源在 `lib/theme.ts`，32 处 WXML 色值替换为 `$primary` / `$text-secondary` 等 token
