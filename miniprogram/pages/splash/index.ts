const app = getApp<{
  globalData: { needProfileSetup?: boolean };
  whenReady(): Promise<void>;
}>();

Page({
  data: {
    flipping: false,
  },

  onReady() {
    // Start card-flip animation immediately
    this.setData({ flipping: true });
  },

  async onShow() {
    await app.whenReady();

    if (app.globalData.needProfileSetup) {
      wx.redirectTo({ url: "/pages/profile-setup/index" });
    } else {
      wx.switchTab({ url: "/pages/index/index" });
    }
  },
});
