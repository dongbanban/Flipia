const config = require("./config");
const registry = require("./plugin-registry");

// ═══════════════════════════════════════════════════════════
//  加载插件定义
// ═══════════════════════════════════════════════════════════

/** 从注册表和自定义处理模块构建运行时插件定义映射 */
const pluginDefs = registry.map(function (entry) {
  const customHandler = require(entry.handler);
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    assess: customHandler.assess,
  };
});

// ═══════════════════════════════════════════════════════════
//  user_plugin 文档管理
// ═══════════════════════════════════════════════════════════

/**
 * 确保当前用户的 user_plugin 文档存在且条目完整。
 * - 新用户：自动创建文档，所有插件 locked + disabled
 * - 已有用户：补齐缺失的新插件条目，清理不在 defs 中的废弃条目
 *
 * @param {object} db - 云数据库实例
 * @param {string} openid - 用户 openid
 * @returns {Promise<{_id: string, _openid: string, plugins: object}>}
 */
async function ensureUserPluginDoc(db, openid) {
  const res = await db
    .collection(config.COLLECTION_USER_PLUGIN)
    .where({ _openid: openid })
    .limit(1)
    .get();

  if (res.data.length === 0) {
    // ── 新用户：创建初始文档 ──
    var plugins = {};
    pluginDefs.forEach(function (def) {
      plugins[def.id] = { unlocked: false, enabled: false };
    });
    var addRes = await db.collection(config.COLLECTION_USER_PLUGIN).add({
      data: { _openid: openid, plugins: plugins },
    });
    return { _id: addRes._id, _openid: openid, plugins: plugins };
  }

  var doc = res.data[0];
  var modified = false;

  // 补齐缺失的新插件条目
  pluginDefs.forEach(function (def) {
    if (!doc.plugins[def.id]) {
      doc.plugins[def.id] = { unlocked: false, enabled: false };
      modified = true;
    }
  });

  // 清理废弃插件条目（不在 defs 中）
  Object.keys(doc.plugins).forEach(function (id) {
    if (!pluginDefs.find(function (d) { return d.id === id; })) {
      delete doc.plugins[id];
      modified = true;
    }
  });

  if (modified) {
    await db
      .collection(config.COLLECTION_USER_PLUGIN)
      .doc(doc._id)
      .update({ data: { plugins: doc.plugins } });
  }

  return doc;
}

// ═══════════════════════════════════════════════════════════
//  Handler: list
// ═══════════════════════════════════════════════════════════

/**
 * 返回插件定义列表 + 用户插件状态 + 未解锁插件的评估进度。
 * 首次调用自动创建 user_plugin 文档。
 */
async function handleList(db, openid) {
  var userDoc = await ensureUserPluginDoc(db, openid);

  var plugins = [];
  for (var i = 0; i < pluginDefs.length; i++) {
    var def = pluginDefs[i];
    var state = userDoc.plugins[def.id] || { unlocked: false, enabled: false };

    var assessment;
    try {
      assessment = await def.assess(db, openid);
    } catch (err) {
      console.error("[plugin-manage] 插件评估失败: " + def.id, err);
      return { ok: false, error: "数据查询失败，请稍后重试" };
    }

    plugins.push({
      id: def.id,
      name: def.name,
      description: def.description,
      unlocked: state.unlocked,
      enabled: state.enabled,
      progressHint: state.unlocked ? "已解锁" : assessment.progressHint,
      current: assessment.current,
      target: assessment.target,
    });
  }

  return { ok: true, plugins: plugins };
}

// ═══════════════════════════════════════════════════════════
//  Handler: unlock
// ═══════════════════════════════════════════════════════════

/**
 * 对指定插件运行 assess 评估函数。
 * 通过则写入 unlocked: true；不通过返回进度信息，不修改状态。
 * 已解锁插件幂等。
 */
async function handleUnlock(db, event, openid) {
  var pluginId = event.pluginId;
  if (!pluginId) return { ok: false, error: "缺少插件 ID" };

  var def = pluginDefs.find(function (d) { return d.id === pluginId; });
  if (!def) return { ok: false, error: "插件不存在" };

  var userDoc = await ensureUserPluginDoc(db, openid);

  // 已解锁 → 幂等返回
  if (userDoc.plugins[pluginId] && userDoc.plugins[pluginId].unlocked) {
    return { ok: true, alreadyUnlocked: true };
  }

  // 运行插件自定义评估（失败时返回错误，不进行部分评估）
  var assessment;
  try {
    assessment = await def.assess(db, openid);
  } catch (err) {
    console.error("[plugin-manage] 插件评估失败: " + pluginId, err);
    return { ok: false, error: "数据查询失败，请稍后重试" };
  }

  if (!assessment.passed) {
    return {
      ok: true,
      unlocked: false,
      progressHint: assessment.progressHint,
      current: assessment.current,
      target: assessment.target,
    };
  }

  // 通过：写入 unlocked
  var updatedPlugins = {};
  Object.keys(userDoc.plugins).forEach(function (id) {
    updatedPlugins[id] = Object.assign({}, userDoc.plugins[id]);
  });
  updatedPlugins[pluginId] = Object.assign({}, updatedPlugins[pluginId], {
    unlocked: true,
    enabled: true,
  });

  await db
    .collection(config.COLLECTION_USER_PLUGIN)
    .doc(userDoc._id)
    .update({ data: { plugins: updatedPlugins } });

  return { ok: true, unlocked: true };
}

// ═══════════════════════════════════════════════════════════
//  Handler: toggle
// ═══════════════════════════════════════════════════════════

/**
 * 切换插件的启用/禁用状态。
 * 仅对 unlocked: true 的插件生效，locked 插件拒绝操作。
 */
async function handleToggle(db, event, openid) {
  var pluginId = event.pluginId;
  var enabled = event.enabled;

  if (!pluginId) return { ok: false, error: "缺少插件 ID" };
  if (typeof enabled !== "boolean") return { ok: false, error: "缺少 enabled 参数" };

  var def = pluginDefs.find(function (d) { return d.id === pluginId; });
  if (!def) return { ok: false, error: "插件不存在" };

  var userDoc = await ensureUserPluginDoc(db, openid);
  var currentPlugin = userDoc.plugins[pluginId];

  if (!currentPlugin || !currentPlugin.unlocked) {
    return { ok: false, error: "插件未解锁，无法切换启用状态" };
  }

  var updatedPlugins = {};
  Object.keys(userDoc.plugins).forEach(function (id) {
    updatedPlugins[id] = Object.assign({}, userDoc.plugins[id]);
  });
  updatedPlugins[pluginId] = Object.assign({}, currentPlugin, { enabled: enabled });

  await db
    .collection(config.COLLECTION_USER_PLUGIN)
    .doc(userDoc._id)
    .update({ data: { plugins: updatedPlugins } });

  return { ok: true, enabled: enabled };
}

// ═══════════════════════════════════════════════════════════
//  导出
// ═══════════════════════════════════════════════════════════

module.exports = {
  pluginDefs: pluginDefs,
  ensureUserPluginDoc: ensureUserPluginDoc,
  handleList: handleList,
  handleUnlock: handleUnlock,
  handleToggle: handleToggle,
};
