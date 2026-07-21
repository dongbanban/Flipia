export interface ContentSecurityResult {
  pass: boolean;
  reason?: string;
}

/**
 * 文本内容安全检测
 *
 * 调用云函数 content-security 的 textCheck action，
 * 依次执行微信 msgSecCheck 敏感词检测和自定义 URL 正则过滤。
 *
 * @param text - 待检测文本，空字符串直接返回 { pass: true }
 */
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

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "bmp", "gif"];
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB

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
 * 图片内容安全检测
 *
 * 1) 客户端校验格式（jpg/png/bmp/gif）和大小（≤ 3MB）
 * 2) 读取图片文件为 base64
 * 3) 调用云函数 content-security 的 imageCheck action
 * 4) 云函数调用微信 imgSecCheck 同步返回结果
 *
 * TECH DEBT: 云函数端使用已废弃的 security.imgSecCheck (2021年9月标记废弃)。
 * 微信官方推荐 mediaCheckAsync，但需要异步轮询/回调机制。
 * 后续可考虑迁移，迁移时需在客户端增加 loading 状态。
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
    return { pass: false, reason: "图片格式不支持或过大" };
  }

  // Validate file size
  try {
    const fs = wx.getFileSystemManager();
    const stat = fs.statSync(tempFilePath) as WechatMiniprogram.Stats;
    if (stat.size > MAX_IMAGE_SIZE) {
      return { pass: false, reason: "图片格式不支持或过大" };
    }
  } catch {
    return { pass: false, reason: "图片格式不支持或过大" };
  }

  // Read file as base64 for cloud function transport
  let base64: string;
  try {
    const fs = wx.getFileSystemManager();
    base64 = fs.readFileSync(tempFilePath, "base64") as string;
  } catch {
    return { pass: false, reason: "图片格式不支持或过大" };
  }

  // Call cloud function
  try {
    const res = await wx.cloud.callFunction({
      name: "content-security",
      data: {
        action: "imageCheck",
        media: {
          contentType,
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
