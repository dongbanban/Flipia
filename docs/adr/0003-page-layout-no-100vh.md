# ADR-0003: 页面布局禁止使用 `100vh`

**Status:** accepted

## Context

WeChat 小程序中 CSS 单位 `100vh` 等于设备屏幕的完整高度（含状态栏、导航栏、TabBar），而小程序的 `page` 元素高度（即页面内容可视区域）实际为 `windowHeight` = `screenHeight - statusBarHeight - navBarHeight - tabBarHeight（仅 Tab 页）`。

所有页面曾统一使用 `min-height: 100vh` 作为 `.page` 容器的最小高度，导致：
- Tab 页面内容区域始终比可视区高出一截（约 statusBar + navBar + tabBar 的高度），内容底部被系统 TabBar 遮挡
- 带有 `group-switcher` 组件的页面，`.page` 在 `group-switcher`（88rpx）下发正常流排列，叠加 `100vh` 后总高度进一步超出
- 大屏机型（iPhone 12 Pro）上溢出比例较小不易察觉，切换至小屏低分辨率机型时底部截断问题显著

## Decision

所有页面的 `.page` 根容器统一使用 **绝对定位** 替代 `100vh`：

| 页面类型 | CSS 模式 |
|---|---|
| 有 `group-switcher` + Tab 页 | `position: absolute; top: 88rpx; left: 0; right: 0; bottom: 0;` |
| 无 `group-switcher` 的普通页 | `position: absolute; top: 0; left: 0; right: 0; bottom: 0;` |

同时 `.page` 添加 `overflow-y: auto` 以接管原页面级滚动行为（因为绝对定位后 `page` 元素无正常流内容可滚动）。

`.page` 内部的 `min-height: 100vh`（如 `.loading-state`、`.empty-state` 等占位元素）改为 `min-height: 100%`，使其相对已定高的 `.page` 容器计算。

## Considered Options

- **`calc(100vh - 88rpx)`** — 仅减掉了 `group-switcher`，仍无法消除 statusBar + navBar + tabBar 的跨机型差异，且 CSS `calc()` 不支持 `rpx` 与 `vh` 的精确换算
- **`wx.getSystemInfoSync().windowHeight` + inline style** — 每个页面需额外在 JS 中获取并传递高度，增加样板代码且无法在纯 CSS 中复用
- **`dvh` / `svh` 动态视口单位** — 小程序 CSS 不支持

## Consequences

- 所有页面的 `.page` 容器统一为绝对定位布局，不再依赖视口单位
- 页面不再因 `100vh` 产生额外可滚动空间，内容高度精准匹配可视区域
- 后续新增页面 MUST 遵循此模式，禁止在 `.wxss` 中出现 `100vh`
- `group-switcher` 组件显式设定 `flex-shrink: 0`，配合父容器 flex 布局时不收缩
