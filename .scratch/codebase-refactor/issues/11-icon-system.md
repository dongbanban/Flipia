# 11 — Icon System Implementation

Status: done

## Summary

建立基于 iconfont SVG → base64 Data URI 的图标系统，替换项目中零散的图片图标。

## Tasks

- [x] 安装 `js-base64` 依赖
- [x] 创建 `lib/svg-icon.ts` 工具函数（`svgToImageSrc`），支持可选 `color` 参数替换 SVG fill 色
- [x] 在 iconfont.cn 建立项目图标集，导出 SVG 文件
- [x] 将 SVG 图标放入 `assets/icons/` 目录
- [x] 在页面中接入工具函数，将现有图片图标替换为 `<image src="{{svgToImageSrc(svg, '#c8815e')}}" />`（主题色来自 `--color-primary`）
- [x] 确认 TabBar 图标仍为 PNG（不受影响）

## Acceptance Criteria

- [x] 页面图标通过 base64 Data URI 渲染（非本地图片路径）
- [x] 图标颜色可通过 `color` 参数替换为主题色 `#c8815e`
- [x] 新增图标只需放入 `assets/icons/` 即可使用
- [x] 无运行时依赖（除 `js-base64`）
- [x] TabBar 图标不受影响

## Comments

- `7500599` — feat: 建立基于 iconfont SVG → base64 Data URI 的图标系统
  - 新增 6 个 SVG 图标（search, close, add, arrow-right, share, user）+ barrel export
  - 替换 dish-pool（搜索/清除/添加）、history（分享）、mine（菜单箭头/头像占位）、profile-setup（头像占位）中的 emoji/文字图标
  - TabBar 确认无图标配置，不受影响
