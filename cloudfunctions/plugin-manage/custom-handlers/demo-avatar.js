/**
 * demo-avatar 插件的自定义处理逻辑。
 *
 * assess(db, openid) 由 handlers.js 调用，插件自行查询所需数据并返回评估结果。
 * 返回值：
 *   - passed: boolean — 是否满足解锁条件
 *   - progressHint: string — 进度提示文案
 *   - current: number — 当前进度值
 *   - target: number — 目标值
 * 查询失败时向上抛出异常，handlers.js 会捕获并返回错误。
 *
 * @param {object} db - 云数据库实例
 * @param {string} openid - 用户 openid
 */
const config = require("../config");

module.exports = {
  async assess(db, openid) {
    const res = await db
      .collection(config.COLLECTION_USERS)
      .where({ _openid: openid })
      .limit(1)
      .get();

    const hasAvatar = !!(res.data.length > 0 && res.data[0].avatarUrl);

    return {
      passed: hasAvatar,
      progressHint: hasAvatar ? "头像已设置" : "请先设置头像",
      current: hasAvatar ? 1 : 0,
      target: 1,
    };
  },
};
