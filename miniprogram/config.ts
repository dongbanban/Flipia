// Centralized app configuration — single source of truth for limits, query sizes,
// cloud environment, brand strings, and feature flags that were previously scattered
// across 10+ files.

/** Cloud environment settings. */
export const CLOUD = {
  envId: "cloud1-d5gwv3g0da9888b0e",
} as const;

/** All numeric limits and thresholds used across the app. */
export const LIMITS = {
  /** Maximum image file size before compression (1 MB). */
  IMAGE_MAX_SIZE: 1024 * 1024,
  /** Max characters for a category name. */
  CATEGORY_NAME_MAX: 10,
  /** Max characters for a dish name. */
  DISH_NAME_MAX: 20,
  /** Max characters for a draw-config / plan name. */
  DRAW_CONFIG_NAME_MAX: 100,
  /** Max characters for a kitchen / group name. */
  GROUP_NAME_MAX: 12,
  /** Max number of draw-config groups per kitchen. */
  DRAW_CONFIG_GROUP_MAX: 10,
  /** Minimum dishes to draw from a single category. */
  DRAW_COUNT_MIN: 1,
  /** Maximum dishes to draw from a single category. */
  DRAW_COUNT_MAX: 5,
  /** Max members allowed in a kitchen. */
  KITCHEN_MEMBER_MAX: 5,
  /** Max dishes to import from a source kitchen during group creation. */
  DISH_IMPORT_MAX: 500,
  /** Max real-photo images per draw-history record. */
  HISTORY_IMAGE_MAX: 3,
  /** Max images per dish. */
  DISH_IMAGE_MAX: 1,
} as const;

/** Database / cloud-query page sizes and limits. */
export const QUERY = {
  /** History page initial load limit. */
  LIMIT_HISTORY: 50,
  /** Today's draw summary / user-config-scoped query limit. */
  LIMIT_USER_CONFIG: 20,
  /** General-purpose max limit used for pagination (dish pool, archive, import). */
  LIMIT_GENERIC_MAX: 100,
} as const;

/** Brand and default copy. */
export const STRINGS = {
  DEFAULT_GROUP_NAME: "我的厨房",
  DEFAULT_DRAW_CONFIG_NAME: "雨露均沾",
  BRAND_NAME: "Flipia",
} as const;

/** Draw-history archival window in days. */
export const HISTORY_WINDOW_DAYS = 7;

/** Length of generated invite codes. */
export const INVITE_CODE_LENGTH = 6;
