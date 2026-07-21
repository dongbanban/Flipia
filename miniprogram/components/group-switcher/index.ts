interface GroupInfo {
  _id: string;
  name: string;
  members: string[];
}

Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    groups: { type: Array, value: [] as GroupInfo[] },
    activeGroupId: { type: String, value: "" },
    openid: { type: String, value: "" },
  },

  data: {
    showPopup: false,
    activeGroupName: "",
    activeGroupMemberCount: 0,
  },

  observers: {
    "activeGroupId, groups"(
      activeId: string,
      groups: GroupInfo[],
    ) {
      const active = groups.find((g) => g._id === activeId);
      if (active) {
        this.setData({
          activeGroupName: active.name,
          activeGroupMemberCount: active.members.length,
        });
      } else if (groups.length > 0) {
        const first = groups[0];
        this.setData({
          activeGroupName: first.name,
          activeGroupMemberCount: first.members.length,
        });
      }
    },
  },

  methods: {
    onToggle() {
      this.setData({ showPopup: !this.data.showPopup });
    },

    onClose() {
      this.setData({ showPopup: false });
    },

    onSelectGroup(e: WechatMiniprogram.TouchEvent) {
      const id = (e.currentTarget.dataset as { id: string }).id;
      if (id === this.data.activeGroupId) {
        this.setData({ showPopup: false });
        return;
      }
      this.triggerEvent("change", { groupId: id });
      this.setData({ showPopup: false });
    },

    onCreateGroup() {
      this.setData({ showPopup: false });
      this.triggerEvent("create");
    },

    noop() {},
  },
});
