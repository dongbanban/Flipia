const cloud = require("wx-server-sdk");
const crypto = require("crypto");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// ---------------------------------------------------------------------------
// Configuration — set these as CloudBase environment variables after
// configuring message push in MP Admin Panel (开发 → 开发设置 → 消息推送)
// ---------------------------------------------------------------------------
const TOKEN = process.env.WX_MSG_TOKEN || "";
const ENCODING_AES_KEY = process.env.WX_MSG_ENCODING_AES_KEY || ""; // 43 chars

// ---------------------------------------------------------------------------
// WeChat message decryption (JSON format, AES-256-CBC)
// ---------------------------------------------------------------------------

/**
 * Decode the 43-char base64 EncodingAESKey into a 32-byte Buffer.
 * WeChat uses an alternate base64 encoding without trailing '=' padding.
 */
function decodeAESKey(b64Key) {
  return Buffer.from(b64Key + "=", "base64"); // → 32 bytes
}

/**
 * PKCS7 unpadding.
 */
function pkcs7Unpad(buf) {
  const pad = buf[buf.length - 1];
  if (pad < 1 || pad > 32) return buf;
  return buf.slice(0, buf.length - pad);
}

/**
 * Decrypt a WeChat-encrypted payload, returning the raw plaintext (string).
 * Caller decides whether to JSON.parse.
 * @param {string} encrypted - Base64-encoded ciphertext
 * @returns {string} Decrypted plaintext
 */
function decryptRaw(encrypted) {
  const aesKey = decodeAESKey(ENCODING_AES_KEY);
  const iv = aesKey.slice(0, 16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  decipher.setAutoPadding(false);

  const cipherBuf = Buffer.from(encrypted, "base64");
  let decrypted = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
  decrypted = pkcs7Unpad(decrypted);

  // decrypted layout: random(16) + msgLen(4 BE) + msg + appId
  const msgLen = decrypted.readUInt32BE(16);
  const msgBuf = decrypted.slice(20, 20 + msgLen);
  return msgBuf.toString("utf8");
}

/**
 * Decrypt and JSON.parse a WeChat-encrypted JSON message.
 */
function decryptJSON(encrypted) {
  return JSON.parse(decryptRaw(encrypted));
}

/**
 * Verify WeChat signature: SHA1(sort([token, timestamp, nonce, ...args]).join(''))
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
// Business logic: process a wxa_media_check result
// ---------------------------------------------------------------------------

/**
 * When a media check result comes back as "risky":
 * 1. Delete the offending cloud file
 * 2. Remove its fileID from any dish or draw_history record that references it
 */
async function handleRiskyImage(cloudFileID) {
  console.warn("[callback] risky image detected, cleaning up:", cloudFileID);

  // 1. Delete cloud file
  try {
    await cloud.deleteFile({ fileList: [cloudFileID] });
    console.log("[callback] deleted cloud file:", cloudFileID);
  } catch (err) {
    console.error("[callback] failed to delete file:", cloudFileID, err);
  }

  // 2. Remove reference from dishes collection
  try {
    const dishRes = await db.collection("dishes")
      .where({ imageUrl: cloudFileID })
      .get();
    for (const dish of dishRes.data) {
      await db.collection("dishes").doc(dish._id).update({
        data: { imageUrl: "", updatedAt: db.serverDate() },
      });
      console.log("[callback] cleared image from dish:", dish._id);
    }
  } catch (err) {
    console.error("[callback] failed to clean dish records:", err);
  }

  // 3. Remove reference from draw_history records (images array)
  try {
    // WeChat cloud DB doesn't support array-contains on cloud.Database.RegExp
    // efficiently, so we fetch recent records and filter in code.
    const historyRes = await db.collection("draw_history")
      .where({
        images: db.command.all([cloudFileID]), // won't work perfectly, but as a rough filter
      })
      .limit(100)
      .get();
    for (const record of historyRes.data) {
      const filtered = (record.images || []).filter((id) => id !== cloudFileID);
      if (filtered.length !== (record.images || []).length) {
        await db.collection("draw_history").doc(record._id).update({
          data: { images: filtered },
        });
        console.log("[callback] removed image from history:", record._id);
      }
    }
  } catch (err) {
    console.error("[callback] failed to clean history records:", err);
  }
}

/**
 * Process the decrypted wxa_media_check event payload.
 */
async function processMediaCheckEvent(payload) {
  const { trace_id, result, detail, errcode } = payload;

  console.log("[callback] media check result:", JSON.stringify({ trace_id, result, errcode }));

  // Find the check record
  let checkRecord;
  try {
    const checkRes = await db.collection("content_checks")
      .where({ trace_id })
      .limit(1)
      .get();
    checkRecord = checkRes.data[0];
  } catch (err) {
    console.error("[callback] failed to find check record:", err);
    return;
  }

  if (!checkRecord || !checkRecord.cloudFileID) {
    console.warn("[callback] unknown trace_id, skipping:", trace_id);
    return;
  }

  const { cloudFileID, _id: recordId } = checkRecord;

  // Update check record status
  const status = result?.suggest === "risky" ? "risky" : "pass";
  try {
    await db.collection("content_checks").doc(recordId).update({
      data: {
        status,
        suggest: result?.suggest,
        label: result?.label,
        resultDetail: detail,
        resolvedAt: db.serverDate(),
      },
    });
  } catch (err) {
    console.error("[callback] failed to update check record:", err);
  }

  // If risky, clean up the image
  if (result?.suggest === "risky") {
    await handleRiskyImage(cloudFileID);
  }
}

// ---------------------------------------------------------------------------
// HTTP entry point (CloudBase HTTP cloud function)
// ---------------------------------------------------------------------------

exports.main = async (event, context) => {
  // CloudBase HTTP access service can deliver query params in several formats.
  // Normalize to a flat object.
  let query = event.queryStringParameters || event.queryString || event.query || {};
  if (typeof query === "string") {
    // manual query string parse (compatible with older Node.js)
    query = Object.fromEntries(
      query.split("&").map((p) => {
        const eq = p.indexOf("=");
        return eq === -1 ? [p, ""] : [p.slice(0, eq), decodeURIComponent(p.slice(eq + 1))];
      }),
    );
  }

  const httpMethod = (event.httpMethod || event.method || "GET").toUpperCase();
  const body = event.body;

  // Dump full event for diagnosis (keys only, values truncated)
  const eventDump = {
    httpMethod,
    hasBody: !!body,
    queryKeys: Object.keys(query),
    querySnippet: JSON.stringify(query).slice(0, 300),
    hasToken: !!TOKEN,
    hasAESKey: !!ENCODING_AES_KEY,
  };
  console.log("[callback] request dump:", JSON.stringify(eventDump));

  // ---- GET: diagnostic / health check (no echostr = browser test) ----
  if (httpMethod === "GET" && !query.echostr) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain" },
      body: `OK — content-security-callback is alive. Token=${!!TOKEN} AESKey=${!!ENCODING_AES_KEY} QueryKeys=${Object.keys(query).join(",") || "none"}`,
    };
  }

  // ---- GET: URL verification ----
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
      // Try to decrypt — echostr may be encrypted (base64) or plaintext (numeric string).
      // If it looks like plaintext, return it as-is.
      let echostrPlain;
      if (/^[0-9]+$/.test(echostr)) {
        // Plaintext echostr (no encryption) — return directly
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

  // ---- POST: message push ----
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

    // Verify msg_signature if available
    const { msg_signature, signature, timestamp, nonce } = query;
    const sig = msg_signature || signature;
    if (sig && TOKEN) {
      if (!verifySignature(sig, timestamp, nonce, parsed.Encrypt || "")) {
        console.error("[callback] msg signature verification failed");
        return { statusCode: 403, body: "signature failed" };
      }
    }

    // Decrypt
    if (!parsed.Encrypt) {
      console.warn("[callback] no Encrypt field in body, treating as plain JSON");
      // Some configurations may send plain JSON — handle wxa_media_check directly
      if (parsed.Event === "wxa_media_check" || parsed.MsgType === "event") {
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

    console.log("[callback] decrypted event:", JSON.stringify(decrypted).slice(0, 300));

    // Route by event type
    if (decrypted.Event === "wxa_media_check" || decrypted.MsgType === "event") {
      await processMediaCheckEvent(decrypted);
    }

    // Always respond "success" within 5s to prevent WeChat from retrying
    return { statusCode: 200, headers: { "Content-Type": "text/plain" }, body: "success" };
  }

  return { statusCode: 405, body: "method not allowed" };
};
