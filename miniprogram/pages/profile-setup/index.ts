import { checkImage } from "../../lib/content-security";

function isDefaultNickname(name: string): boolean {
  return /^用户[a-z0-9]{6}$/.test(name);
}

interface AppInstance {
  globalData: {
    openid: string;
    nickName: string;
    avatarUrl: string;
    groupId: string;
    groups: Array<{ _id: string; name: string; members: string[] }>;
    needProfileSetup?: boolean;
  };
  whenReady(): Promise<void>;
}

Page({
  data: {
    avatarUrl: "",        // temp local path after chooseAvatar
    nickName: "",
    hasNewAvatar: false,   // true if user selected a new avatar in this session
  },

  onLoad() {
    const app = getApp<AppInstance>();
    const gd = app.globalData;
    // Pre-fill nickname from globalData if it's not the auto-generated one
    const isDefaultNick = isDefaultNickname(gd.nickName);
    this.setData({
      nickName: isDefaultNick ? "" : gd.nickName,
      avatarUrl: gd.avatarUrl || "",
    });
  },

  onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl, hasNewAvatar: true });
  },

  onNickInput(e: WechatMiniprogram.Input) {
    this.setData({ nickName: e.detail.value });
  },

  async onConfirm() {
    const app = getApp<AppInstance>();
    const { avatarUrl, nickName, hasNewAvatar } = this.data;
    const trimmedNick = nickName.trim();

    // Validate: at least a nickname or avatar should be provided
    if (!trimmedNick && !avatarUrl) {
      wx.showToast({ title: "请设置头像或昵称", icon: "none" });
      return;
    }

    wx.showLoading({ title: "保存中…", mask: true });

    try {
      let finalAvatarUrl = "";

      // If a new avatar was selected, validate and upload
      if (hasNewAvatar && avatarUrl) {
        // Security check
        const checkResult = await checkImage(avatarUrl);
        if (!checkResult.pass) {
          wx.hideLoading();
          wx.showToast({ title: checkResult.reason || "图片未通过安全检测", icon: "none" });
          return;
        }

        // Upload to cloud storage
        const openid = app.globalData.openid;
        const ext = avatarUrl.split(".").pop() || "jpg";
        const cloudPath = `avatars/${openid}/${Date.now()}_avatar.${ext}`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: avatarUrl,
        });
        finalAvatarUrl = uploadRes.fileID;
        this.setData({ hasNewAvatar: false });
      } else {
        finalAvatarUrl = app.globalData.avatarUrl;
      }

      // Update local globalData immediately
      app.globalData.nickName = trimmedNick || app.globalData.nickName;
      app.globalData.avatarUrl = finalAvatarUrl;
      // Clear needProfileSetup flag
      app.globalData.needProfileSetup = false;

      // Update users collection in DB
      const db = wx.cloud.database();
      const userRes = await db.collection("users")
        .where({ _openid: app.globalData.openid })
        .limit(1)
        .get();

      const updateData: Record<string, unknown> = {};
      if (trimmedNick) updateData.nickName = trimmedNick;
      if (finalAvatarUrl) updateData.avatarUrl = finalAvatarUrl;

      if (userRes.data.length > 0) {
        await db.collection("users").doc(userRes.data[0]._id as string).update({
          data: updateData,
        });
      } else {
        // User doc doesn't exist, create it
        await db.collection("users").add({
          data: {
            nickName: trimmedNick || `用户${app.globalData.openid.slice(-6)}`,
            avatarUrl: finalAvatarUrl,
            createdAt: Date.now(),
          },
        });
      }

      wx.hideLoading();
      wx.showToast({ title: "设置成功", icon: "success" });
      setTimeout(() => {
        wx.switchTab({ url: "/pages/index/index" });
      }, 800);
    } catch (err) {
      wx.hideLoading();
      console.error("[profile-setup] save failed", err);
      wx.showToast({ title: "保存失败，请重试", icon: "none" });
    }
  },

  async onSkip() {
    const app = getApp<AppInstance>();
    const openid = app.globalData.openid;

    // Check if user doc exists in DB
    const db = wx.cloud.database();
    const userRes = await db.collection("users")
      .where({ _openid: openid })
      .limit(1)
      .get();

    if (userRes.data.length === 0) {
      // New user: create default profile
      const nickName = `用户${openid.slice(-6)}`;
      await db.collection("users").add({
        data: { nickName, avatarUrl: "", createdAt: Date.now() },
      });
      app.globalData.nickName = nickName;
      app.globalData.avatarUrl = "";
    }
    // If existing user, keep current profile (globalData already has it)

    app.globalData.needProfileSetup = false;

    wx.switchTab({ url: "/pages/index/index" });
  },
});
