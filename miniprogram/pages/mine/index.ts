import { checkImage } from "@/lib/content-security";
import { svgToImageSrc } from "@/lib/svg-icon";
import { iconArrowRight, iconUser } from "@/assets/icons/index";

interface AppInstance {
  globalData: {
    openid: string;
    nickName: string;
    avatarUrl: string;
    needProfileSetup?: boolean;
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

    // Icon Data URIs（图标系统 — 预计算 base64）
    arrowRightIconSrc: svgToImageSrc(iconArrowRight, "#cccccc"),
    userIconSrc: svgToImageSrc(iconUser, "#c8815e"),
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

  async onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
    const { avatarUrl } = e.detail;
    const app = getApp<AppInstance>();

    // 安全检测
    const checkResult = await checkImage(avatarUrl);
    if (!checkResult.pass) {
      wx.hideLoading();
      wx.showToast({ title: checkResult.reason || "图片未通过安全检测", icon: "none" });
      return;
    }

    wx.showLoading({ title: "正在保存…" });

    try {
      const openid = app.globalData.openid;
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

      // 更新 globalData
      app.globalData.avatarUrl = fileID;
      app.globalData.needProfileSetup = false;

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
      wx.showToast({ title: "头像已更新", icon: "success" });
    } catch (err) {
      wx.hideLoading();
      console.error("[mine] avatar update failed", err);
      wx.showToast({ title: "更新失败", icon: "none" });
    }
  },

  async onNicknameBlur(e: WechatMiniprogram.InputBlur) {
    const newNickName = e.detail.value.trim();
    if (!newNickName) return;

    const app = getApp<AppInstance>();
    const openid = app.globalData.openid;

    try {
      // 更新 globalData
      app.globalData.nickName = newNickName;
      app.globalData.needProfileSetup = false;

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
