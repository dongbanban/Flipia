import type { Category, DrawConfigGroup } from "./init-data";

export interface ValidateCategoryNameResult {
  value: string;
  error: string | null;
}

export function validateCategoryName(
  raw: string,
  existingNames: string[],
  excludeName?: string,
): ValidateCategoryNameResult {
  const trimmed = raw.trim();
  if (!trimmed) return { value: "", error: "分类名不能为空" };
  const value = trimmed.slice(0, 10);
  if (existingNames.some((n) => n !== excludeName && n === value)) {
    return { value, error: "分类名已存在" };
  }
  return { value, error: null };
}

export function generateCategoryId(): string {
  return `cat-custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function addCategory(
  categories: Category[],
  name: string,
): Category[] {
  return [...categories, { id: generateCategoryId(), name }];
}

export function renameCategory(
  categories: Category[],
  id: string,
  newName: string,
): Category[] {
  return categories.map((c) => (c.id === id ? { ...c, name: newName } : c));
}

export interface DeleteCategoryResult {
  categories: Category[];
  drawConfigGroups: DrawConfigGroup[];
}

export function deleteCategory(
  categories: Category[],
  drawConfigGroups: DrawConfigGroup[],
  categoryId: string,
): DeleteCategoryResult {
  const newCategories = categories.filter((c) => c.id !== categoryId);
  let newGroups = drawConfigGroups.map((g) => ({
    ...g,
    entries: g.entries.filter((d) => d.categoryId !== categoryId),
  }));

  if (newCategories.length > 0) {
    newGroups = newGroups.map((g) => {
      if (g.entries.length > 0) return g;
      const firstCat = newCategories[0];
      return {
        ...g,
        entries: [
          {
            categoryId: firstCat.id,
            categoryName: firstCat.name,
            count: 1,
          },
        ],
      };
    });
  } else {
    newGroups = newGroups.map((g) => ({
      ...g,
      entries: [],
    }));
  }

  return { categories: newCategories, drawConfigGroups: newGroups };
}
