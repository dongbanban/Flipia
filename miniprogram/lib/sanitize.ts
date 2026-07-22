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
 * Sanitize and validate user text input:
 * 1. Trim whitespace
 * 2. Check non-empty
 * 3. Check maxLength
 * 4. Content-security review via checkTextWithToast
 *
 * Returns { valid, value }. If invalid, shows a toast internally (unless showToast=false).
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
