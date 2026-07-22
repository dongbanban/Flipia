// 集中式应用配置 — 所有限制值、查询尺寸、云环境、品牌文案及功能开关的单一来源，
// 此前分散在 10+ 个文件中。

/** 云环境设置。 */
export const CLOUD = {
  envId: "cloud1-d5gwv3g0da9888b0e",
} as const;

/** 应用中使用的所有数值限制和阈值。 */
export const LIMITS = {
  /** 压缩前的最大图片文件大小 (1 MB)。 */
  IMAGE_MAX_SIZE: 1024 * 1024,
  /** 分类名最大字数。 */
  CATEGORY_NAME_MAX: 10,
  /** 菜品名最大字数。 */
  DISH_NAME_MAX: 20,
  /** 抽取方案名最大字数。 */
  DRAW_CONFIG_NAME_MAX: 100,
  /** 厨房/群组名最大字数。 */
  GROUP_NAME_MAX: 12,
  /** 每个厨房最多抽取方案数。 */
  DRAW_CONFIG_GROUP_MAX: 10,
  /** 单个分类最少抽取道数。 */
  DRAW_COUNT_MIN: 1,
  /** 单个分类最多抽取道数。 */
  DRAW_COUNT_MAX: 5,
  /** 每个厨房最多成员数。 */
  KITCHEN_MEMBER_MAX: 5,
  /** 创建厨房时从源厨房最多导入菜品数。 */
  DISH_IMPORT_MAX: 500,
  /** 每条历史记录最多实拍图片数。 */
  HISTORY_IMAGE_MAX: 3,
  /** 每个菜品最多图片数。 */
  DISH_IMAGE_MAX: 1,
} as const;

/** 数据库/云查询的分页大小和限制。 */
export const QUERY = {
  /** 历史页面初始加载上限。 */
  LIMIT_HISTORY: 50,
  /** 今日抽取摘要/用户配置范围的查询上限。 */
  LIMIT_USER_CONFIG: 20,
  /** 通用分页最大上限（菜品池、归档、导入）。 */
  LIMIT_GENERIC_MAX: 100,
} as const;

/** 品牌和默认文案。 */
export const STRINGS = {
  DEFAULT_GROUP_NAME: "我的厨房",
  DEFAULT_DRAW_CONFIG_NAME: "雨露均沾",
  BRAND_NAME: "Flipia",
} as const;

/** 抽取历史归档窗口（天）。 */
export const HISTORY_WINDOW_DAYS = 7;

/** 生成邀请码的长度。 */
export const INVITE_CODE_LENGTH = 6;
