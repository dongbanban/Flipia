import { checkImage } from "@/lib/content-security";
import { userStore } from "@/stores/user-store";
import { groupStore } from "@/stores/group-store";

Page({
  data: {
    openid: "",
    nickName: "Flipia 居民",
    avatarUrl: "",
    activeGroupName: "",
  },

  async onShow() {
    const { nickName, avatarUrl } = userStore.data;
    const openid = getApp<{ globalData: { openid: string } }>().globalData.openid;
    const groups = groupStore.data.groups;
    const activeGroupId = groupStore.data.groupId;
    const activeGroup = groups.find((g: { _id: string; name: string }) => g._id === activeGroupId);
    this.setData({
      openid,
      nickName: nickName || "Flipia 居民",
      avatarUrl: avatarUrl || "",
      activeGroupName: activeGroup ? activeGroup.name : "",
    });
  },

  async onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
    const { avatarUrl } = e.detail;

    // 安全检测
    const checkResult = await checkImage(avatarUrl);
    if (!checkResult.pass) {
      wx.hideLoading();
      wx.showToast({ title: checkResult.reason || "这张图用不了，换一张？", icon: "none" });
      return;
    }

    wx.showLoading({ title: "更新中…" });

    try {
      const openid = getApp<{ globalData: { openid: string } }>().globalData.openid;
      let fileID = "";

      if (avatarUrl) {
        const ext = avatarUrl.split(".").pop() || "jpg";
        const cloudPath = `avatars/${openid}/${Date.now()}_avatar.${ext}`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: avatarUrl,
        });
        fileID = uploadRes.fileID;
      }

      // 更新 userStore
      userStore.setProfile(userStore.data.nickName, fileID);

      // 持久化到数据库
      const db = wx.cloud.database();
      const userRes = await db.collection("users")
        .where({ _openid: openid })
        .limit(1)
        .get();

      if (userRes.data.length > 0) {
        await db.collection("users").doc(userRes.data[0]._id as string).update({
          data: { avatarUrl: fileID },
        });
      }

      this.setData({ avatarUrl: fileID });
      wx.hideLoading();
      wx.showToast({ title: "换好啦", icon: "success" });
    } catch (err) {
      wx.hideLoading();
      console.error("[mine] avatar update failed", err);
      wx.showToast({ title: "没换成，再试一下？", icon: "none" });
    }
  },

  async onNicknameBlur(e: WechatMiniprogram.InputBlur) {
    const newNickName = e.detail.value.trim();
    if (!newNickName) return;

    const openid = getApp<{ globalData: { openid: string } }>().globalData.openid;

    try {
      // 更新 userStore
      userStore.setProfile(newNickName, userStore.data.avatarUrl);

      // 持久化到数据库
      const db = wx.cloud.database();
      const userRes = await db.collection("users")
        .where({ _openid: openid })
        .limit(1)
        .get();

      if (userRes.data.length > 0) {
        await db.collection("users").doc(userRes.data[0]._id as string).update({
          data: { nickName: newNickName },
        });
      }

      this.setData({ nickName: newNickName });
    } catch (err) {
      console.error("[mine] nickname update failed", err);
    }
  },

  onTapPluginManage() {
    wx.navigateTo({ url: "/pages/plugin-manage/index" });
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

  onUnload() {
  },
});
