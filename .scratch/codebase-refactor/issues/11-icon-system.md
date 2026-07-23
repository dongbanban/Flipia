# 11 — Icon System Implementation

Status: ready-for-agent

## Summary

建立基于 iconfont SVG → base64 Data URI 的图标系统，替换项目中零散的图片图标。

## Tasks

- [ ] 安装 `js-base64` 依赖
- [ ] 创建 `utils/svg-icon.ts` 工具函数（`svgToImageSrc`）
- [ ] 在 iconfont.cn 建立项目图标集，导出 SVG 文件
- [ ] 将 SVG 图标放入 `assets/icons/` 目录
- [ ] 在页面中接入工具函数，将现有图片图标替换为 `<image src="{{svgToImageSrc(...)}}" />`
- [ ] 确认 TabBar 图标仍为 PNG（不受影响）

## Acceptance Criteria

- 页面图标通过 base64 Data URI 渲染（非本地图片路径）
- 新增图标只需放入 `assets/icons/` 即可使用
- 无运行时依赖（除 `js-base64`）
- TabBar 图标不受影响

## Comments

（暂无）
