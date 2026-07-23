import { buildDefaultUserConfig, buildPresetDishes } from "@/lib/init-data";
import { showConfirm } from "@/lib/confirm";
import { CLOUD, STRINGS } from "@/config";
import { userStore, groupStore } from "@/stores";
import { ACTIVE_GROUP_KEY } from "@/constants/storage-keys";

interface GroupInfo {
  _id: string;
  name: string;
  members: string[];
}

interface AppGlobalData {
  openid: string;
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
  whenReady(): Promise<void>;
}

App({
  globalData: {
    openid: "",
  } as AppGlobalData,

  _readyResolvers: [] as Array<() => void>,
  _ready: false,

  onLaunch(this: AppInstance) {
    wx.cloud.init({
      env: CLOUD.envId,
      traceUser: true,
    });

    this._initApp()
      .then(() => {
        this._ready = true;
        const resolvers = this._readyResolvers;
        this._readyResolvers = [];
        for (const resolve of resolvers) resolve();
        // 应用就绪后各页面自行处理路由跳转
      })
      .catch((err: unknown) => {
        console.error("[app] init failed", err);
          showConfirm({
            title: "初始化失败",
            content: "网络异常，请重启小程序重试",
            confirmText: "确定",
            cancelText: "取消",
          });
      });
  },

  whenReady(this: AppInstance): Promise<void> {
    if (this._ready) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this._readyResolvers.push(resolve);
    });
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

      const storedId = wx.getStorageSync(ACTIVE_GROUP_KEY);
      const activeId =
        storedId && groups.some((g) => g._id === storedId)
          ? storedId
          : groups[0]._id;

      groupStore.setGroups(groups);
      groupStore.switchGroup(activeId);
      console.log("[app] 双写验证 — Store 内容", {
        userStore: userStore.data,
        groupStore: groupStore.data,
      });
      return;
    }

    const groupRes = await db.collection("groups").add({
      data: {
        name: STRINGS.DEFAULT_GROUP_NAME,
        members: [openid],
      },
    });
    const groupId = groupRes._id as string;
    groupStore.setGroups([
      { _id: groupId, name: STRINGS.DEFAULT_GROUP_NAME, members: [openid] },
    ]);
    groupStore.switchGroup(groupId);

    const userConfig = buildDefaultUserConfig(groupId, openid);
    await db.collection("user_config").add({ data: userConfig });

    const dishes = buildPresetDishes(groupId, openid);
    await Promise.all(
      dishes.map((dish) => db.collection("dishes").add({ data: dish })),
    );
    console.log("[app] 双写验证 — Store 内容", {
      userStore: userStore.data,
      groupStore: groupStore.data,
    });
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
        userStore.setProfile(user.nickName, user.avatarUrl || "");
        return;
      }

      const nickName = `用户${openid.slice(-6)}`;
      // 延迟创建用户文档——profile-setup 页面将在确认时创建
      userStore.data.nickName = nickName;
      userStore.data.avatarUrl = "";
      userStore.data.needProfileSetup = true;
      userStore.update();
    } catch (err) {
      console.error("[app] ensure user profile failed", err);
    }
  },
});
