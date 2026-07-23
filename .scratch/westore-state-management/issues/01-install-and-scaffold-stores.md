# 01 — 安装 westore 并创建 Store 骨架

**What to build:** 两个 Store 模块（`UserStore` 和 `GroupStore`）的完整类定义，导出为单例，包含全部 data 字段和方法签名。此时不连接 app，不影响现有页面行为。

**Blocked by:** None — can start immediately

**Status:** done

- [x] `pnpm add westore` 成功（在 `miniprogram/` 目录下执行），依赖写入 `miniprogram/package.json`
- [x] `UserStore` 类，data 字段：`nickName` (string)、`avatarUrl` (string)、`needProfileSetup` (boolean)。方法：`setProfile(nickName, avatarUrl)`、`skipProfileSetup()`
- [x] `GroupStore` 类，data 字段：`groupId` (string)、`groups` (GroupInfo[])、`activeConfigId` (string)、`lastDrawnConfigId` (string)。方法：`switchGroup(groupId)`（含 Storage 持久化）、`setGroups(groups)`、`setActiveConfig(configId)`（含 Storage 持久化）、`setLastDrawnConfig(configId)`（含 Storage 持久化）
- [x] `stores/index.ts` 导出 `userStore` 和 `groupStore` 常量单例
- [x] 现有小程序编译通过（Store 尚未被引用，不产生副作用）

## Comments

`0b0aadf` — 安装 westore，创建 UserStore/GroupStore 骨架及单例导出，TypeScript 编译通过
