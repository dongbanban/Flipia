interface AppInstance {
  globalData: {
    openid: string;
    nickName: string;
    avatarUrl: string;
    groupId: string;
    groups: Array<{ _id: string; name: string; members: string[] }>;
  };
  switchGroup(id: string): void;
  whenReady(): Promise<void>;
}

Page({
  data: {
    openid: "",
    nickName: "微信用户",
    avatarUrl: "",
    activeGroupName: "",
  },

  async onShow() {
    const app = getApp<AppInstance>();
    await app.whenReady();
    const nickName = app.globalData.nickName || "微信用户";
    const avatarUrl = app.globalData.avatarUrl || "";
    const groups = app.globalData.groups;
    const activeGroupId = app.globalData.groupId;
    const activeGroup = groups.find((g) => g._id === activeGroupId);
    this.setData({
      openid: app.globalData.openid,
      nickName,
      avatarUrl,
      activeGroupName: activeGroup ? activeGroup.name : "",
    });
  },

  onTapGroupManage() {
    wx.navigateTo({ url: "/pages/group-manage/index" });
  },

  onTapCategoryManage() {
    wx.navigateTo({ url: "/pages/category-manage/index" });
  },

  onTapDrawConfig() {
    wx.navigateTo({ url: "/pages/draw-config-manage/index" });
  },

  onAvatarError() {
    this.setData({ avatarUrl: "" });
  },
});
