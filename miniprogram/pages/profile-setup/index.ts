import { checkImage } from "../../lib/content-security";

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
    nicknameFocus: false,  // auto-focus input after avatar selected
    canConfirm: false,     // computed — true when nickname is non-empty
  },

  async onLoad() {
    wx.hideHomeButton();
    // Splash page already awaited app.whenReady() and routed here —
    // globalData is guaranteed ready.
    await getApp<AppInstance>().whenReady();
  },

  onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl, hasNewAvatar: true });
    // Auto-focus nickname input after avatar selection for sequential flow
    wx.nextTick(() => {
      this.setData({ nicknameFocus: true });
    });
  },

  /** Tap avatar circle → custom image picker (camera / gallery, no WeChat avatars) */
  onTapAvatarDisplay() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success: (res) => {
        const avatarUrl = res.tempFiles[0]?.tempFilePath;
        if (avatarUrl) {
          this.setData({ avatarUrl, hasNewAvatar: true });
        }
      },
      fail: (err) => {
        if (err.errMsg !== "chooseMedia:fail cancel") {
          console.error("[profile-setup] chooseMedia failed", err);
        }
      },
    });
  },

  /** Reset focus flag when nickname input loses focus */
  onNicknameBlur() {
    this.setData({ nicknameFocus: false });
  },

  onNickInput(e: WechatMiniprogram.Input) {
    const nickName = e.detail.value;
    this.setData({ nickName, canConfirm: nickName.trim().length > 0 });
  },

  async onConfirm() {
    const app = getApp<AppInstance>();
    const { avatarUrl, nickName, hasNewAvatar } = this.data;
    const trimmedNick = nickName.trim();

    // Validate: nickname is required, avatar is optional
    if (!trimmedNick) {
      wx.showToast({ title: "请输入昵称", icon: "none" });
      return;
    }

    wx.showLoading({ title: "创建中…", mask: true });

    try {
      let finalAvatarUrl = "";

      // If a new avatar was selected, validate and upload
      if (hasNewAvatar && avatarUrl) {
        // Security check
        const checkResult = await checkImage(avatarUrl);
        if (!checkResult.pass) {
          wx.hideLoading();
          wx.showToast({
            title: checkResult.reason || "图片未通过安全检测",
            icon: "none",
          });
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
      const userRes = await db
        .collection("users")
        .where({ _openid: app.globalData.openid })
        .limit(1)
        .get();

      const updateData: Record<string, unknown> = {};
      if (trimmedNick) updateData.nickName = trimmedNick;
      if (finalAvatarUrl) updateData.avatarUrl = finalAvatarUrl;

      if (userRes.data.length > 0) {
        await db
          .collection("users")
          .doc(userRes.data[0]._id as string)
          .update({
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
      wx.showToast({ title: "创建成功", icon: "success" });
      setTimeout(() => {
        wx.switchTab({ url: "/pages/index/index" });
      }, 800);
    } catch (err) {
      wx.hideLoading();
      console.error("[profile-setup] save failed", err);
      wx.showToast({ title: "创建失败，请重试", icon: "none" });
    }
  },

  async onSkip() {
    const app = getApp<AppInstance>();
    const openid = app.globalData.openid;

    // Check if user doc exists in DB
    const db = wx.cloud.database();
    const userRes = await db
      .collection("users")
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
