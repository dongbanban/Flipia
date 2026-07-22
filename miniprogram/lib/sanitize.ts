import { checkTextWithToast } from "./content-security";

export interface SanitizeResult {
  valid: boolean;
  value: string;
}

export interface SanitizeOptions {
  value: string;
  maxLength: number;
  fieldName: string;
  showToast?: boolean;
}

/**
 * 校验并过滤用户文本输入：
 * 1. 去除首尾空白
 * 2. 检查非空
 * 3. 检查最大长度
 * 4. 通过 checkTextWithToast 进行内容安全检测
 *
 * 返回 { valid, value }。若无效，内部会显示 toast（除非 showToast=false）。
 */
export async function sanitizeInput(options: SanitizeOptions): Promise<SanitizeResult> {
  const { value, maxLength, fieldName, showToast = true } = options;
  const trimmed = value.trim();

  if (!trimmed) {
    if (showToast) {
      wx.showToast({ title: `请输入${fieldName}`, icon: "none" });
    }
    return { valid: false, value: trimmed };
  }

  if (trimmed.length > maxLength) {
    if (showToast) {
      wx.showToast({ title: `${fieldName}最多${maxLength}字`, icon: "none" });
    }
    return { valid: false, value: trimmed };
  }

  if (!(await checkTextWithToast(trimmed))) {
    return { valid: false, value: trimmed };
  }

  return { valid: true, value: trimmed };
}
