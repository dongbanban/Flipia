const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const config = require("./config");

// URL regex — matches http/https/ftp links in text
const URL_REGEX = config.URL_REGEX;

function extractUrls(text) {
  const matches = text.match(URL_REGEX);
  return matches || [];
}

/**
 * 文本内容安全检测
 * 1) 调用微信 msgSecCheck v2 检测敏感词
 * 2) 自定义 URL 正则过滤器，命中即视为未通过
 */
async function handleTextCheck(event, openid) {
  const { content } = event;

  // Step 1: msgSecCheck v2
  try {
    const result = await cloud.openapi.security.msgSecCheck({
      openid,
      scene: config.SCENE_MSG_SEC_CHECK,
      version: config.VERSION_MSG_SEC_CHECK,
      content,
    });

    if (result.result && result.result.suggest === config.SUGGEST_RISKY) {
      return { pass: false, reason: "文本包含违规内容" };
    }
  } catch (err) {
    // errCode 87014 = risky content (inherited from v1 behavior, v2 may also throw)
    if (err.errCode === config.ERR_CODE_RISKY) {
      return { pass: false, reason: "文本包含违规内容" };
    }
    // Other errors (network, auth, rate-limit) — fail closed
    console.error("[content-security] msgSecCheck error", err);
    return { pass: false, reason: "文本安全检测失败" };
  }

  // Step 2: URL filter
  const urls = extractUrls(content);
  if (urls.length > 0) {
    return { pass: false, reason: "文本包含链接" };
  }

  return { pass: true };
}

/**
 * 图片内容安全检测
 *
 * 2026-07-22: security.imgSecCheck (v1) 已于 2021 年 9 月废弃，2026 年起出现
 * "api unauthorized" 等拒绝服务现象，不可再依赖。当前策略：
 *  - errCode 87014（违规内容）→ 仍然拦截
 *  - 其他错误（API 不可用/权限被回收等）→ 兜底放行 + 告警日志，不阻塞上传
 *
 * TODO: 迁移至 security.mediaCheckAsync (v2)
 *   mediaCheckAsync 为异步接口，调用时需提供可公网访问的图片 URL、返回 trace_id，
 *   检测结果通过消息推送回调异步送达（5-30s）。迁移步骤：
 *   1. MP 后台配置消息推送 URL（接收 wxa_media_check 事件）
 *   2. 上传图片到云存储 → 获取临时 URL → 调用 mediaCheckAsync → 存储 trace_id
 *   3. 推送回调中匹配 trace_id，若 suggest=risky 则删除云存储文件并标记 dish
 *
 * @param {Object} media - { contentType: string, value: string (base64) }
 */
async function handleImageCheck(event) {
  const { media } = event;

  if (!media || !media.contentType || !media.value) {
    return { pass: false, reason: "图片数据缺失" };
  }

  // Reconstruct Buffer from base64-encoded string passed by the client
  let buffer;
  try {
    buffer = Buffer.from(media.value, "base64");
  } catch (err) {
    console.error("[content-security] base64 decode failed", err);
    return { pass: false, reason: "图片解码失败" };
  }

  try {
    await cloud.openapi.security.imgSecCheck({
      media: {
        contentType: media.contentType,
        value: buffer,
      },
    });
    return { pass: true };
  } catch (err) {
    // errCode 87014 = risky content — still block
    if (err.errCode === config.ERR_CODE_RISKY) {
      return { pass: false, reason: "图片包含违规内容" };
    }
    // Other errors: deprecated API is broken / permission revoked / etc.
    // FALLTHROUGH: return pass=true so uploads aren't blocked by API outage.
    // TODO: once mediaCheckAsync is in place, remove this fallback.
    console.warn(
      "[content-security] imgSecCheck unavailable (deprecated API), allowing upload. err:",
      JSON.stringify({ errCode: err.errCode, errMsg: err.errMsg }),
    );
    return { pass: true, degraded: true };
  }
}

/**
 * 图片内容安全检测 (v2 — mediaCheckAsync)
 *
 * 接收已上传到云存储的 cloudFileID，获取临时下载 URL 后调用
 * security.mediaCheckAsync 异步送审。结果通过消息推送回调送达
 * content-security-callback 云函数处理。
 *
 * @param {Object} event - { cloudFileID: string }
 */
async function handleImageCheckAsync(event) {
  const db = cloud.database();
  const { cloudFileID } = event;
  const { OPENID } = cloud.getWXContext();

  if (!cloudFileID) {
    return { pass: false, reason: "缺少 cloudFileID" };
  }

  // Get temp download URL for the cloud file
  let tempUrl;
  try {
    const urlRes = await cloud.getTempFileURL({ fileList: [cloudFileID] });
    tempUrl = urlRes.fileList[0]?.tempFileURL;
    if (!tempUrl) {
      return { pass: false, reason: "获取图片URL失败" };
    }
  } catch (err) {
    console.error("[content-security] getTempFileURL failed", err);
    return { pass: false, reason: "获取图片URL失败" };
  }

  // Call mediaCheckAsync
  let traceId;
  try {
    const result = await cloud.openapi.security.mediaCheckAsync({
      media_url: tempUrl,
      media_type: config.MEDIA_TYPE_IMAGE,  // 2 = image
      version: config.VERSION_MEDIA_CHECK,     // v2 API
      scene: config.SCENE_MEDIA_CHECK,       // 1 = profile/content
      openid: OPENID,
    });
    traceId = result.trace_id;
    if (!traceId) {
      return { pass: false, reason: "审核提交失败" };
    }
  } catch (err) {
    console.error("[content-security] mediaCheckAsync failed", err);
    return { pass: false, reason: "审核提交失败" };
  }

  // Store check record for callback matching
  try {
    await db.collection(config.COLLECTION_CONTENT_CHECKS).add({
      data: {
        trace_id: traceId,
        cloudFileID,
        status: config.STATUS_PENDING,
        createdAt: db.serverDate(),
      },
    });
  } catch (err) {
    console.error("[content-security] failed to store check record", err);
    // Non-blocking — callback will just have an orphan trace_id
  }

  return { pass: true, trace_id: traceId };
}

exports.main = async (event, context) => {
  const { action } = event;
  const { OPENID } = cloud.getWXContext();

  try {
    switch (action) {
      case "textCheck":
        return await handleTextCheck(event, OPENID);
      case "imageCheck":
        return await handleImageCheck(event);
      case "imageCheckAsync":
        return await handleImageCheckAsync(event);
      default:
        return { pass: false, reason: "无效操作" };
    }
  } catch (err) {
    console.error("[content-security] unhandled error", err);
    return { pass: false, reason: "安全检测服务异常" };
  }
};
