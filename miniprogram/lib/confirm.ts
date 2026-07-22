export interface ConfirmOptions {
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
}

const CONFIRM_COLOR = "#c8815e";

/**
 * 显示确认弹窗，使用统一样式。
 * 封装 wx.showModal，预设 confirmColor。
 * 用户确认时返回 true。
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
