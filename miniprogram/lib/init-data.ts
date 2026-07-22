import { STRINGS } from "../config";

// init-data — 首次启动云端初始化的纯工厂函数。

export interface Category {
  id: string;
  name: string;
}

export interface DrawConfigEntry {
  categoryId: string;
  categoryName: string;
  count: number;
}

export interface DrawConfigGroup {
  id: string;
  name: string;
  entries: DrawConfigEntry[];
}

export interface UserConfig {
  groupId: string;
  categories: Category[];
  drawConfigGroups: DrawConfigGroup[];
}

export interface PresetDish {
  groupId: string;
  name: string;
  categoryId: string;
  enabled: boolean;
  creatorId: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-meat", name: "荤菜" },
  { id: "cat-veg", name: "素菜" },
  { id: "cat-staple", name: "主食" },
  { id: "cat-soup", name: "汤" },
];

export function generateGroupId(): string {
  return `grp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** 构建默认 user_config 文档（不含 _id，由云端生成）。 */
export function buildDefaultUserConfig(
  groupId: string,
  _openid: string,
): UserConfig {
  const categories = DEFAULT_CATEGORIES;
  const entries: DrawConfigEntry[] = categories.map((c) => ({
    categoryId: c.id,
    categoryName: c.name,
    count: 1,
  }));
  const defaultGroup: DrawConfigGroup = {
    id: generateGroupId(),
    name: STRINGS.DEFAULT_DRAW_CONFIG_NAME,
    entries,
  };
  return {
    groupId,
    categories,
    drawConfigGroups: [defaultGroup],
  };
}

const PRESET_DISHES_MAP: Record<string, string[]> = {
  "cat-meat": [
    "红烧肉",
    "糖醋排骨",
    "宫保鸡丁",
    "鱼香肉丝",
    "回锅肉",
  ],
  "cat-veg": [
    "清炒西兰花",
    "醋溜白菜",
    "地三鲜",
    "炒土豆丝",
    "番茄炒蛋",
  ],
  "cat-staple": [
    "白米饭",
    "炒饭",
    "面条",
    "饺子",
    "馒头",
  ],
  "cat-soup": [
    "番茄蛋花汤",
    "紫菜虾皮汤",
    "冬瓜排骨汤",
    "酸辣汤",
    "豆腐汤",
  ],
};

/** 构建预设菜品列表（不含 _id，由云端生成）。 */
export function buildPresetDishes(groupId: string, creatorId: string): PresetDish[] {
  const result: PresetDish[] = [];
  for (const cat of DEFAULT_CATEGORIES) {
    const names = PRESET_DISHES_MAP[cat.id] ?? [];
    for (const name of names) {
      result.push({ groupId, name, categoryId: cat.id, enabled: true, creatorId });
    }
  }
  return result;
}
