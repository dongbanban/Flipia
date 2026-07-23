import { Store } from "westore";

/** UserStore 数据层 */
interface UserData {
  /** 用户昵称 */
  nickName: string;
  /** 用户头像 URL */
  avatarUrl: string;
  /** 是否需要引导设置个人信息 */
  needProfileSetup: boolean;
}

/**
 * 用户信息 Store，持有当前用户的昵称、头像和 setup 状态。
 */
class UserStore extends Store<UserData> {
  constructor() {
    super();
    this.data = {
      nickName: "",
      avatarUrl: "",
      needProfileSetup: false,
    };
  }

  // ── 操作方法 ────────────────────────────────────────────

  /**
   * 设置用户昵称和头像。
   * @param nickName - 新昵称
   * @param avatarUrl - 新头像 URL
   */
  setProfile(nickName: string, avatarUrl: string) {
    this.data.nickName = nickName;
    this.data.avatarUrl = avatarUrl;
    this.data.needProfileSetup = false;
    this.update();
  }

  /** 跳过个人信息设置引导，后续仍可返回设置。 */
  skipProfileSetup() {
    this.data.needProfileSetup = false;
    this.update();
  }
}

export const userStore = new UserStore();
