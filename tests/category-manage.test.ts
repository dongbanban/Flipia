import { describe, it, expect } from "vitest";
import {
  validateCategoryName,
  generateCategoryId,
  addCategory,
  renameCategory,
  deleteCategory,
} from "../miniprogram/lib/category-manage";
import type { Category, DrawConfigGroup } from "../miniprogram/lib/init-data";

const EXISTING = ["荤菜", "素菜", "主食"];

describe("validateCategoryName", () => {
  it("returns error for empty string", () => {
    const { error } = validateCategoryName("", []);
    expect(error).toBe("分类名不能为空");
  });

  it("returns error for whitespace-only string", () => {
    const { error } = validateCategoryName("   ", []);
    expect(error).toBe("分类名不能为空");
  });

  it("returns no error and trims for valid name", () => {
    const { value, error } = validateCategoryName(" 甜点 ", []);
    expect(error).toBeNull();
    expect(value).toBe("甜点");
  });

  it("returns error when name already exists", () => {
    const { error } = validateCategoryName("荤菜", EXISTING);
    expect(error).toBe("分类名已存在");
  });

  it("returns no error when name equals excludeName (rename case)", () => {
    const { error } = validateCategoryName("荤菜", EXISTING, "荤菜");
    expect(error).toBeNull();
  });

  it("returns error when name duplicates a different existing name (even with excludeName)", () => {
    const { error } = validateCategoryName("素菜", EXISTING, "荤菜");
    expect(error).toBe("分类名已存在");
  });

  it("truncates name longer than 10 chars", () => {
    const { value, error } = validateCategoryName("a".repeat(15), []);
    expect(error).toBeNull();
    expect(value).toHaveLength(10);
  });

  it("name of exactly 10 chars is accepted unchanged", () => {
    const exact = "a".repeat(10);
    const { value, error } = validateCategoryName(exact, []);
    expect(error).toBeNull();
    expect(value).toBe(exact);
  });
});

describe("generateCategoryId", () => {
  it("returns a string starting with cat-custom-", () => {
    const id = generateCategoryId();
    expect(id.startsWith("cat-custom-")).toBe(true);
  });

  it("returns unique IDs on repeated calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateCategoryId()));
    expect(ids.size).toBeGreaterThanOrEqual(98);
  });
});

describe("addCategory", () => {
  it("appends a new category at the end", () => {
    const input: Category[] = [
      { id: "cat-meat", name: "荤菜" },
      { id: "cat-veg", name: "素菜" },
    ];
    const result = addCategory(input, "甜点");
    expect(result).toHaveLength(3);
    expect(result[2].name).toBe("甜点");
    expect(result[2].id).toMatch(/^cat-custom-/);
  });

  it("does not mutate the original array", () => {
    const input: Category[] = [{ id: "cat-meat", name: "荤菜" }];
    const original = [...input];
    addCategory(input, "甜点");
    expect(input).toEqual(original);
  });

  it("works on empty categories list", () => {
    const result = addCategory([], "唯一");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("唯一");
  });
});

describe("renameCategory", () => {
  it("renames the matching category by id", () => {
    const input: Category[] = [
      { id: "cat-meat", name: "荤菜" },
      { id: "cat-veg", name: "素菜" },
    ];
    const result = renameCategory(input, "cat-meat", "大肉");
    expect(result[0].name).toBe("大肉");
    expect(result[1].name).toBe("素菜");
  });

  it("does not mutate the original array", () => {
    const input: Category[] = [{ id: "cat-meat", name: "荤菜" }];
    const original = [...input];
    renameCategory(input, "cat-meat", "new");
    expect(input).toEqual(original);
  });

  it("returns unchanged if id not found", () => {
    const input: Category[] = [{ id: "cat-meat", name: "荤菜" }];
    const result = renameCategory(input, "nonexistent", "new");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("荤菜");
  });

  it("renames only the matching entry when multiple exist", () => {
    const input: Category[] = [
      { id: "a", name: "A1" },
      { id: "b", name: "B" },
      { id: "a", name: "A2" },
    ];
    const result = renameCategory(input, "a", "Renamed");
    expect(result[0].name).toBe("Renamed");
    expect(result[1].name).toBe("B");
    expect(result[2].name).toBe("Renamed");
  });
});

describe("deleteCategory", () => {
  const categories: Category[] = [
    { id: "cat-meat", name: "荤菜" },
    { id: "cat-veg", name: "素菜" },
    { id: "cat-staple", name: "主食" },
  ];

  const groups: DrawConfigGroup[] = [
    {
      id: "grp-1",
      name: "默认",
      entries: [
        { categoryId: "cat-meat", categoryName: "荤菜", count: 2 },
        { categoryId: "cat-veg", categoryName: "素菜", count: 1 },
        { categoryId: "cat-staple", categoryName: "主食", count: 1 },
      ],
    },
  ];

  it("removes the category and its entries from all groups", () => {
    const result = deleteCategory(categories, groups, "cat-meat");
    expect(result.categories).toHaveLength(2);
    expect(result.drawConfigGroups).toHaveLength(1);
    const g = result.drawConfigGroups[0];
    expect(g.entries).toHaveLength(2);
    expect(g.entries.find((d) => d.categoryId === "cat-meat")).toBeUndefined();
  });

  it("does not mutate original arrays", () => {
    const catsOrig = [...categories];
    const groupsOrig = [...groups];
    deleteCategory(categories, groups, "cat-meat");
    expect(categories).toEqual(catsOrig);
    expect(groups).toEqual(groupsOrig);
  });

  it("deletes the last category: all groups get empty entries", () => {
    const result = deleteCategory(
      [{ id: "only", name: "唯一" }],
      [
        {
          id: "grp-1",
          name: "默认",
          entries: [{ categoryId: "only", categoryName: "唯一", count: 1 }],
        },
      ],
      "only",
    );
    expect(result.categories).toHaveLength(0);
    expect(result.drawConfigGroups[0].entries).toHaveLength(0);
  });

  it("when a group's entries empty but categories remain, fills first remaining category with count 1", () => {
    const cats: Category[] = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ];
    const grps: DrawConfigGroup[] = [
      {
        id: "grp-1",
        name: "默认",
        entries: [{ categoryId: "a", categoryName: "A", count: 1 }],
      },
    ];
    const result = deleteCategory(cats, grps, "a");
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].id).toBe("b");
    const g = result.drawConfigGroups[0];
    expect(g.entries).toHaveLength(1);
    expect(g.entries[0].categoryId).toBe("b");
    expect(g.entries[0].categoryName).toBe("B");
    expect(g.entries[0].count).toBe(1);
  });

  it("removes category from multiple groups", () => {
    const multiGroups: DrawConfigGroup[] = [
      {
        id: "grp-1",
        name: "方案1",
        entries: [
          { categoryId: "cat-meat", categoryName: "荤菜", count: 1 },
          { categoryId: "cat-veg", categoryName: "素菜", count: 1 },
        ],
      },
      {
        id: "grp-2",
        name: "方案2",
        entries: [
          { categoryId: "cat-meat", categoryName: "荤菜", count: 2 },
          { categoryId: "cat-staple", categoryName: "主食", count: 1 },
        ],
      },
    ];
    const result = deleteCategory(categories, multiGroups, "cat-meat");
    expect(result.drawConfigGroups).toHaveLength(2);
    for (const g of result.drawConfigGroups) {
      expect(g.entries.find((d) => d.categoryId === "cat-meat")).toBeUndefined();
    }
  });

  it("returns unchanged groups when categoryId not in any entries", () => {
    const result = deleteCategory(categories, groups, "nonexistent");
    expect(result.drawConfigGroups).toEqual(groups);
    expect(result.categories).toHaveLength(3);
  });
});
