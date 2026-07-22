export interface ContentSecurityResult {
  pass: boolean;
  reason?: string;
}

/**
 * 文本安全检测 + toast 提示
 *
 * 调用 checkText，不通过时自动弹出 toast 提示原因。
 * 返回 true 表示通过，false 表示被拦截（已 toast）。
 */
export async function checkTextWithToast(text: string): Promise<boolean> {
  const result = await checkText(text);
  if (!result.pass) {
    const title = result.reason?.includes("链接")
      ? "内容包含链接，请移除后重试"
      : "内容包含敏感信息，请修改后重试";
    wx.showToast({ title, icon: "none" });
    return false;
  }
  return true;
}

/**
 * 文本内容安全检测
 *
 * 调用云函数 content-security 的 textCheck action，
 * 依次执行微信 msgSecCheck 敏感词检测和自定义 URL 正则过滤。
 *
 * @param text - 待检测文本，空字符串直接返回 { pass: true }
 */
export async function checkText(text: string): Promise<ContentSecurityResult> {
  if (!text) return { pass: true };

  try {
    const res = await wx.cloud.callFunction({
      name: "content-security",
      data: { action: "textCheck", content: text },
    });
    return (res.result as ContentSecurityResult) ?? {
      pass: false,
      reason: "检测服务异常",
    };
  } catch {
    return { pass: false, reason: "检测服务异常" };
  }
}

// ---------------------------------------------------------------------------
// Image helpers — validation, compression, async content check (v2)
// ---------------------------------------------------------------------------

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "bmp", "gif"];

function extToContentType(ext: string): string | null {
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "bmp":
      return "image/bmp";
    case "gif":
      return "image/gif";
    default:
      return null;
  }
}

/**
 * Validate format and compress oversized images.
 * Returns the temp file path to use for upload (compressed if needed).
 *
 * @throws {string} user-facing error message on validation/compression failure
 */
export async function validateAndCompressImage(
  tempFilePath: string,
): Promise<string> {
  // Validate format
  const ext = tempFilePath.split(".").pop()?.toLowerCase() || "";
  if (!extToContentType(ext)) {
    throw "图片格式不支持";
  }

  // Check size
  let size: number;
  try {
    const fs = wx.getFileSystemManager();
    const stat = fs.statSync(tempFilePath) as WechatMiniprogram.Stats;
    size = stat.size;
  } catch {
    throw "无法读取图片信息";
  }

  // Compress if needed
  const MAX_SIZE = 1024 * 1024; // 1MB target
  if (size <= MAX_SIZE) return tempFilePath;

  const qualities = [80, 60, 40, 20];
  for (const quality of qualities) {
    try {
      const compressedPath = await new Promise<string>((resolve, reject) => {
        wx.compressImage({
          src: tempFilePath,
          quality,
          success: (res) => resolve(res.tempFilePath),
          fail: reject,
        });
      });
      const fs = wx.getFileSystemManager();
      const stat = fs.statSync(compressedPath) as WechatMiniprogram.Stats;
      if (stat.size <= MAX_SIZE) {
        return compressedPath;
      }
    } catch {
      // try next quality
    }
  }

  throw "图片过大，请选择更小的图片";
}

/**
 * Submit an already-uploaded image for async content security check (v2).
 *
 * This is the mediaCheckAsync path. The image must already be uploaded to
 * cloud storage. Results arrive asynchronously via WeChat message push to
 * the content-security-callback cloud function.
 *
 * This function is fire-and-forget — it always returns { pass: true }.
 * If the mediaCheckAsync submission fails, it logs and swallows the error
 * so upload flow is not blocked.
 *
 * @param cloudFileID - Cloud storage file ID from wx.cloud.uploadFile
 */
export async function checkImageAsync(
  cloudFileID: string,
): Promise<void> {
  try {
    await wx.cloud.callFunction({
      name: "content-security",
      data: {
        action: "imageCheckAsync",
        cloudFileID,
      },
    });
  } catch (err) {
    console.warn("[content-security] imageCheckAsync submit failed", err);
    // Non-blocking — the callback handles cleanup if needed
  }
}

/**
 * [DEPRECATED] Synchronous image content check via imgSecCheck (v1).
 *
 * This function still works for avatar/profile pages that need sync blocking
 * behavior, but the underlying cloud API (security.imgSecCheck) is deprecated
 * and may return degraded results. New image upload flows should use:
 *   1. validateAndCompressImage(tempFilePath) — client-side check
 *   2. upload to cloud storage
 *   3. checkImageAsync(cloudFileID) — async mediaCheckAsync
 *
 * @param tempFilePath - 微信临时文件路径
 */
export async function checkImage(
  tempFilePath: string,
): Promise<ContentSecurityResult> {
  // Validate format
  const ext = tempFilePath.split(".").pop()?.toLowerCase() || "";
  const contentType = extToContentType(ext);
  if (!contentType) {
    return { pass: false, reason: "图片格式不支持" };
  }

  // Validate file size & compress if needed
  let workingPath = tempFilePath;
  let workingContentType = contentType;
  try {
    const fs = wx.getFileSystemManager();
    const stat = fs.statSync(tempFilePath) as WechatMiniprogram.Stats;
    if (stat.size > 1024 * 1024) {
      try {
        workingPath = await compressIfNeeded(tempFilePath, stat.size);
        const compressedExt = workingPath.split(".").pop()?.toLowerCase() || "jpg";
        workingContentType = extToContentType(compressedExt) ?? "image/jpeg";
      } catch {
        return { pass: false, reason: "图片过大，请选择更小的图片" };
      }
    }
  } catch {
    return { pass: false, reason: "无法读取图片信息" };
  }

  // Read file as base64 for cloud function transport
  let base64: string;
  try {
    const fs = wx.getFileSystemManager();
    base64 = fs.readFileSync(workingPath, "base64") as string;
  } catch {
    return { pass: false, reason: "图片读取失败" };
  }

  // Call cloud function (deprecated v1 API — may return degraded:true)
  try {
    const res = await wx.cloud.callFunction({
      name: "content-security",
      data: {
        action: "imageCheck",
        media: {
          contentType: workingContentType,
          value: base64,
        },
      },
    });
    return (res.result as ContentSecurityResult) ?? {
      pass: false,
      reason: "检测服务异常",
    };
  } catch {
    return { pass: false, reason: "检测服务异常" };
  }
}

// Keep the old compressIfNeeded for backward compat with checkImage
const MAX_IMAGE_SIZE = 1024 * 1024;
async function compressIfNeeded(
  tempFilePath: string,
  originalSize: number,
): Promise<string> {
  if (originalSize <= MAX_IMAGE_SIZE) return tempFilePath;

  const qualities = [80, 60, 40, 20];
  for (const quality of qualities) {
    try {
      const compressedPath = await new Promise<string>((resolve, reject) => {
        wx.compressImage({
          src: tempFilePath,
          quality,
          success: (res) => resolve(res.tempFilePath),
          fail: reject,
        });
      });
      const fs = wx.getFileSystemManager();
      const compressedStat = fs.statSync(compressedPath) as WechatMiniprogram.Stats;
      if (compressedStat.size <= MAX_IMAGE_SIZE) {
        return compressedPath;
      }
    } catch {
      // try next quality
    }
  }
  throw new Error("压缩后仍超过大小限制");
}
