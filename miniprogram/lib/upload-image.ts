import { validateAndCompressImage, checkImageAsync } from "@/lib/content-security";
import { LIMITS } from "@/config";

export interface UploadImageOptions {
  /** 最多可选择的图片数量（传给 wx.chooseImage count） */
  count: number;
  /** 图片来源：相册、相机 */
  sourceType?: Array<"album" | "camera">;
  /** 上传过程中显示 loading toast */
  showToast?: boolean;
}

/**
 * 完整图片上传流程：
 * 1. wx.chooseImage → 用户选择图片
 * 2. validateAndCompressImage → 格式校验 + 必要时压缩
 * 3. wx.cloud.uploadFile → 上传至云存储
 * 4. checkImageAsync → fire-and-forget 内容安全检测
 *
 * 返回云存储文件 ID 数组。
 */
export async function uploadImages(options: UploadImageOptions): Promise<string[]> {
  const { count, sourceType = ["album", "camera"], showToast = true } = options;

  return new Promise((resolve, reject) => {
    wx.chooseImage({
      count,
      sizeType: ["compressed"],
      sourceType,
      success: async (res) => {
        if (showToast) wx.showLoading({ title: "上传中…", mask: true });
        try {
          const fileIDs: string[] = [];

          for (const tempPath of res.tempFilePaths) {
            // 校验并压缩
            let uploadPath = tempPath;
            try {
              uploadPath = await validateAndCompressImage(tempPath);
            } catch (reason) {
              if (showToast) {
                wx.hideLoading();
                wx.showToast({ title: reason as string || "图片不合规，请更换", icon: "none" });
              }
              continue; // 跳过当前图片，继续处理其他
            }

            // 上传至云存储
            const cloudRes = await wx.cloud.uploadFile({
              cloudPath: `images/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`,
              filePath: uploadPath,
            });

            // Fire-and-forget 内容安全检测
            checkImageAsync(cloudRes.fileID).catch(() => {});

            fileIDs.push(cloudRes.fileID);
          }

          resolve(fileIDs);
        } catch (err) {
          console.error("[uploadImages] failed", err);
          if (showToast) {
            wx.hideLoading();
            wx.showToast({ title: "上传失败，请重试", icon: "none" });
          }
          reject(err);
        } finally {
          if (showToast) wx.hideLoading();
        }
      },
      fail: (err) => {
        if (err.errMsg !== "chooseImage:fail cancel") {
          console.error("[uploadImages] chooseImage failed", err);
          if (showToast) wx.showToast({ title: "选择图片失败", icon: "none" });
        }
        reject(err);
      },
    });
  });
}
