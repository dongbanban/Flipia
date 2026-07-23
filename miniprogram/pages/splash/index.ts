import { userStore } from "@/stores/user-store";

Page({
  data: {
    flipping: false,
  },

  onReady() {
    // 立即开始翻牌动画
    this.setData({ flipping: true });
  },

  async onShow() {
    await getApp<{ whenReady(): Promise<void> }>().whenReady();
    await new Promise((r) => setTimeout(r, 1000));

    if (userStore.data.needProfileSetup) {
      wx.redirectTo({ url: "/pages/profile-setup/index" });
    } else {
      wx.switchTab({ url: "/pages/index/index" });
    }
  },
});
