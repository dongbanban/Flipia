/**
 * flip-card — 通用 3D 翻牌卡片组件。
 *
 * 通过两个具名 slot（back / front）分别填充卡片背面与正面内容，
 * flipped 属性控制翻转状态，redrawing 属性加速过渡动画。
 */

Component({
  options: {
    multipleSlots: true,
  },

  properties: {
    /** 是否已翻到正面 */
    flipped: { type: Boolean, value: false },
    /** 是否处于快速重绘过渡 */
    redrawing: { type: Boolean, value: false },
    /** 卡片宽度（如 "300rpx"），不传默认 100% */
    width: { type: String, value: "" },
    /** 卡片高度（如 "400rpx"），不传默认 360rpx */
    height: { type: String, value: "" },
  },

  data: {
    _width: "100%",
    _height: "360rpx",
  },

  observers: {
    "width, height"(w: string, h: string) {
      this.setData({
        _width: w || "100%",
        _height: h || "360rpx",
      });
    },
  },
});
