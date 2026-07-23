# 02 — App 引导层双写 wiring

**What to build:** 修改 `app.ts` 的 `_initApp()`，在现有写入 `globalData` 的同位置同步写入 Store + 调用 `update()`。两个系统并行运行，但页面仍走 `globalData` 读取。此阶段可验证：打印 Store 内容确认双写生效。

**Blocked by:** 01 — 安装 westore 并创建 Store 骨架

**Status:** done

- [x] `app.ts` 引入 `userStore` 和 `groupStore`
- [x] `_ensureUserProfile()` 中，在 `globalData.nickName/avatarUrl/needProfileSetup` 赋值后追加 `userStore.setProfile()` 或 `userStore.skipProfileSetup()`
- [x] `_initApp()` 中群组查询完成后，在 `globalData.groups/groupId` 赋值后追加 `groupStore.setGroups()` 和 `groupStore.switchGroup()`
- [x] 无群组时创建默认群组的分支中，同样追加 `groupStore` 写入
- [x] `switchGroup()` 方法中，`globalData.groupId` 赋值后追加 `groupStore.switchGroup(groupId)`（后续票 04 清理）
- [x] 编译通过，小程序启动后 Store 内容与 `globalData` 一致（可通过 console.log 验证）

## Comments

`b4f570b` — 在 app.ts 的 _ensureUserProfile()、_initApp()（含群组已存在和无群组分两分支）及 switchGroup() 中追加 westore Store 双写调用，并在两处 _initApp 出口添加 console.log 验证。
注：新用户路径中 needProfileSetup=true，不适合调用 setProfile()（会置 needProfileSetup=false）或 skipProfileSetup()（同样置 false），因此直接操作 store.data + update() 保留 needProfileSetup 语义。
