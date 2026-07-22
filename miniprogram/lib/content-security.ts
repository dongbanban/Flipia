import { LIMITS } from "../config";

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
// 图片辅助 — 校验、压缩、异步内容检测 (v2)
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
 * 校验图片格式并压缩超大图片。
 * 返回用于上传的临时文件路径（必要时返回压缩后的路径）。
 *
 * @throws {string} 校验或压缩失败时抛出面向用户的错误消息
 */
export async function validateAndCompressImage(
  tempFilePath: string,
): Promise<string> {
  // 校验格式
  const ext = tempFilePath.split(".").pop()?.toLowerCase() || "";
  if (!extToContentType(ext)) {
    throw "图片格式不支持";
  }

  // 检查文件大小
  let size: number;
  try {
    const fs = wx.getFileSystemManager();
    const stat = fs.statSync(tempFilePath) as WechatMiniprogram.Stats;
    size = stat.size;
  } catch {
    throw "无法读取图片信息";
  }

  // 必要时压缩
  if (size <= LIMITS.IMAGE_MAX_SIZE) return tempFilePath;

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
      if (stat.size <= LIMITS.IMAGE_MAX_SIZE) {
        return compressedPath;
      }
    } catch {
      // 尝试下一个压缩质量
    }
  }

  throw "图片过大，请选择更小的图片";
}

/**
 * 对已上传的图片发起异步内容安全检测 (v2)。
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
    // 非阻塞——回调负责处理后续清理
  }
}

/**
 * [已弃用] 通过 imgSecCheck 进行同步图片内容检测 (v1)。
 *
 * 此方法在头像/个人资料等需要同步阻塞的场景下仍可用，
 * 但底层云 API (security.imgSecCheck) 已被弃用，可能返回降级结果。
 * 新的图片上传流程应使用：
 *   1. validateAndCompressImage(tempFilePath) — 客户端校验
 *   2. 上传至云存储
 *   3. checkImageAsync(cloudFileID) — 异步 mediaCheckAsync
 *
 * @param tempFilePath - 微信临时文件路径
 */
export async function checkImage(
  tempFilePath: string,
): Promise<ContentSecurityResult> {
  // 校验格式
  const ext = tempFilePath.split(".").pop()?.toLowerCase() || "";
  const contentType = extToContentType(ext);
  if (!contentType) {
    return { pass: false, reason: "图片格式不支持" };
  }

  // 校验文件大小并在必要时压缩
  let workingPath = tempFilePath;
  let workingContentType = contentType;
  try {
    const fs = wx.getFileSystemManager();
    const stat = fs.statSync(tempFilePath) as WechatMiniprogram.Stats;
    if (stat.size > LIMITS.IMAGE_MAX_SIZE) {
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

  // 读取文件为 base64 以传递给云函数
  let base64: string;
  try {
    const fs = wx.getFileSystemManager();
    base64 = fs.readFileSync(workingPath, "base64") as string;
  } catch {
    return { pass: false, reason: "图片读取失败" };
  }

  // 调用云函数（已弃用的 v1 API——可能返回 degraded:true）
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

// 保留旧的 compressIfNeeded 以兼容 checkImage
async function compressIfNeeded(
  tempFilePath: string,
  originalSize: number,
): Promise<string> {
  if (originalSize <= LIMITS.IMAGE_MAX_SIZE) return tempFilePath;

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
      if (compressedStat.size <= LIMITS.IMAGE_MAX_SIZE) {
        return compressedPath;
      }
    } catch {
      // 尝试下一个压缩质量
    }
  }
  throw new Error("压缩后仍超过大小限制");
}
