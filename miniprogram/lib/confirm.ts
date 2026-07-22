export interface ConfirmOptions {
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
}

const CONFIRM_COLOR = "#c8815e";

/**
 * Show a confirmation modal with consistent styling.
 * Wraps wx.showModal with preset confirmColor.
 * Returns true if user confirmed.
 */
export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      title: options.title,
      content: options.content,
      confirmText: options.confirmText || "确认",
      cancelText: options.cancelText || "取消",
      confirmColor: CONFIRM_COLOR,
      success: (res) => {
        resolve(res.confirm);
      },
      fail: () => {
        resolve(false);
      },
    });
  });
}
