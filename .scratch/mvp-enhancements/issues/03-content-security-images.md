# 03 — Content Security: Image Uploads

**What to build:** 在所有已有图片上传点接入 `lib/content-security.ts` 的 `checkImage` 方法。用户选择图片后、上传到云存储前进行内容安全检测，违规图片被拦截并提示用户更换。

**Blocked by:** 01 — Content Security Service

**Status:** done

- [x] 菜品图片（`dish-pool` 页 `onChooseImages`）：选图后、`_uploadImages` 前调用 `checkImage`，不通过则 toast "图片不合规，请更换"，不上传
- [x] 历史实拍照片（`history` 页 `onRecordChooseImage`）：选图后、`_uploadHistoryImages` 前调用 `checkImage`，不通过则 toast "图片不合规，请更换"，不上传
- [x] `checkImage` 每次只检测单张图片，选多张时逐一检测
- [x] 合规图片正常上传，违规图片被单独拦截（不阻塞同批次其他合规图片上传）

## Comments

### 2026-07-22 — Bug: 拍照上传图片一直提示"图片不合规，请更换"

**根因**：`checkImage` 客户端校验硬限制 `MAX_IMAGE_SIZE = 1MB`，现代手机拍照普遍 2-5MB，直接触发拒绝。同时 dish-pool/history 页面的 toast 吞掉了 `checkImage` 返回的具体 reason，一律显示笼统的"图片不合规"。

**修复**（3 处改动）：

1. `miniprogram/lib/content-security.ts`：新增 `compressIfNeeded()` — 超 1MB 的图片用 `wx.compressImage` 逐级压缩（quality 80→60→40→20），压缩到 ≤1MB 后用压缩版做内容审核。同时细化各失败环节的 reason 文案（"图片格式不支持"/"图片过大，请选择更小的图片"/"无法读取图片信息"/"图片读取失败"）。

2. `miniprogram/pages/dish-pool/index.ts:546`：toast 从固定 `"图片不合规，请更换"` → `result.reason || "图片不合规，请更换"`。

3. `miniprogram/pages/history/index.ts:97`：同上。

### 2026-07-22 — Hotfix: 废弃 API 不可用导致"检测服务异常"

**根因**：`security.imgSecCheck` (v1) 已于 2021 年 9 月废弃，2026 年起陆续出现 "api unauthorized" 拒绝服务。上次修复加入压缩后，图片能通过客户端校验到达云函数，但云函数调用已废弃的 API 时直接抛错，客户端 `wx.cloud.callFunction` catch 返回"检测服务异常"。

**修复**：`cloudfunctions/content-security/index.js` — `handleImageCheck` 增加三级兜底：
- `errCode 87014`（违规内容）→ 仍拦截返回 `{ pass: false, reason: "图片包含违规内容" }`
- 其他 API 错误（权限回收/网络等）→ 兜底放行 `{ pass: true, degraded: true }` + `console.warn`
- Buffer 解码失败 → `{ pass: false, reason: "图片解码失败" }`
- 同时 `config.json` 新增 `security.mediaCheckAsync` 权限声明，代码中标注完整迁移 TODO

**客户端不受影响**：`checkImage` 的 `ContentSecurityResult` 接口仅消费 `pass` / `reason` 字段，新增 `degraded` 字段被忽略，`pass: true` 正常通过。

### 2026-07-22 — Migration: full mediaCheckAsync (v2)

**架构变化**：从同步 `check → upload` 改为 `upload → async check`。

**新增文件**：
- `cloudfunctions/content-security-callback/index.js` — HTTP 云函数，作为微信消息推送回调端点。处理 GET echostr 验证和 POST 加密消息解密。收到 `wxa_media_check` 事件后，根据 `suggest` 字段：`risky` → 删除云存储文件 + 清理 dishes/draw_history 中的引用；`pass` → 更新 `content_checks` 记录状态。
- `cloudfunctions/content-security-callback/package.json` / `config.json`

**修改文件**：
- `cloudfunctions/content-security/index.js` — 新增 `imageCheckAsync` action：接收 cloudFileID → `getTempFileURL` → `mediaCheckAsync` → 存储 trace_id 到 `content_checks` 集合
- `miniprogram/lib/content-security.ts`：
  - 新增 `validateAndCompressImage(tempFilePath)` — 纯客户端校验+压缩，返回最终上传路径
  - 新增 `checkImageAsync(cloudFileID)` — fire-and-forget 异步送审（不阻塞上传流程）
  - `checkImage` 保留为 deprecated wrapper（供头像等同步场景使用）
- `miniprogram/pages/dish-pool/index.ts` — `onChooseImages` 改为：validate+compress → upload → async check
- `miniprogram/pages/history/index.ts` — 同上

**部署依赖（手动步骤）**：
1. MP 管理后台 → 开发 → 开发设置 → 消息推送：配置 URL 为 `https://<env>.service.tcloudbase.com/content-security-callback`，Token 和 EncodingAESKey 填入自定义值
2. CloudBase 控制台 → 云函数 → content-security-callback → 环境变量：设置 `WX_MSG_TOKEN` 和 `WX_MSG_ENCODING_AES_KEY`
3. 在 CloudBase 控制台为 `content-security-callback` 开启 HTTP 访问
