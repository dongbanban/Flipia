import { weuiAdapter } from "./adapters/weui";
import type { AdapterOutput } from "./adapters/types";

/**
 * app-icon 统一图标组件。
 *
 * 接收跨后端的统一 props，通过 adapter 翻译为当前后端（WeUI）所需的渲染参数。
 * observers 监听所有 props 变化，任一变化时重新计算 adapter 输出并 setData。
 */

Component({
  properties: {
    /** 语义图标名（必填），如 `'CLOSE'`、`'ADD'` */
    name: { type: String, value: "" },
    /** 图标尺寸（rpx），默认 24 */
    size: { type: Number, value: 24 },
    /** 单色图标颜色（CSS 颜色值） */
    color: { type: String, value: "" },
    /** 填充色（多色 SVG 后端使用，WeUI 忽略） */
    fillColor: { type: String, value: "" },
    /** 描边色（多色 SVG 后端使用，WeUI 忽略） */
    strokeColor: { type: String, value: "" },
    /** 描边宽度（多色 SVG 后端使用，WeUI 忽略） */
    strokeWidth: { type: Number, value: 2 },
    /** 是否为品牌色图标 */
    brand: { type: Boolean, value: false },
    /** 覆盖全局配置的后端选择，不传则使用全局默认 */
    backend: { type: String, value: "" },
  },

  data: {
    output: {} as AdapterOutput,
  },

  observers: {
    "name, size, color, fillColor, strokeColor, strokeWidth, brand, backend"(
      name: string,
      size: number,
      color: string,
      fillColor: string,
      strokeColor: string,
      strokeWidth: number,
      brand: boolean,
      backend: string
    ): void {
      const output = weuiAdapter({
        name,
        size,
        color,
        fillColor,
        strokeColor,
        strokeWidth,
        brand,
        backend,
      });
      this.setData({ output });
    },
  },

  lifetimes: {
    attached(): void {
      // 组件挂载时初始化 adapter 输出
      const { name, size, color, fillColor, strokeColor, strokeWidth, brand, backend } =
        this.properties;
      const output = weuiAdapter({
        name,
        size,
        color,
        fillColor,
        strokeColor,
        strokeWidth,
        brand,
        backend,
      });
      this.setData({ output });
    },
  },
});
