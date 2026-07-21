# 07 — 抽取方案管理

**What to build:** 在「我的」页面提供抽取方案入口。用户可管理多套抽取方案（最多 10 套），每套方案包含参与抽取的分类及各自数量；可切换当前生效方案。

**Blocked by:** 06 — 分类管理

**Status:** done

---

## 数据模型

```ts
// user_config
interface DrawConfigEntry {
  categoryId: string;
  categoryName: string;
  count: number;           // 1-5
}

interface DrawConfigGroup {
  id: string;
  name: string;            // 最多 100 字
  entries: DrawConfigEntry[];
}

// user_config 字段
drawConfigGroups: DrawConfigGroup[];
// activeDrawConfigGroupId / lastDrawnGroupId 已迁移至本地存储，不复存在于云端 user_config
```

---

## 方案列表页 (`draw-config-manage/index`)

- [x] 方角网格展示方案卡片，一行 3 个，浅绿底色 + 正绿边框
- [x] 卡片显示方案名（最多 2 行）、分类计数（白底绿字圆形 badge）
- [x] 生效方案卡片标注"生效中"，非生效方案显示"设为当前"按钮；均为即刻生效
- [x] 生效方案卡片显示"取消"按钮，即刻取消生效
- [x] 点击卡片 → 弹出底部 Modal，编辑方案名称、分类数量配置、设为/取消当前
- [x] Modal 内编辑仅本地暂存，点击"确认"后一次性写入云端
- [x] 支持新建方案：底部"＋ 新建方案"按钮，弹出命名输入（方案名最多 100 字，不可重复）
- [x] 支持删除方案：× 按钮（absolute 右上角），确认弹窗
- [x] 至少保留一套方案：仅剩一套时隐藏 × 删除入口
- [x] 方案上限 10 套：达到上限时隐藏"＋ 新建方案"按钮

## Modal 编辑

- [x] 展示方案名称输入框（可修改，最多 100 字，点击"确认"时校验）
- [x] 展示当前方案的 entries 列表，每条显示分类名 + 步进器 −/＋（1-5）
- [x] 支持从现有分类中新增一条 entry（不可重复添加同一分类），通过 ActionSheet 选择
- [x] 可用分类列表 = `categories` 中存在且尚未加入当前方案 entries 的分类
- [x] 支持移除某条 entry（至少保留一条，最后一条时隐藏 ×）
- [x] 底部"设为当前"/"取消生效"按钮，仅改变本地状态
- [x] 点击"确认"：校验名称 → 更新方案名称 + entries + activeId → 写入云端 → 更新卡片列表

## 数据迁移

- [x] `buildDefaultUserConfig`：创建 `DrawConfigGroup[]` 含一个"默认方案"（4 分类各 count=1）
- [x] `init-data` 类型更新：`UserConfig` 新增 `drawConfigGroups`，移除 `drawConfig`
- [x] `category-manage.ts` `deleteCategory` 遍历所有 group 的 `entries` 清理对应分类，并保证每组至少一条
- [x] `draw-engine.ts` 签名不变；调用方传入当前生效 group 的 `entries`
- [x] `resolveEffectiveGroupId(groups, activeId, lastDrawnId)` — 方案优先级：手动设置 → 上次抽取 → 列表第一个
- [x] `activeDrawConfigGroupId` / `lastDrawnGroupId` 由云端迁移至本地存储（`wx.setStorageSync`），`index` 和 `draw-config-manage` 页面均从本地读写，`UserConfig` 接口清除该字段

## Acceptance

- [x] 方案列表页方角网格正确展示、快捷切方案/取消、新建/删除（上限/下限约束生效）
- [x] Modal 正确展示 entries、调数量、增删 entry（重复检测、至少一条约束生效）
- [x] Modal 内编辑仅本地暂存，点击"确认"后一次性写入云端
- [x] 分类删除后所有方案中对应 entry 移除，每组至少保留一条
- [x] 首次初始化生成"默认方案"且设为生效方案
- [x] 纯函数全部有单元测试覆盖（52 tests）

## Comments

- `a958373` — 补充健壮性：_saveGroups 增加 try/catch + 用户错误提示、_saving 防并发保存锁、_configId 空值守卫、移除冗余 categories 写入、清理 unused import
- 后续迭代：`activeDrawConfigGroupId` / `lastDrawnGroupId` 从云端迁移至本地存储 → 移除 `UserConfig` 对应字段，`draw-config-manage` 和 `index` 页面从 `wx.setStorageSync` 读写，"设为当前"/"取消"不再写云端
