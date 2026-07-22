# ADR-0004: 图片内容审核从 imgSecCheck 迁移至 mediaCheckAsync

**日期:** 2026-07-22  
**状态:** 已实施  
**关联 issue:** `.scratch/mvp-enhancements/issues/03-content-security-images.md`

---

## 背景

Flipia 最初使用微信 `security.imgSecCheck` (v1) 进行图片内容安全检测。该 API 于 **2021 年 9 月被标记废弃**，2026 年起陆续出现以下问题：

1. **1MB 大小限制**：现代手机拍照普遍 2-5MB，直接触发客户端拒绝（"图片不合规，请更换"）
2. **API 逐步关闭**：2026 年 5 月起出现 "api unauthorized" 拒绝服务，云函数调用直接抛错（"检测服务异常"）
3. **检测模型停更**：自 2021 年起模型不再更新，实际检测能力大幅退化

微信官方推荐替代方案为 `security.mediaCheckAsync` (v2)，支持 10MB 图片、异步推送回调（5-30s），且检测模型持续更新。

## 决策

**全链路迁移至 `mediaCheckAsync` (v2)**，架构从同步 `check → upload` 改为异步 `upload → check → callback cleanup`。

### 为什么选择完整迁移而非修补旧接口

| 方案 | 优点 | 缺点 |
|---|---|---|
| 修补 `imgSecCheck` | 改动最小 | API 已不可靠，随时可能完全关闭 |
| 客户端压缩 + 仍用 v1 | 简单 | v1 模型不更新，合规风险 |
| **迁移 `mediaCheckAsync`** ✓ | API 受支持、10MB 上限、检测模型更新 | 需要异步回调基础设施 |

### 为什么不选第三方付费方案（如腾讯云 IMS）

- Flipia 为工具型小程序，图片上传量极小
- 微信官方免费接口足以覆盖合规需求
- 付费方案增加运维成本和依赖

## 架构

### 旧流程（v1 — 同步）

```
选图 → 客户端校验格式+大小(≤1MB) → 读 base64 → 云函数 imgSecCheck → 通过? → 上传云存储
                                                    ↓ 不通过
                                               toast 提示
```

### 新流程（v2 — 异步）

```
选图
  ↓
validateAndCompressImage()     ← 纯客户端：格式校验 + 压缩至 ≤1MB
  ↓
wx.cloud.uploadFile()           ← 直接上传云存储（不阻塞）
  ↓
checkImageAsync(cloudFileID)    ← fire-and-forget 异步送审
  ↓
云函数 imageCheckAsync action
  ├─ getTempFileURL()           ← 获取云存储临时公网链接
  ├─ mediaCheckAsync()          ← 调用微信 v2 API，返回 trace_id
  └─ 写入 content_checks 集合   ← { trace_id, cloudFileID, status: "pending" }
        ↓
  微信服务器异步检测（5-30s）
        ↓
  消息推送 POST 到 content-security-callback HTTP 云函数
        ├─ 解密 wxa_media_check 事件
        ├─ 匹配 trace_id → content_checks 集合
        ├─ suggest: "risky"  → 删除云存储文件 + 清理 dishes/draw_history 引用
        └─ suggest: "pass"   → 更新记录状态为 resolved
```

## 文件变更

### 新增

| 文件 | 说明 |
|---|---|
| `cloudfunctions/content-security-callback/index.js` | HTTP 云函数，接收微信消息推送回调。处理 GET 验证和 POST 解密，收到 `wxa_media_check` 事件后 do cleanup |
| `cloudfunctions/content-security-callback/config.json` | 云函数权限声明 |
| `cloudfunctions/content-security-callback/package.json` | 依赖声明（wx-server-sdk） |

### 修改

| 文件 | 变更要点 |
|---|---|
| `cloudfunctions/content-security/index.js` | 新增 `imageCheckAsync` action：接收 cloudFileID → 获取临时 URL → `mediaCheckAsync` → 存 trace_id |
| `cloudfunctions/content-security/config.json` | 新增 `security.mediaCheckAsync` 云调用权限 |
| `miniprogram/lib/content-security.ts` | 新增 `validateAndCompressImage()`（纯客户端校验+压缩）和 `checkImageAsync()`（fire-and-forget 送审）；`checkImage` 标记 deprecated |
| `miniprogram/pages/dish-pool/index.ts` | `onChooseImages`：validate+compress → upload → async check |
| `miniprogram/pages/history/index.ts` | `onRecordUploadImage`：同上 |
| `.scratch/mvp-enhancements/spec.md` | 更新架构描述、云函数说明、图片检测流程 |
| `.scratch/mvp-enhancements/issues/03-content-security-images.md` | 追加 bug 记录和迁移注释 |

## 涉及的数据库集合

| 集合 | 用途 |
|---|---|
| `content_checks` | 存储异步检测记录：`{ trace_id, cloudFileID, status, suggest, label, createdAt, resolvedAt }` |
| `dishes` | 菜品表（`imageUrl` 字段可能被 callback 清空） |
| `draw_history` | 抽取历史（`images` 数组可能被 callback 移除违规项） |

---

## 部署指南

### 前提条件

- 微信小程序已绑定云开发环境（当前环境 ID: `cloud1-d5gwv3g0da9888b0e`）
- 已开通云调用权限（默认开通）

### 步骤 1：部署云函数

在微信开发者工具中，右键以下两个目录，依次选择 **上传并部署：云端安装依赖**：

1. `cloudfunctions/content-security`
2. `cloudfunctions/content-security-callback`

### 步骤 2：配置 HTTP 触发器（CloudBase 控制台）

1. 打开 CloudBase 控制台：**https://tcb.cloud.tencent.com/dev**
2. 左侧菜单 → **HTTP 网关** → **路由管理**
3. 点击 **新建**：
   - 关联资源：选择云函数 `content-security-callback`
   - 触发路径：`/content-security-callback`
   - 鉴权方式：无需鉴权
4. 确认创建，记录生成的域名（形如 `cloud1-d5gwv3g0da9888b0e-xxxxxxxxx.ap-shanghai.app.tcloudbase.com`）

### 步骤 3：配置环境变量

CloudBase 控制台 → 云函数 → `content-security-callback` → 函数配置 → 环境变量：

| 变量名 | 值 | 说明 |
|---|---|---|
| `WX_MSG_TOKEN` | 与步骤 4 的 Token 相同 | 消息签名验证密钥 |
| `WX_MSG_ENCODING_AES_KEY` | 与步骤 4 的 EncodingAESKey 相同 | 消息加解密密钥（43 位） |

### 步骤 4：配置消息推送（MP 管理后台）

1. 打开 **https://mp.weixin.qq.com/**
2. 左侧菜单 → **开发** → **开发设置**
3. 拉到「消息推送」区域，点击 **启用**：

| 字段 | 值 |
|---|---|
| URL | `https://<步骤2域名>/content-security-callback` |
| Token | 自定义字符串（如 `flipia2026`），需与步骤 3 的 `WX_MSG_TOKEN` 一致 |
| EncodingAESKey | 点击**随机生成**，需与步骤 3 的 `WX_MSG_ENCODING_AES_KEY` 一致 |
| 消息加密方式 | JSON |
| 数据格式 | JSON |

4. 点击提交，应提示配置成功。

### 步骤 5：真机验证

1. 微信开发者工具 → **编译** → **预览/真机调试**
2. 进入菜品池 → 新增/编辑菜品 → 拍照上传
3. 预期：图片直接上传成功，无任何错误提示
4. 5-30 秒后，检查 CloudBase 云函数日志，`content-security-callback` 应收到 `wxa_media_check` 事件

---

## 回调函数的行为

### GET 请求（URL 验证）

```
WeChat 服务器 → GET /content-security-callback?signature=xxx&timestamp=xxx&nonce=xxx&echostr=xxx
```

1. 验证签名：`SHA1(sort([Token, timestamp, nonce])) === signature`
2. 判断 echostr 是明文（纯数字）还是密文（base64），明文直接返回，密文 AES 解密后返回

### POST 请求（消息推送）

```
WeChat 服务器 → POST /content-security-callback
  Body: { "ToUserName": "...", "Encrypt": "<base64 ciphertext>" }
```

1. 验证 msg_signature
2. AES-256-CBC 解密 Encrypt 字段（PKCS7 填充）
3. 解析 `wxa_media_check` 事件
4. 根据 `result.suggest` 执行操作：

| suggest | 操作 |
|---|---|
| `pass` | 更新 `content_checks` 记录状态为 `pass` |
| `risky` | 删除云存储文件 → 清理 `dishes.imageUrl` → 清理 `draw_history.images[]` → 更新记录为 `risky` |
| `review` | 更新记录为 `review`（暂不做自动操作，留待人工审核） |

### 响应时限

必须在 **5 秒内** 返回 `"success"`（`Content-Type: text/plain`），否则微信服务器会重试。

---

## 技术细节

### 加密算法

- **算法**: AES-256-CBC
- **密钥**: EncodingAESKey（43 位 base64，解码后 32 字节）
- **IV**: 密钥的前 16 字节
- **填充**: PKCS7
- **明文格式**: `random(16B) + msgLen(4B BE) + msg + appId`

### mediaCheckAsync 调用参数

```js
cloud.openapi.security.mediaCheckAsync({
  media_url: "https://...",   // 公网可访问的图片 URL（云存储临时链接）
  media_type: 2,              // 2 = 图片
  version: 2,                 // v2 API
  scene: 1,                   // 1 = 资料/内容
  openid: "USER_OPENID",      // 用户须在 2 小时内访问过小程序
})
```

限制：2,000 次/分钟，200,000 次/天

### 临时 URL 时效

`cloud.getTempFileURL()` 返回的链接有效期为 **2 小时**，足够 `mediaCheckAsync` 在 5-30 秒内下载检测。

---

## 待办

- [ ] 违规内容通知用户（模板消息或小程序内通知）
- [ ] `suggest: "review"` 的人工审核流程
- [ ] 头像上传（mine/profile-setup 页）从 deprecated `checkImage` 迁移至 `checkImageAsync`
- [ ] `content_checks` 集合的定期清理（已完成检测的记录）
- [ ] 监控告警：回调函数连续失败时的报警
