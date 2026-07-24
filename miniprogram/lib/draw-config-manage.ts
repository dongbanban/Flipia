import type { Category, DrawConfigEntry, DrawConfigGroup } from "@/lib/init-data";
import { generateGroupId } from "@/lib/init-data";
import { LIMITS } from "@/config";

export function clampDrawCount(count: number): number {
  if (count < LIMITS.DRAW_COUNT_MIN) return LIMITS.DRAW_COUNT_MIN;
  if (count > LIMITS.DRAW_COUNT_MAX) return LIMITS.DRAW_COUNT_MAX;
  return Math.round(count);
}

export function updateDrawCount(
  config: DrawConfigEntry[],
  categoryId: string,
  count: number,
): DrawConfigEntry[] {
  const clamped = clampDrawCount(count);
  return config.map((d) =>
    d.categoryId === categoryId ? { ...d, count: clamped } : d,
  );
}

export function addDrawConfigEntry(
  config: DrawConfigEntry[],
  categories: Category[],
  categoryId: string,
): DrawConfigEntry[] {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return config;
  if (config.some((d) => d.categoryId === categoryId)) return config;
  return [
    ...config,
    { categoryId: cat.id, categoryName: cat.name, count: 1 },
  ];
}

export function removeDrawConfigEntry(
  config: DrawConfigEntry[],
  categoryId: string,
): DrawConfigEntry[] {
  if (config.length <= 1) return config;
  return config.filter((d) => d.categoryId !== categoryId);
}

export function getAvailableCategories(
  config: DrawConfigEntry[],
  categories: Category[],
): Category[] {
  const usedIds = new Set(config.map((d) => d.categoryId));
  return categories.filter((c) => !usedIds.has(c.id));
}

export function validateGroupName(
  raw: string,
  existingNames: string[],
  excludeName?: string,
): { value: string; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: "", error: "得有个名字" };
  const value = trimmed.slice(0, LIMITS.DRAW_CONFIG_NAME_MAX);
  if (existingNames.some((n) => n !== excludeName && n === value)) {
    return { value, error: "这个名字用过了" };
  }
  return { value, error: null };
}

export function createDrawConfigGroup(
  groups: DrawConfigGroup[],
  categories: Category[],
): DrawConfigGroup[] {
  if (groups.length >= LIMITS.DRAW_CONFIG_GROUP_MAX) return groups;
  if (categories.length === 0) return groups;
  const entries: DrawConfigEntry[] = categories.map((c) => ({
    categoryId: c.id,
    categoryName: c.name,
    count: 1,
  }));
  return [
    ...groups,
    { id: generateGroupId(), name: "", entries },
  ];
}

export function renameDrawConfigGroup(
  groups: DrawConfigGroup[],
  groupId: string,
  name: string,
): DrawConfigGroup[] {
  return groups.map((g) => (g.id === groupId ? { ...g, name } : g));
}

export function deleteDrawConfigGroup(
  groups: DrawConfigGroup[],
  groupId: string,
): DrawConfigGroup[] {
  if (groups.length <= 1) return groups;
  return groups.filter((g) => g.id !== groupId);
}

export function syncDrawConfigNames(
  config: DrawConfigEntry[],
  categories: Category[],
): DrawConfigEntry[] {
  return config.map((d) => {
    const cat = categories.find((c) => c.id === d.categoryId);
    return cat ? { ...d, categoryName: cat.name } : d;
  });
}

export function resolveEffectiveGroupId(
  groups: DrawConfigGroup[],
  activeId: string,
  lastDrawnId: string,
): string {
  if (groups.length === 0) return "";
  if (activeId && groups.some((g) => g.id === activeId)) return activeId;
  if (lastDrawnId && groups.some((g) => g.id === lastDrawnId)) return lastDrawnId;
  return groups[0].id;
}

export function syncAllGroupNames(
  groups: DrawConfigGroup[],
  categories: Category[],
): DrawConfigGroup[] {
  return groups.map((g) => ({
    ...g,
    entries: syncDrawConfigNames(g.entries, categories),
  }));
}
