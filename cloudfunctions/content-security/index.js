const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const config = require("./config");

// URL 正则 — 匹配文本中的 http/https/ftp 链接
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

  // 步骤 1：msgSecCheck v2
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
    // errCode 87014 = 违规内容（继承自 v1 行为，v2 也可能抛出）
    if (err.errCode === config.ERR_CODE_RISKY) {
      return { pass: false, reason: "文本包含违规内容" };
    }
    // 其他错误（网络、鉴权、频率限制）— 失败即拦截
    console.error("[content-security] msgSecCheck error", err);
    return { pass: false, reason: "文本安全检测失败" };
  }

  // 步骤 2：URL 过滤器
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

  // 从客户端传入的 base64 编码字符串重建 Buffer
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
    // errCode 87014 = 违规内容 — 仍然拦截
    if (err.errCode === config.ERR_CODE_RISKY) {
      return { pass: false, reason: "图片包含违规内容" };
    }
    // 其他错误：已废弃 API 不可用 / 权限被回收 / 等
    // FALLTHROUGH: 返回 pass=true，避免 API 故障阻塞上传
    // TODO: 一旦 mediaCheckAsync 就位，移除此兜底逻辑
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

  // 获取云文件的临时下载 URL
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

  // 调用 mediaCheckAsync
  let traceId;
  try {
    const result = await cloud.openapi.security.mediaCheckAsync({
      media_url: tempUrl,
      media_type: config.MEDIA_TYPE_IMAGE,  // 2 = 图片
      version: config.VERSION_MEDIA_CHECK,     // v2 接口
      scene: config.SCENE_MEDIA_CHECK,       // 1 = 资料/内容
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

  // 存储检测记录，用于回调匹配
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
    // 非阻塞 — 回调只会收到一个孤立的 trace_id
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
