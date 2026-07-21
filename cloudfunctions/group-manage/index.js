const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MAX_MEMBERS = 5;

function genJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function handleRename(event, openid) {
  const { groupId, name } = event;
  if (!groupId || !name) return { ok: false, error: "缺少参数" };
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 12)
    return { ok: false, error: "名称不合法" };

  const groupRes = await db.collection("groups").doc(groupId).get();
  if (!groupRes.data) return { ok: false, error: "厨房不存在" };

  const group = groupRes.data;
  if (!group.members || !group.members.includes(openid)) {
    return { ok: false, error: "你不在该厨房中" };
  }

  await db
    .collection("groups")
    .doc(groupId)
    .update({
      data: { name: trimmed },
    });

  return { ok: true, name: trimmed };
}

async function handleGenerateInviteCode(event, openid) {
  const { groupId } = event;
  if (!groupId) return { ok: false, error: "缺少参数" };

  const groupRes = await db.collection("groups").doc(groupId).get();
  if (!groupRes.data) return { ok: false, error: "厨房不存在" };

  const group = groupRes.data;
  if (!group.members || !group.members.includes(openid)) {
    return { ok: false, error: "你不在该厨房中" };
  }

  const joinCode = genJoinCode();
  await db.collection("groups").doc(groupId).update({
    data: { joinCode },
  });

  return { ok: true, joinCode };
}

async function handleJoin(event, openid) {
  const { joinCode } = event;
  if (!joinCode) return { ok: false, error: "缺少邀请码" };

  const groupRes = await db
    .collection("groups")
    .where({ joinCode })
    .limit(1)
    .get();
  if (groupRes.data.length === 0) return { ok: false, error: "邀请码无效" };

  const group = groupRes.data[0];

  if (group.members && group.members.includes(openid)) {
    return { ok: false, error: "你已在该厨房中" };
  }

  if (group.members && group.members.length >= MAX_MEMBERS) {
    return { ok: false, error: "厨房已满（最多5人）" };
  }

  await db
    .collection("groups")
    .doc(group._id)
    .update({
      data: { members: [...(group.members || []), openid] },
    });

  return { ok: true, groupId: group._id, name: group.name };
}

async function handleLeave(event, openid) {
  const { groupId } = event;
  if (!groupId) return { ok: false, error: "缺少参数" };

  const groupRes = await db.collection("groups").doc(groupId).get();
  if (!groupRes.data) return { ok: false, error: "厨房不存在" };

  const group = groupRes.data;
  if (!group.members || !group.members.includes(openid)) {
    return { ok: false, error: "你不在该厨房中" };
  }

  const remaining = group.members.filter((id) => id !== openid);

  if (remaining.length === 0) {
    await deleteGroupData(groupId);
    return { ok: true, dissolved: true };
  }

  await db
    .collection("groups")
    .doc(groupId)
    .update({
      data: { members: remaining },
    });

  return { ok: true, dissolved: false };
}

async function handleKick(event, openid) {
  const { groupId, targetOpenid } = event;
  if (!groupId || !targetOpenid) return { ok: false, error: "缺少参数" };

  const groupRes = await db.collection("groups").doc(groupId).get();
  if (!groupRes.data) return { ok: false, error: "厨房不存在" };

  const group = groupRes.data;
  if (group._openid !== openid)
    return { ok: false, error: "仅厨房创建者可踢人" };
  if (targetOpenid === openid) return { ok: false, error: "不能踢自己" };

  if (!group.members || !group.members.includes(targetOpenid)) {
    return { ok: false, error: "目标用户不在该厨房中" };
  }

  const remaining = group.members.filter((id) => id !== targetOpenid);

  await db
    .collection("groups")
    .doc(groupId)
    .update({
      data: { members: remaining },
    });

  return { ok: true };
}

async function handleDissolve(event, openid) {
  const { groupId } = event;
  if (!groupId) return { ok: false, error: "缺少参数" };

  const groupRes = await db.collection("groups").doc(groupId).get();
  if (!groupRes.data) return { ok: false, error: "厨房不存在" };

  const group = groupRes.data;
  if (group._openid !== openid)
    return { ok: false, error: "仅厨房创建者可解散厨房" };

  await deleteGroupData(groupId);
  return { ok: true, dissolved: true };
}

async function deleteGroupData(groupId) {
  await db.collection("groups").doc(groupId).remove();

  const delMany = async (collection) => {
    const MAX_LIMIT = 100;
    const countRes = await db.collection(collection).where({ groupId }).count();
    const total = countRes.total;
    for (let i = 0; i < total; i += MAX_LIMIT) {
      const res = await db
        .collection(collection)
        .where({ groupId })
        .limit(MAX_LIMIT)
        .get();
      const ids = res.data.map((d) => d._id);
      if (ids.length > 0) {
        await Promise.all(
          ids.map((id) => db.collection(collection).doc(id).remove()),
        );
      }
    }
  };

  await Promise.all([
    delMany("user_config"),
    delMany("dishes"),
    delMany("draw_history"),
  ]);
}

exports.main = async (event, context) => {
  const { action } = event;
  const { OPENID } = cloud.getWXContext();

  try {
    switch (action) {
      case "rename":
        return await handleRename(event, OPENID);
      case "generate-invite-code":
        return await handleGenerateInviteCode(event, OPENID);
      case "join":
        return await handleJoin(event, OPENID);
      case "leave":
        return await handleLeave(event, OPENID);
      case "kick":
        return await handleKick(event, OPENID);
      case "dissolve":
        return await handleDissolve(event, OPENID);
      default:
        return { ok: false, error: "无效操作" };
    }
  } catch (err) {
    console.error("[group-manage] error", err);
    return { ok: false, error: "操作失败，请重试" };
  }
};
