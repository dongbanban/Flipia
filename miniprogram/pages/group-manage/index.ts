import { sanitizeInput } from "../../lib/sanitize";
import { showConfirm } from "../../lib/confirm";
import { LIMITS } from "../../config";

interface GroupInfo {
  _id: string;
  _openid: string;
  name: string;
  members: string[];
  joinCode?: string;
}

interface MemberInfo {
  openid: string;
  nickName: string;
  initial: string;
  isOwner: boolean;
}

interface UserProfile {
  _openid: string;
  nickName: string;
}

type App = WechatMiniprogram.App.Instance<Record<string, unknown>> & {
  globalData: {
    openid: string;
    nickName: string;
    groupId: string;
    groups: GroupInfo[];
  };
  switchGroup(id: string): void;
  whenReady(): Promise<void>;
};

interface PageOptions {
  joinCode?: string;
}

Page({
  data: {
    groupId: "",
    groupName: "",
    groupOwnerOpenid: "",
    members: [] as MemberInfo[],
    isOwner: false,
    myOpenid: "",
    groups: [] as Array<{ _id: string; name: string; members: string[] }>,
    activeGroupId: "",
    openid: "",
    editingName: false,
    editValue: "",
    joinCode: "",
    showJoinPrompt: false,
    joinPromptGroupName: "",
    joinBtnText: "加入厨房",
    joinError: "",
    joining: false,
    loading: true,
  },

  _db: null as ReturnType<typeof wx.cloud.database> | null,
  _group: null as GroupInfo | null,

  async onLoad(options: PageOptions) {
    const app = getApp<AppInstance>();
    await app.whenReady();

    const db = wx.cloud.database();
    this._db = db;
    this.setData({
      myOpenid: app.globalData.openid,
      groups: app.globalData.groups,
      activeGroupId: app.globalData.groupId,
      openid: app.globalData.openid,
    });

    if (options.joinCode) {
      this.setData({ joinCode: options.joinCode, joining: true });
      try {
        const res = await db
          .collection("groups")
          .where({ joinCode: options.joinCode })
          .limit(1)
          .get();

        if (res.data.length === 0) {
          this.setData({
            showJoinPrompt: true,
            joinPromptGroupName: "未知厨房",
            joinBtnText: "邀请码无效",
            joinError: "邀请码无效或已过期",
            joining: false,
          });
          return;
        }

        const group = res.data[0] as GroupInfo;
        this._group = group;

        const alreadyInGroup = app.globalData.groups.some(
          (g) => g._id === group._id,
        );
        if (alreadyInGroup) {
          app.switchGroup(group._id);
          wx.showToast({ title: "你已在该厨房中", icon: "none" });
          setTimeout(() => wx.navigateBack(), 1200);
          return;
        }

        this.setData({
          showJoinPrompt: true,
          joinPromptGroupName: group.name,
          joining: false,
        });
      } catch (err) {
        console.error("[group-manage] load join group failed", err);
        this.setData({
          showJoinPrompt: true,
          joinPromptGroupName: "加载失败",
          joinError: "网络异常，请重试",
          joining: false,
        });
      }
      return;
    }

    const groupId = app.globalData.groupId;
    const groups = app.globalData.groups as GroupInfo[];
    const group = groups.find((g) => g._id === groupId);
    if (!group) {
      wx.showToast({ title: "厨房不存在", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }

    this._group = group;
    this.setData({
      groupId,
      groupName: group.name,
      groupOwnerOpenid: "",
      joinCode: group.joinCode || "",
    });
    await this._loadGroupDetail(groupId);
    await this._loadMembers(groupId);
    this.setData({ loading: false });
  },

  onGroupChange(e: WechatMiniprogram.CustomEvent<{ groupId: string }>) {
    const app = getApp<AppInstance>();
    app.switchGroup(e.detail.groupId);

    const groups = app.globalData.groups;
    const group = groups.find((g) => g._id === e.detail.groupId);
    this._group = (group as GroupInfo | undefined) || null;

    this.setData({
      activeGroupId: e.detail.groupId,
      groupId: e.detail.groupId,
      groupName: group?.name || "",
      members: [],
      isOwner: false,
      loading: true,
    });

    this._loadGroupDetail(e.detail.groupId);
    this._loadMembers(e.detail.groupId);
  },

  onGroupCreate() {
    wx.navigateTo({ url: "/pages/group-create/index" });
  },

  async _loadGroupDetail(groupId: string) {
    try {
      const res = await this._db!.collection("groups").doc(groupId).get();
      const group = res.data as GroupInfo;
      if (group) {
        this._group = group;
        const isOwner = group._openid === this.data.myOpenid;
        this.setData({
          groupName: group.name,
          groupOwnerOpenid: group._openid,
          joinCode: group.joinCode || "",
          isOwner,
        });
        if (!group.joinCode) {
          this._ensureJoinCode();
        }
      }
    } catch (err) {
      console.error("[group-manage] load group detail failed", err);
    }
  },

  async _ensureJoinCode() {
    try {
      const res = await wx.cloud.callFunction({
        name: "group-manage",
        data: {
          action: "generate-invite-code",
          groupId: this.data.groupId,
        },
      });
      const result = res.result as { ok: boolean; joinCode?: string };
      if (result.ok && result.joinCode) {
        this.setData({ joinCode: result.joinCode });
      }
    } catch (err) {
      console.error("[group-manage] ensure join code failed", err);
    }
  },

  async _loadMembers(groupId: string) {
    const group = this._group;
    if (!group || !group.members) return;

    const memberOpenids = group.members;
    const isOwner = group._openid === this.data.myOpenid;

    try {
      const userRes = await this._db!.collection("users")
        .where({ _openid: this._db!.command.in(memberOpenids) })
        .get();

      const profiles = userRes.data as UserProfile[];
      const profileMap: Record<string, string> = {};
      for (const p of profiles) {
        profileMap[p._openid] = p.nickName;
      }

      const members: MemberInfo[] = memberOpenids.map((openid) => ({
        openid,
        nickName: profileMap[openid] || `用户${openid.slice(-6)}`,
        initial: (profileMap[openid] || "用").charAt(0),
        isOwner: openid === group._openid,
      }));

      this.setData({ members, isOwner });
    } catch (err) {
      console.error("[group-manage] load members failed", err);
      const members: MemberInfo[] = memberOpenids.map((openid) => ({
        openid,
        nickName: `用户${openid.slice(-6)}`,
        initial: "用",
        isOwner: openid === group._openid,
      }));
      this.setData({ members, isOwner });
    }
  },

  async onConfirmJoin() {
    if (this.data.joinBtnText !== "加入厨房") return;

    this.setData({ joinError: "", joining: true });
    try {
      const res = await wx.cloud.callFunction({
        name: "group-manage",
        data: { action: "join", joinCode: this.data.joinCode },
      });

      const result = res.result as {
        ok: boolean;
        error?: string;
        groupId?: string;
        name?: string;
      };

      if (!result.ok) {
        this.setData({ joinError: result.error || "加入失败", joining: false });
        return;
      }

      const app = getApp<AppInstance>();
      const newGroup: GroupInfo = {
        _id: result.groupId!,
        _openid: app.globalData.openid,
        name: result.name!,
        members: [app.globalData.openid],
      };
      app.globalData.groups = [...app.globalData.groups, newGroup];
      app.switchGroup(result.groupId!);

      wx.showToast({ title: "加入成功", icon: "success" });
      setTimeout(() => {
        wx.switchTab({ url: "/pages/index/index" });
      }, 800);
    } catch (err) {
      console.error("[group-manage] join failed", err);
      this.setData({
        joinError: "网络异常，请重试",
        joining: false,
      });
    }
  },

  onTapName() {
    this.setData({
      editingName: true,
      editValue: this.data.groupName,
    });
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ editValue: e.detail.value });
  },

  async onConfirmName() {
    const name = this.data.editValue.trim();
    if (name === this.data.groupName) {
      this.setData({ editingName: false });
      return;
    }

    const confirmed = await showConfirm({
      title: "修改厨房名",
      content: `确定将厨房名改为「${name}」？`,
    });
    if (!confirmed) {
      // 保持编辑状态打开，以便用户修改
      return;
    }

    const { valid, value: sanitized } = await sanitizeInput({
      value: name,
      maxLength: LIMITS.GROUP_NAME_MAX,
      fieldName: "厨房名",
    });
    if (!valid) return;

    wx.showLoading({ title: "保存中…", mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: "group-manage",
        data: { action: "rename", groupId: this.data.groupId, name: sanitized },
      });

      const result = res.result as {
        ok: boolean;
        error?: string;
        name?: string;
      };
      if (!result.ok) {
        wx.showToast({ title: result.error || "保存失败", icon: "none" });
        return;
      }

      const app = getApp<AppInstance>();
      const groups = app.globalData.groups.map((g) =>
        g._id === this.data.groupId ? { ...g, name: result.name! } : g,
      );
      app.globalData.groups = groups;

      this.setData({ groupName: result.name!, editingName: false });
      wx.showToast({ title: "已保存", icon: "success" });
    } catch (err) {
      console.error("[group-manage] rename failed", err);
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  onCancelName() {
    this.setData({ editingName: false, editValue: "" });
  },

  async onKick(e: WechatMiniprogram.TouchEvent) {
    const openid = (e.currentTarget.dataset as { openid: string }).openid;
    const name = (e.currentTarget.dataset as { name: string }).name;

    const confirmed = await showConfirm({
      title: "踢出成员",
      content: `确认将「${name}」移出厨房？`,
    });
    if (!confirmed) return;

    wx.showLoading({ title: "移除中…", mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: "group-manage",
        data: {
          action: "kick",
          groupId: this.data.groupId,
          targetOpenid: openid,
        },
      });

      const result = res.result as { ok: boolean; error?: string };
      if (!result.ok) {
        wx.showToast({ title: result.error || "移除失败", icon: "none" });
        return;
      }

      const members = this.data.members.filter((m) => m.openid !== openid);
      this.setData({ members });

      const app = getApp<AppInstance>();
      const groups = app.globalData.groups.map((g) =>
        g._id === this.data.groupId
          ? { ...g, members: g.members.filter((id) => id !== openid) }
          : g,
      );
      app.globalData.groups = groups;

      wx.showToast({ title: "已移除", icon: "success" });
    } catch (err) {
      console.error("[group-manage] kick failed", err);
      wx.showToast({ title: "操作失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async onShareAppMessage(): Promise<WechatMiniprogram.Page.ICustomShareContent> {
    if (!this.data.joinCode) {
      await this._ensureJoinCode();
    }
    return {
      title: `邀请你加入「${this.data.groupName}」`,
      path: `/pages/group-manage/index?joinCode=${this.data.joinCode || ""}`,
      imageUrl: "",
    };
  },

  async onLeave() {
    const confirmed = await showConfirm({
      title: "退出厨房",
      content: "退出后将从你的厨房列表中移除该厨房，厨房数据不受影响。",
    });
    if (!confirmed) return;

    wx.showLoading({ title: "退出中…", mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: "group-manage",
        data: { action: "leave", groupId: this.data.groupId },
      });

      const result = res.result as {
        ok: boolean;
        error?: string;
        dissolved?: boolean;
      };

      if (!result.ok) {
        wx.showToast({ title: result.error || "操作失败", icon: "none" });
        return;
      }

      this._removeFromLocal();
      wx.showToast({ title: "已退出厨房", icon: "success" });

      setTimeout(() => {
        wx.switchTab({ url: "/pages/index/index" });
      }, 800);
    } catch (err) {
      console.error("[group-manage] leave failed", err);
      wx.showToast({ title: "操作失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  onDissolve() {
    this._doDissolve();
  },

  async _doDissolve() {
    const confirmed = await showConfirm({
      title: "解散厨房",
      content: "解散后厨房及所有数据将被永久删除，不可恢复。",
    });
    if (!confirmed) return;

    wx.showLoading({ title: "解散中…", mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: "group-manage",
        data: { action: "dissolve", groupId: this.data.groupId },
      });

      const result = res.result as { ok: boolean; error?: string };
      if (!result.ok) {
        wx.showToast({ title: result.error || "操作失败", icon: "none" });
        return;
      }

      this._removeFromLocal();
      wx.showToast({ title: "厨房已解散", icon: "success" });

      setTimeout(() => {
        wx.switchTab({ url: "/pages/index/index" });
      }, 800);
    } catch (err) {
      console.error("[group-manage] dissolve failed", err);
      wx.showToast({ title: "操作失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  _removeFromLocal() {
    const app = getApp<AppInstance>();
    const groups = app.globalData.groups.filter(
      (g) => g._id !== this.data.groupId,
    );
    app.globalData.groups = groups;

    if (app.globalData.groupId === this.data.groupId) {
      app.switchGroup(groups.length > 0 ? groups[0]._id : "");
    }
  },
});
