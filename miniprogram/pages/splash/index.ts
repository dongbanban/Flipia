const app = getApp<{
  globalData: { needProfileSetup?: boolean };
  whenReady(): Promise<void>;
}>();

Page({
  data: {
    flipping: false,
  },

  onReady() {
    // 立即开始翻牌动画
    this.setData({ flipping: true });
  },

  async onShow() {
    await app.whenReady();
    await new Promise(r => setTimeout(r, 500));

    if (app.globalData.needProfileSetup) {
      wx.redirectTo({ url: "/pages/profile-setup/index" });
    } else {
      wx.switchTab({ url: "/pages/index/index" });
    }
  },
});
