const cloud = require("wx-server-sdk");
const crypto = require("crypto");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const config = require("./config");

// ---------------------------------------------------------------------------
// 配置 — 在 MP 管理后台（开发 → 开发设置 → 消息推送）配置消息推送后，
// 将这些设置为 CloudBase 环境变量
// ---------------------------------------------------------------------------
const TOKEN = process.env.WX_MSG_TOKEN || "";
const ENCODING_AES_KEY = process.env.WX_MSG_ENCODING_AES_KEY || ""; // 43 个字符

// ---------------------------------------------------------------------------
// 微信消息解密（JSON 格式，AES-256-CBC）
// ---------------------------------------------------------------------------

/**
 * 将 43 字符的 base64 EncodingAESKey 解码为 32 字节的 Buffer。
 * 微信使用不带尾部 '=' 填充的替代 base64 编码。
 */
function decodeAESKey(b64Key) {
  return Buffer.from(b64Key + "=", "base64"); // → 32 字节
}

/**
 * PKCS7 去填充。
 */
function pkcs7Unpad(buf) {
  const pad = buf[buf.length - 1];
  if (pad < 1 || pad > 32) return buf;
  return buf.slice(0, buf.length - pad);
}

/**
 * 解密微信加密的负载，返回原始明文（字符串）。
 * 由调用方决定是否 JSON.parse。
 * @param {string} encrypted - Base64 编码的密文
 * @returns {string} 解密后的明文
 */
function decryptRaw(encrypted) {
  const aesKey = decodeAESKey(ENCODING_AES_KEY);
  const iv = aesKey.slice(0, 16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  decipher.setAutoPadding(false);

  const cipherBuf = Buffer.from(encrypted, "base64");
  let decrypted = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
  decrypted = pkcs7Unpad(decrypted);

  // 解密后布局：random(16) + msgLen(4 大端序) + msg + appId
  const msgLen = decrypted.readUInt32BE(16);
  const msgBuf = decrypted.slice(20, 20 + msgLen);
  return msgBuf.toString("utf8");
}

/**
 * 解密并 JSON.parse 微信加密的 JSON 消息。
 */
function decryptJSON(encrypted) {
  return JSON.parse(decryptRaw(encrypted));
}

/**
 * 验证微信签名：SHA1(sort([token, timestamp, nonce, ...args]).join(''))
 */
function verifySignature(signature, timestamp, nonce, ...args) {
  const sorted = [TOKEN, timestamp, nonce, ...args].sort().join("");
  const hash = crypto.createHash("sha1").update(sorted, "utf8").digest("hex");
  console.log("[callback] sig check:", JSON.stringify({
    expected: signature,
    computed: hash,
    tokenLen: TOKEN.length,
    sorted: [TOKEN, timestamp, nonce, ...args].sort(),
  }));
  return hash === signature;
}

// ---------------------------------------------------------------------------
// 业务逻辑：处理 wxa_media_check 结果
// ---------------------------------------------------------------------------

/**
 * 当媒体检测结果返回 "risky" 时：
 * 1. 删除违规云文件
 * 2. 从引用该文件的所有 dish 或 draw_history 记录中移除其 fileID
 */
async function handleRiskyImage(cloudFileID) {
  console.warn("[callback] risky image detected, cleaning up:", cloudFileID);

  // 1. 删除云文件
  try {
    await cloud.deleteFile({ fileList: [cloudFileID] });
    console.log("[callback] deleted cloud file:", cloudFileID);
  } catch (err) {
    console.error("[callback] failed to delete file:", cloudFileID, err);
  }

  // 2. 从 dishes 集合中移除引用
  try {
    const dishRes = await db.collection(config.COLLECTION_DISHES)
      .where({ [config.FIELD_IMAGE_URL]: cloudFileID })
      .get();
    for (const dish of dishRes.data) {
      await db.collection(config.COLLECTION_DISHES).doc(dish._id).update({
        data: { [config.FIELD_IMAGE_URL]: "", [config.FIELD_UPDATED_AT]: db.serverDate() },
      });
      console.log("[callback] cleared image from dish:", dish._id);
    }
  } catch (err) {
    console.error("[callback] failed to clean dish records:", err);
  }

  // 3. 从 draw_history 记录中移除引用（images 数组）
  try {
    // 微信云数据库不支持对 cloud.Database.RegExp 进行 array-contains 高效查询，
    // 所以获取最近记录并在代码中过滤。
    const historyRes = await db.collection(config.COLLECTION_DRAW_HISTORY)
      .where({
        [config.FIELD_IMAGES]: db.command.all([cloudFileID]), // 不完全精确，但作为粗略过滤
      })
      .limit(config.QUERY_LIMIT_HISTORY)
      .get();
    for (const record of historyRes.data) {
      const filtered = (record[config.FIELD_IMAGES] || []).filter((id) => id !== cloudFileID);
      if (filtered.length !== (record[config.FIELD_IMAGES] || []).length) {
        await db.collection(config.COLLECTION_DRAW_HISTORY).doc(record._id).update({
          data: { [config.FIELD_IMAGES]: filtered },
        });
        console.log("[callback] removed image from history:", record._id);
      }
    }
  } catch (err) {
    console.error("[callback] failed to clean history records:", err);
  }
}

/**
 * 处理解密后的 wxa_media_check 事件负载。
 */
async function processMediaCheckEvent(payload) {
  const { trace_id, result, detail, errcode } = payload;

  console.log("[callback] media check result:", JSON.stringify({ trace_id, result, errcode }));

  // 查找检测记录
  let checkRecord;
  try {
    const checkRes = await db.collection(config.COLLECTION_CONTENT_CHECKS)
      .where({ [config.FIELD_TRACE_ID]: trace_id })
      .limit(config.QUERY_LIMIT_SINGLE)
      .get();
    checkRecord = checkRes.data[0];
  } catch (err) {
    console.error("[callback] failed to find check record:", err);
    return;
  }

  if (!checkRecord || !checkRecord[config.FIELD_CLOUD_FILE_ID]) {
    console.warn("[callback] unknown trace_id, skipping:", trace_id);
    return;
  }

  const { cloudFileID, _id: recordId } = checkRecord;

  // 更新检测记录状态
  const status = result?.suggest === config.STATUS_RISKY ? config.STATUS_RISKY : config.STATUS_PASS;
  try {
    await db.collection(config.COLLECTION_CONTENT_CHECKS).doc(recordId).update({
      data: {
        [config.FIELD_STATUS]: status,
        [config.FIELD_SUGGEST]: result?.suggest,
        [config.FIELD_LABEL]: result?.label,
        [config.FIELD_RESULT_DETAIL]: detail,
        [config.FIELD_RESOLVED_AT]: db.serverDate(),
      },
    });
  } catch (err) {
    console.error("[callback] failed to update check record:", err);
  }

  // 若违规，清理图片
  if (result?.suggest === config.STATUS_RISKY) {
    await handleRiskyImage(cloudFileID);
  }
}

// ---------------------------------------------------------------------------
// HTTP 入口（CloudBase HTTP 云函数）
// ---------------------------------------------------------------------------

exports.main = async (event, context) => {
  // CloudBase HTTP 访问服务可能以多种格式传递查询参数。
  // 统一规范化为扁平对象。
  let query = event.queryStringParameters || event.queryString || event.query || {};
  if (typeof query === "string") {
    // 手动查询字符串解析（兼容旧版 Node.js）
    query = Object.fromEntries(
      query.split("&").map((p) => {
        const eq = p.indexOf("=");
        return eq === -1 ? [p, ""] : [p.slice(0, eq), decodeURIComponent(p.slice(eq + 1))];
      }),
    );
  }

  const httpMethod = (event.httpMethod || event.method || "GET").toUpperCase();
  const body = event.body;

  // 输出完整事件用于诊断（仅键名，值被截断）
  const eventDump = {
    httpMethod,
    hasBody: !!body,
    queryKeys: Object.keys(query),
    querySnippet: JSON.stringify(query).slice(0, config.LOG_TRUNCATE),
    hasToken: !!TOKEN,
    hasAESKey: !!ENCODING_AES_KEY,
  };
  console.log("[callback] request dump:", JSON.stringify(eventDump));

  // ---- GET：诊断/健康检查（无 echostr = 浏览器测试）----
  if (httpMethod === "GET" && !query.echostr) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain" },
      body: `OK — content-security-callback is alive. Token=${!!TOKEN} AESKey=${!!ENCODING_AES_KEY} QueryKeys=${Object.keys(query).join(",") || "none"}`,
    };
  }

  // ---- GET：URL 验证 ----
  if (httpMethod === "GET") {
    const sig = query.msg_signature || query.signature;
    const { timestamp, nonce, echostr } = query;
    if (!TOKEN || !ENCODING_AES_KEY) {
      console.error("[callback] WX_MSG_TOKEN or WX_MSG_ENCODING_AES_KEY not configured");
      return { statusCode: 500, body: "not configured" };
    }
    if (!sig || !verifySignature(sig, timestamp, nonce /* echostr NOT included */)) {
      console.error("[callback] signature verification failed", { sig, timestamp, nonce });
      return { statusCode: 403, body: "signature failed" };
    }
    try {
      // 尝试解密 — echostr 可能是加密的（base64）或是明文（数字字符串）。
      // 如果看起来是明文，直接返回。
      let echostrPlain;
      if (/^[0-9]+$/.test(echostr)) {
        // 明文 echostr（未加密）— 直接返回
        echostrPlain = echostr;
      } else {
        echostrPlain = decryptRaw(echostr);
      }
      console.log("[callback] echostr verified OK");
      return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: echostrPlain };
    } catch (err) {
      console.error("[callback] echostr decrypt failed:", err);
      return { statusCode: 500, body: "decrypt failed" };
    }
  }

  // ---- POST：消息推送 ----
  if (httpMethod === "POST") {
    if (!body) {
      return { statusCode: 400, body: "missing body" };
    }

    let parsed;
    try {
      parsed = typeof body === "string" ? JSON.parse(body) : body;
    } catch {
      return { statusCode: 400, body: "invalid json" };
    }

    // 若可用则验证 msg_signature
    const { msg_signature, signature, timestamp, nonce } = query;
    const sig = msg_signature || signature;
    if (sig && TOKEN) {
      if (!verifySignature(sig, timestamp, nonce, parsed.Encrypt || "")) {
        console.error("[callback] msg signature verification failed");
        return { statusCode: 403, body: "signature failed" };
      }
    }

    // 解密
    if (!parsed.Encrypt) {
      console.warn("[callback] no Encrypt field in body, treating as plain JSON");
      // 某些配置可能发送明文 JSON — 直接处理 wxa_media_check
      if (parsed.Event === config.EVENT_WXA_MEDIA_CHECK || parsed.MsgType === config.EVENT_TYPE_EVENT) {
        await processMediaCheckEvent(parsed);
      }
      return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: "success" };
    }

    let decrypted;
    try {
      decrypted = decryptJSON(parsed.Encrypt);
    } catch (err) {
      console.error("[callback] decrypt failed:", err);
      return { statusCode: 500, body: "decrypt failed" };
    }

    console.log("[callback] decrypted event:", JSON.stringify(decrypted).slice(0, config.LOG_TRUNCATE));

    // 按事件类型路由
    if (decrypted.Event === config.EVENT_WXA_MEDIA_CHECK || decrypted.MsgType === config.EVENT_TYPE_EVENT) {
      await processMediaCheckEvent(decrypted);
    }

    // 始终在 5 秒内返回 "success"，防止微信重试
    return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: "success" };
  }

  return { statusCode: 405, body: "method not allowed" };
};
