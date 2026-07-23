import { Store } from "westore";
import type { GroupInfo } from "@/types/group";
import {
  ACTIVE_GROUP_KEY,
  STORAGE_ACTIVE_CONFIG_KEY,
  STORAGE_LAST_DRAWN_KEY,
} from "@/constants/storage-keys";

/** GroupStore 数据层 */
interface GroupData {
  /** 当前激活的厨房 ID */
  groupId: string;
  /** 用户所属的所有厨房列表 */
  groups: GroupInfo[];
  /** 当前激活的抽签方案 ID */
  activeConfigId: string;
  /** 上次抽签使用的方案 ID */
  lastDrawnConfigId: string;
}

/**
 * 厨房/群组 Store，管理厨房列表、活跃厨房和抽签方案的选中状态。
 * 关键方法含 Storage 持久化，与现有 wx.setStorageSync 键名保持一致。
 */
class GroupStore extends Store<GroupData> {
  constructor() {
    super();
    this.data = {
      groupId: "",
      groups: [],
      activeConfigId: "",
      lastDrawnConfigId: "",
    };
  }

  // ── 操作方法 ────────────────────────────────────────────

  /**
   * 切换当前激活的厨房。
   * 更新 Store 数据并持久化到 Storage。
   * @param groupId - 目标厨房 ID
   */
  switchGroup(groupId: string) {
    this.data.groupId = groupId;
    this.update();
    wx.setStorageSync(ACTIVE_GROUP_KEY, groupId);
  }

  /**
   * 批量设置厨房列表。
   * 通常用于 app 初始化一次性加载所有厨房后调用。
   * @param groups - 厨房列表
   */
  setGroups(groups: GroupInfo[]) {
    this.data.groups = groups;
    this.update();
  }

  /**
   * 设置当前激活的抽签方案 ID，并持久化到 Storage。
   * @param configId - 方案 ID
   */
  setActiveConfig(configId: string) {
    this.data.activeConfigId = configId;
    this.update();
    wx.setStorageSync(STORAGE_ACTIVE_CONFIG_KEY, configId);
  }

  /**
   * 设置上次抽签使用的方案 ID，并持久化到 Storage。
   * @param configId - 方案 ID
   */
  setLastDrawnConfig(configId: string) {
    this.data.lastDrawnConfigId = configId;
    this.update();
    wx.setStorageSync(STORAGE_LAST_DRAWN_KEY, configId);
  }
}

export const groupStore = new GroupStore();
