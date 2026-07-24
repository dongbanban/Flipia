const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const handlers = require("./handlers");

exports.main = async (event, context) => {
  const { action } = event;
  const { OPENID } = cloud.getWXContext();

  try {
    switch (action) {
      case "list":
        return await handlers.handleList(db, OPENID);
      case "unlock":
        return await handlers.handleUnlock(db, event, OPENID);
      case "toggle":
        return await handlers.handleToggle(db, event, OPENID);
      default:
        return { ok: false, error: "无效操作" };
    }
  } catch (err) {
    console.error("[plugin-manage] error", err);
    return { ok: false, error: "操作失败，请重试" };
  }
};
