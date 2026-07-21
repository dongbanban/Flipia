# 01 — 项目脚手架

**What to build:** 初始化原生微信小程序 TypeScript 项目，接入微信云开发环境，搭建 4-tab 导航壳，建立全局主题色与基础样式规范。完成后开发者可在微信开发者工具中运行项目、看到 4 个 tab 页面的占位内容，云开发 SDK 初始化无报错。

**Blocked by:** None — can start immediately

**Status:** done

- [x] 使用微信开发者工具创建 TypeScript 小程序项目，启用云开发
- [x] 配置 4 个 tab（首页 / 菜品池 / 历史 / 我的），各 tab 对应独立页面，内容为占位符
- [x] 云开发 SDK 在 `app.ts` 中完成初始化，控制台无错误
- [x] 建立全局 CSS 变量或 WXSS 变量：背景白底、强调色柔和淡绿（如 `#6DBF8A`）、辅助文字灰、圆角、间距等基础 token；tabBar selectedColor 同步使用强调色
- [x] 项目可在微信开发者工具中编译并预览
- [x] 预留群组切换器导航栏占位：4 个 tab 页面顶部注入统一导航栏区域（显示群组名 + 点击切换入口），详见下方「群组切换器导航栏占位」

## Comments

- **Supplements** — 补充了票中缺失的 `components/group-switcher/` 四件套、`services/` 空目录占位、4 个 tab 页面的 group-switcher 引入和 `onSwitchGroup` 桩函数。

## Implementation Notes

### 目录结构

```
project/
├── miniprogram/
│   ├── app.ts
│   ├── app.json
│   ├── app.wxss
│   ├── pages/
│   │   ├── index/          # 首页（抽菜）
│   │   ├── dish-pool/      # 菜品池
│   │   ├── history/        # 历史
│   │   └── mine/           # 我的
│   ├── components/
│   │   └── group-switcher/   # 顶部群组切换器（本票建壳，实际交互在 12 实现）
│   ├── lib/
│   │   └── draw-engine.ts  # 抽取引擎纯函数（本票留空文件占位）
│   ├── services/           # 云 DB 读写封装（本票留空）
│   └── styles/
│       └── variables.wxss  # 全局 CSS token
├── cloudfunctions/
│   └── login/              # 获取 openid 云函数
└── tests/                  # Vitest 单元测试目录（本票建空目录）
```

### 全局 CSS token（`styles/variables.wxss`）

```css
page {
  --color-primary: #6dbf8a; /* 柔和淡绿，强调色 */
  --color-primary-light: #e8f5ee; /* 淡绿背景层 */
  --color-bg: #ffffff;
  --color-bg-secondary: #f6faf7; /* 极淡绿白底 */
  --color-text: #1a1a1a;
  --color-text-secondary: #888888;
  --color-disabled: #c8c8c8;
  --radius-card: 16rpx;
  --radius-btn: 48rpx;
  --spacing-md: 24rpx;
  --spacing-lg: 40rpx;
}
```

### `app.json` tab 骨架

```json
{
  "pages": [
    "pages/index/index",
    "pages/dish-pool/index",
    "pages/history/index",
    "pages/mine/index"
  ],
  "tabBar": {
    "color": "#888888",
    "selectedColor": "#6DBF8A",
    "list": [
      { "pagePath": "pages/index/index", "text": "首页" },
      { "pagePath": "pages/dish-pool/index", "text": "菜品池" },
      { "pagePath": "pages/history/index", "text": "历史" },
      { "pagePath": "pages/mine/index", "text": "我的" }
    ]
  },
  "cloud": true
}
```

### 云函数 `login`（获取 openid）

```ts
// cloudfunctions/login/index.ts
import cloud from "wx-server-sdk";
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

export const main = async () => {
  const { OPENID } = cloud.getWXContext();
  return { openid: OPENID };
};
```

### Vitest 配置（用于 Draw Engine 单测，Node 环境）

在项目根目录（miniprogram 同级）新建 `package.json`：

```json
{
  "devDependencies": {
    "vitest": "~2.1.0",
    "typescript": "~5.6.0"
  },
  "scripts": {
    "test": "vitest run"
  }
}
```

`tests/` 目录本票只建空目录，实际测试文件在 ticket 02 中写入。

### 群组切换器导航栏占位

群组模型（ADR-0002）要求在 4 个 tab 页面顶部固定展示当前群组名和切换入口。本票仅搭建壳组件，具体交互和数据在 ticket 12 实现。

**组件 `components/group-switcher/index`：**

```ts
// components/group-switcher/index.ts
Component({
  properties: {
    groupName: { type: String, value: '我的厨房' },  // 当前群组名
    groupCount: { type: Number, value: 1 }           // 用户拥有的群组数，≤1 时不展示切换箭头
  }
});
```

```html
<!-- components/group-switcher/index.wxml -->
<view class="group-switcher">
  <text class="group-name">{{groupName}}</text>
  <text class="switcher-arrow" wx:if="{{groupCount > 1}}">▾</text>
</view>
```

**页面注入方式：每个 tab 页面（index/dish-pool/history/mine）的 wxml 顶部添加：**

```html
<group-switcher group-name="{{currentGroup.name}}" group-count="{{groupCount}}"
                bind:tap="onSwitchGroup" />
<!-- 页面原有内容保留在此线以下 -->
```

**壳组件在本票仅做：**
- 组件文件结构占位（json/js/wxml/wxss 四件套）
- 各 tab 页面 wxml 引入 `<group-switcher>` 并注册到 page json 的 `usingComponents`
- 暂不连接真实数据，写死 `groupName="我的厨房" groupCount="1"`
- 交互埋点（`onSwitchGroup` 空函数 + `bind:tap`），留空待 12 实现
