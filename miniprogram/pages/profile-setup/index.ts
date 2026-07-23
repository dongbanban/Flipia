import { checkImage } from "@/lib/content-security";
import { svgToImageSrc } from "@/lib/svg-icon";
import { iconUser } from "@/assets/icons";

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
    avatarUrl: "",        // 选择头像后的本地临时路径
    nickName: "",
    hasNewAvatar: false,   // 用户在本会话中选择了新头像时为 true
    nicknameFocus: false,  // 选择头像后自动聚焦输入框
    canConfirm: false,     // 计算得出 — 昵称非空时为 true

    // Icon Data URIs（图标系统 — 预计算 base64）
    userIconSrc: svgToImageSrc(iconUser, "#c8815e"),
  },

  async onLoad() {
    wx.hideHomeButton();
    // Splash 页面已经 await app.whenReady() 并路由至此 —
    // globalData 保证已就绪。
    await getApp<AppInstance>().whenReady();
  },

  onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl, hasNewAvatar: true });
    // 选择头像后自动聚焦昵称输入框，实现顺序流程
    wx.nextTick(() => {
      this.setData({ nicknameFocus: true });
    });
  },

  /** 点击头像圆 → 自定义图片选择器（相机 / 相册，不使用微信头像） */
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

  /** 昵称输入框失焦时重置聚焦标志 */
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

    // 校验：昵称必填，头像可选
    if (!trimmedNick) {
      wx.showToast({ title: "请输入昵称", icon: "none" });
      return;
    }

    wx.showLoading({ title: "创建中…" });

    try {
      let finalAvatarUrl = "";

      // 如果选择了新头像，先校验再上传
      if (hasNewAvatar && avatarUrl) {
        // 安全检测
        const checkResult = await checkImage(avatarUrl);
        if (!checkResult.pass) {
          wx.hideLoading();
          wx.showToast({
            title: checkResult.reason || "图片未通过安全检测",
            icon: "none",
          });
          return;
        }

        // 上传至云存储
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

      // 立即更新本地 globalData
      app.globalData.nickName = trimmedNick || app.globalData.nickName;
      app.globalData.avatarUrl = finalAvatarUrl;
      // 清除 needProfileSetup 标志
      app.globalData.needProfileSetup = false;

      // 更新数据库中的 users 集合
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
        // 用户文档不存在，创建之
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

    // 检查数据库中是否存在用户文档
    const db = wx.cloud.database();
    const userRes = await db
      .collection("users")
      .where({ _openid: openid })
      .limit(1)
      .get();

    if (userRes.data.length === 0) {
      // 新用户：创建默认资料
      const nickName = `用户${openid.slice(-6)}`;
      await db.collection("users").add({
        data: { nickName, avatarUrl: "", createdAt: Date.now() },
      });
      app.globalData.nickName = nickName;
      app.globalData.avatarUrl = "";
    }
    // 如果是已有用户，保持当前资料不变（globalData 已有）

    app.globalData.needProfileSetup = false;

    wx.switchTab({ url: "/pages/index/index" });
  },
});
