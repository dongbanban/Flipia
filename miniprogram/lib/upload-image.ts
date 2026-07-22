import { validateAndCompressImage, checkImageAsync } from "./content-security";
import { LIMITS } from "../config";

export interface UploadImageOptions {
  /** Max number of images to pick (passed to wx.chooseImage count) */
  count: number;
  /** Image source types: album, camera */
  sourceType?: Array<"album" | "camera">;
  /** Show loading toast during upload */
  showToast?: boolean;
}

/**
 * Full image upload pipeline:
 * 1. wx.chooseImage → user picks images
 * 2. validateAndCompressImage → format check + compress if needed
 * 3. wx.cloud.uploadFile → upload to cloud storage
 * 4. checkImageAsync → fire-and-forget content-security review
 *
 * Returns array of cloud file IDs.
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
            // Validate and compress
            let uploadPath = tempPath;
            try {
              uploadPath = await validateAndCompressImage(tempPath);
            } catch (reason) {
              if (showToast) {
                wx.hideLoading();
                wx.showToast({ title: reason as string || "图片不合规，请更换", icon: "none" });
              }
              continue; // skip this image, continue with others
            }

            // Upload to cloud storage
            const cloudRes = await wx.cloud.uploadFile({
              cloudPath: `images/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`,
              filePath: uploadPath,
            });

            // Fire-and-forget content security check
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
