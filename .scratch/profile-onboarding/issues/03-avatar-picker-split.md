# 03 — 头像获取双通道分流

Status: resolved

## 需求

- 「使用微信信息」按钮：弹出微信头像选择器，不需要相册/拍照入口
- 头像圆圈（上方 avatar 区域）：点击弹出拍照/相册选取，用于自定义头像

## 实现

由于 WeChat `open-type="chooseAvatar"` 唤起的系统 UI 不可定制（底部始终有相册/拍照入口），做以下分流：

| 触发点 | 方法 | 效果 |
|--------|------|------|
| 「使用微信信息」按钮 | `open-type="chooseAvatar"` | WeChat 原生头像选择器（含微信头像库 + 底部相册/拍照 — 不可移除） |
| 头像圆圈 | `bindtap="onTapAvatarDisplay"` → `wx.chooseImage({ sourceType: ['album', 'camera'] })` | 仅拍照/相册，不含微信头像 |

### 新增代码

`onTapAvatarDisplay` 方法：
```ts
wx.chooseImage({
  count: 1,
  sizeType: ["compressed"],
  sourceType: ["album", "camera"],
  success: (res) => {
    const avatarUrl = res.tempFilePaths[0];
    if (avatarUrl) {
      this.setData({ avatarUrl, hasNewAvatar: true });
    }
  },
});
```

## 已知限制

`open-type="chooseAvatar"` 的系统 UI 底部始终包含「从手机相册选择」和「拍照」选项。WeChat 不提供仅展示微信头像的 picker 模式。用户在使用微信信息流程中自然会点击上方微信头像区域，下方入口不干扰核心操作。

## Comments
