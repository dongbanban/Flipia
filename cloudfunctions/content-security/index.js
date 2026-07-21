const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// URL regex — matches http/https/ftp links in text
const URL_REGEX = /https?:\/\/[^\s]+|ftp:\/\/[^\s]+/gi;

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
      scene: 2,
      version: 2,
      content,
    });

    if (result.result && result.result.suggest === "risky") {
      return { pass: false, reason: "文本包含违规内容" };
    }
  } catch (err) {
    // errCode 87014 = risky content (inherited from v1 behavior, v2 may also throw)
    if (err.errCode === 87014) {
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
 * TECH DEBT: 使用已废弃的 security.imgSecCheck (2021年9月标记废弃)。
 * 微信官方推荐 mediaCheckAsync，但后者为异步接口，需要配套的轮询/回调机制。
 * 当前 Flipia 为工具型小程序，同步返回结果更符合 checkImage 的语义。
 * 后续可考虑迁移至 mediaCheckAsync，并在客户端增加 loading 状态。
 *
 * @param {Object} media - { contentType: string, value: Buffer }
 */
async function handleImageCheck(event) {
  const { media } = event;

  if (!media || !media.contentType || !media.value) {
    return { pass: false, reason: "图片数据缺失" };
  }

  // Reconstruct Buffer from base64-encoded string passed by the client
  const buffer = Buffer.from(media.value, "base64");

  try {
    await cloud.openapi.security.imgSecCheck({
      media: {
        contentType: media.contentType,
        value: buffer,
      },
    });
    return { pass: true };
  } catch (err) {
    if (err.errCode === 87014) {
      return { pass: false, reason: "图片包含违规内容" };
    }
    console.error("[content-security] imgSecCheck error", err);
    return { pass: false, reason: "图片安全检测失败" };
  }
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
      default:
        return { pass: false, reason: "无效操作" };
    }
  } catch (err) {
    console.error("[content-security] unhandled error", err);
    return { pass: false, reason: "安全检测服务异常" };
  }
};
