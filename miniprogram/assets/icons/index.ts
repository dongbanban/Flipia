// 图标库 — 集中管理所有 SVG 图标，导出预计算的 base64 Data URI
// 新增图标步骤：将 .svg 放入 assets/icons/ 目录，在本文件添加 svg 常量 + 对应导出
import { svgToImageSrc } from "@/lib/svg-icon";

// ── SVG 源文件 ──────────────────────────────────────────────

/** 搜索（放大镜） */
const svgSearch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#000000" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
</svg>`;

/** 关闭（叉号） */
const svgClose = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#000000" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
</svg>`;

/** 添加（加号） */
const svgAdd = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#000000" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
</svg>`;

/** 右箭头（菜单进入指示） */
const svgArrowRight = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#000000" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
</svg>`;

/** 分享（上传箭头） */
const svgShare = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#000000" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
</svg>`;

/** 用户（头像占位） */
const svgUser = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="#000000" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
</svg>`;

// ── 预计算 Data URI（页面直接使用，无需调用 svgToImageSrc）───

/** 搜索图标 — 浅灰色，适用于搜索栏 */
export const searchIcon = svgToImageSrc(svgSearch, "#999999");

/** 关闭图标 — 白色，适用于深色圆形底 */
export const closeIcon = svgToImageSrc(svgClose, "#ffffff");

/** 添加图标 — 白色，适用于主题色 FAB 按钮 */
export const addIcon = svgToImageSrc(svgAdd, "#ffffff");

/** 右箭头图标 — 浅灰色，适用于菜单列表进入指示 */
export const arrowRightIcon = svgToImageSrc(svgArrowRight, "#cccccc");

/** 分享图标 — 中灰色，适用于卡片右上角操作区 */
export const shareIcon = svgToImageSrc(svgShare, "#888888");

/** 用户图标 — 主题色 #c8815e，适用于头像占位 */
export const userIcon = svgToImageSrc(svgUser, "#c8815e");
