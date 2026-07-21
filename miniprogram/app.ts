import { buildDefaultUserConfig, buildPresetDishes } from "./lib/init-data";

interface GroupInfo {
  _id: string;
  name: string;
  members: string[];
}

interface AppGlobalData {
  openid: string;
  nickName: string;
  avatarUrl: string;
  groupId: string;
  groups: GroupInfo[];
  needProfileSetup?: boolean;
}

interface AppInstance {
  globalData: AppGlobalData;
  _initApp(): Promise<void>;
  _ensureUserProfile(
    db: ReturnType<typeof wx.cloud.database>,
    openid: string,
  ): Promise<void>;
  _readyResolvers: Array<() => void>;
  _ready: boolean;
  switchGroup(groupId: string): void;
  whenReady(): Promise<void>;
}

const ACTIVE_GROUP_KEY = "flipia_active_group_id";

App({
  globalData: {
    openid: "",
    nickName: "",
    avatarUrl: "",
    groupId: "",
    groups: [],
    needProfileSetup: false,
  } as AppGlobalData,

  _readyResolvers: [] as Array<() => void>,
  _ready: false,

  onLaunch(this: AppInstance) {
    wx.cloud.init({
      env: "cloud1-d5gwv3g0da9888b0e",
      traceUser: true,
    });

    wx.showLoading({ title: "初始化中…", mask: true });
    this._initApp()
      .then(() => {
        this._ready = true;
        const resolvers = this._readyResolvers;
        this._readyResolvers = [];
        for (const resolve of resolvers) resolve();
        if (this.globalData.needProfileSetup) {
          wx.redirectTo({ url: "/pages/profile-setup/index" });
        } else {
          wx.switchTab({ url: "/pages/index/index" });
        }
      })
      .catch((err: unknown) => {
        console.error("[app] init failed", err);
          wx.showModal({
            title: "初始化失败",
            content: "网络异常，请重启小程序重试",
            showCancel: false,
            confirmColor: "#c8815e",
          });
      })
      .finally(() => wx.hideLoading());
  },

  whenReady(this: AppInstance): Promise<void> {
    if (this._ready) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this._readyResolvers.push(resolve);
    });
  },

  switchGroup(this: AppInstance, groupId: string) {
    this.globalData.groupId = groupId;
    wx.setStorageSync(ACTIVE_GROUP_KEY, groupId);
  },

  async _initApp(this: AppInstance) {
    const loginRes = await wx.cloud.callFunction({ name: "login" });
    const openid = (loginRes.result as { openid: string }).openid;
    this.globalData.openid = openid;

    const db = wx.cloud.database();

    await this._ensureUserProfile(db, openid);

    let groupQuery = await db
      .collection("groups")
      .where({ members: openid })
      .get();

    if (groupQuery.data.length === 0) {
      groupQuery = await db
        .collection("groups")
        .where({ _openid: openid })
        .get();
    }

    if (groupQuery.data.length > 0) {
      const groups = groupQuery.data as GroupInfo[];
      this.globalData.groups = groups;

      const storedId = wx.getStorageSync(ACTIVE_GROUP_KEY);
      const activeId =
        storedId && groups.some((g) => g._id === storedId)
          ? storedId
          : groups[0]._id;

      this.globalData.groupId = activeId;
      if (!storedId || storedId !== activeId) {
        wx.setStorageSync(ACTIVE_GROUP_KEY, activeId);
      }
      return;
    }

    const groupRes = await db.collection("groups").add({
      data: {
        name: "我的厨房",
        members: [openid],
      },
    });
    const groupId = groupRes._id as string;
    this.globalData.groupId = groupId;
    this.globalData.groups = [
      { _id: groupId, name: "我的厨房", members: [openid] },
    ];
    wx.setStorageSync(ACTIVE_GROUP_KEY, groupId);

    const userConfig = buildDefaultUserConfig(groupId, openid);
    await db.collection("user_config").add({ data: userConfig });

    const dishes = buildPresetDishes(groupId, openid);
    await Promise.all(
      dishes.map((dish) => db.collection("dishes").add({ data: dish })),
    );
  },

  async _ensureUserProfile(
    this: AppInstance,
    db: ReturnType<typeof wx.cloud.database>,
    openid: string,
  ) {
    try {
      const res = await db
        .collection("users")
        .where({ _openid: openid })
        .limit(1)
        .get();

      if (res.data.length > 0) {
        const user = res.data[0] as { nickName: string; avatarUrl?: string };
        this.globalData.nickName = user.nickName;
        this.globalData.avatarUrl = user.avatarUrl || "";
        // Detect default auto-generated nicknames: 用户 + 6 hex chars, with no avatar
        if (/^用户[a-z0-9]{6}$/.test(user.nickName) && !user.avatarUrl) {
          this.globalData.needProfileSetup = true;
        }
        return;
      }

      const nickName = `用户${openid.slice(-6)}`;
      await db.collection("users").add({
        data: { nickName, avatarUrl: "", createdAt: Date.now() },
      });
      this.globalData.nickName = nickName;
      this.globalData.avatarUrl = "";
      this.globalData.needProfileSetup = true;
    } catch (err) {
      console.error("[app] ensure user profile failed", err);
    }
  },
});
