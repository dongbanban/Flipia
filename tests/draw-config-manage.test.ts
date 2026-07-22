import { describe, it, expect } from "vitest";
import {
  clampDrawCount,
  updateDrawCount,
  addDrawConfigEntry,
  removeDrawConfigEntry,
  getAvailableCategories,
  syncDrawConfigNames,
  validateGroupName,
  createDrawConfigGroup,
  renameDrawConfigGroup,
  deleteDrawConfigGroup,
  syncAllGroupNames,
  resolveEffectiveGroupId,
} from "../miniprogram/lib/draw-config-manage";
import type { Category, DrawConfigEntry, DrawConfigGroup } from "../miniprogram/lib/init-data";

const MEAT = "cat-meat";
const VEG = "cat-veg";
const STAPLE = "cat-staple";
const SOUP = "cat-soup";

const categories: Category[] = [
  { id: MEAT, name: "荤菜" },
  { id: VEG, name: "素菜" },
  { id: STAPLE, name: "主食" },
  { id: SOUP, name: "汤" },
];

const config: DrawConfigEntry[] = [
  { categoryId: MEAT, categoryName: "荤菜", count: 2 },
  { categoryId: VEG, categoryName: "素菜", count: 1 },
  { categoryId: STAPLE, categoryName: "主食", count: 1 },
];

const groups: DrawConfigGroup[] = [
  {
    id: "grp-1",
    name: "雨露均沾",
    entries: [
      { categoryId: MEAT, categoryName: "荤菜", count: 2 },
      { categoryId: VEG, categoryName: "素菜", count: 1 },
    ],
  },
  {
    id: "grp-2",
    name: "周末大餐",
    entries: [
      { categoryId: MEAT, categoryName: "荤菜", count: 3 },
      { categoryId: STAPLE, categoryName: "主食", count: 1 },
    ],
  },
];

// ── clampDrawCount ──────────────────────────────────────────────────────────

describe("clampDrawCount", () => {
  it("returns integer values unchanged when within 1-5", () => {
    expect(clampDrawCount(1)).toBe(1);
    expect(clampDrawCount(3)).toBe(3);
    expect(clampDrawCount(5)).toBe(5);
  });

  it("clamps values below 1 to 1", () => {
    expect(clampDrawCount(0)).toBe(1);
    expect(clampDrawCount(-1)).toBe(1);
    expect(clampDrawCount(-100)).toBe(1);
  });

  it("clamps values above 5 to 5", () => {
    expect(clampDrawCount(6)).toBe(5);
    expect(clampDrawCount(100)).toBe(5);
  });

  it("rounds non-integer values", () => {
    expect(clampDrawCount(2.3)).toBe(2);
    expect(clampDrawCount(2.7)).toBe(3);
  });
});

// ── updateDrawCount ─────────────────────────────────────────────────────────

describe("updateDrawCount", () => {
  it("updates count for the matching entry", () => {
    const result = updateDrawCount(config, MEAT, 4);
    const entry = result.find((d) => d.categoryId === MEAT)!;
    expect(entry.count).toBe(4);
  });

  it("does not mutate other entries", () => {
    const result = updateDrawCount(config, MEAT, 3);
    const vegEntry = result.find((d) => d.categoryId === VEG)!;
    expect(vegEntry.count).toBe(1);
  });

  it("does not mutate the original array", () => {
    const original = [...config];
    updateDrawCount(config, MEAT, 3);
    expect(config).toEqual(original);
  });

  it("clamps count to 1-5 range", () => {
    const resultLow = updateDrawCount(config, MEAT, -10);
    expect(resultLow.find((d) => d.categoryId === MEAT)!.count).toBe(1);

    const resultHigh = updateDrawCount(config, MEAT, 99);
    expect(resultHigh.find((d) => d.categoryId === MEAT)!.count).toBe(5);
  });

  it("returns unchanged array if categoryId not found", () => {
    const result = updateDrawCount(config, "nonexistent", 3);
    expect(result).toEqual(config);
  });

  it("works on empty config", () => {
    const result = updateDrawCount([], MEAT, 3);
    expect(result).toEqual([]);
  });
});

// ── addDrawConfigEntry ──────────────────────────────────────────────────────

describe("addDrawConfigEntry", () => {
  it("adds a new entry with count 1 and correct category name", () => {
    const partial: DrawConfigEntry[] = [
      { categoryId: MEAT, categoryName: "荤菜", count: 2 },
    ];
    const result = addDrawConfigEntry(partial, categories, VEG);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ categoryId: VEG, categoryName: "素菜", count: 1 });
  });

  it("returns unchanged config when categoryId already exists", () => {
    const result = addDrawConfigEntry(config, categories, MEAT);
    expect(result).toEqual(config);
  });

  it("returns unchanged config when category not in categories list", () => {
    const result = addDrawConfigEntry(config, categories, "nonexistent");
    expect(result).toEqual(config);
  });

  it("returns unchanged config when categories list is empty", () => {
    const result = addDrawConfigEntry(config, [], MEAT);
    expect(result).toEqual(config);
  });

  it("does not mutate the original array", () => {
    const partial: DrawConfigEntry[] = [
      { categoryId: MEAT, categoryName: "荤菜", count: 2 },
    ];
    const original = [...partial];
    addDrawConfigEntry(partial, categories, VEG);
    expect(partial).toEqual(original);
  });

  it("can add to empty config", () => {
    const result = addDrawConfigEntry([], categories, MEAT);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ categoryId: MEAT, categoryName: "荤菜", count: 1 });
  });
});

// ── removeDrawConfigEntry ───────────────────────────────────────────────────

describe("removeDrawConfigEntry", () => {
  it("removes the matching entry", () => {
    const result = removeDrawConfigEntry(config, VEG);
    expect(result).toHaveLength(2);
    expect(result.find((d) => d.categoryId === VEG)).toBeUndefined();
  });

  it("does not mutate the original array", () => {
    const original = [...config];
    removeDrawConfigEntry(config, VEG);
    expect(config).toEqual(original);
  });

  it("refuses to remove when only 1 entry exists", () => {
    const single: DrawConfigEntry[] = [
      { categoryId: MEAT, categoryName: "荤菜", count: 1 },
    ];
    const result = removeDrawConfigEntry(single, MEAT);
    expect(result).toHaveLength(1);
    expect(result).toEqual(single);
  });

  it("returns unchanged array if categoryId not found", () => {
    const result = removeDrawConfigEntry(config, "nonexistent");
    expect(result).toEqual(config);
  });

  it("returns empty array unchanged when config is empty", () => {
    const result = removeDrawConfigEntry([], "any-id");
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });
});

// ── getAvailableCategories ──────────────────────────────────────────────────

describe("getAvailableCategories", () => {
  it("returns categories not yet in the draw config", () => {
    const partial: DrawConfigEntry[] = [
      { categoryId: MEAT, categoryName: "荤菜", count: 2 },
      { categoryId: VEG, categoryName: "素菜", count: 1 },
    ];
    const result = getAvailableCategories(partial, categories);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual([STAPLE, SOUP]);
  });

  it("returns empty when all categories are in config", () => {
    const full: DrawConfigEntry[] = categories.map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      count: 1,
    }));
    const result = getAvailableCategories(full, categories);
    expect(result).toHaveLength(0);
  });

  it("returns all categories when config is empty", () => {
    const result = getAvailableCategories([], categories);
    expect(result).toEqual(categories);
  });

  it("returns empty when categories is empty", () => {
    const result = getAvailableCategories(config, []);
    expect(result).toHaveLength(0);
  });
});

// ── syncDrawConfigNames ─────────────────────────────────────────────────────

describe("syncDrawConfigNames", () => {
  it("updates categoryName from categories list", () => {
    const stale: DrawConfigEntry[] = [
      { categoryId: MEAT, categoryName: "旧名称", count: 2 },
    ];
    const result = syncDrawConfigNames(stale, categories);
    expect(result[0].categoryName).toBe("荤菜");
  });

  it("does not mutate the original array", () => {
    const stale: DrawConfigEntry[] = [
      { categoryId: MEAT, categoryName: "旧名称", count: 2 },
    ];
    const original = [...stale];
    syncDrawConfigNames(stale, categories);
    expect(stale).toEqual(original);
  });

  it("leaves entry unchanged if category not found in categories", () => {
    const stale: DrawConfigEntry[] = [
      { categoryId: "deleted-cat", categoryName: "已删除", count: 1 },
    ];
    const result = syncDrawConfigNames(stale, categories);
    expect(result[0].categoryName).toBe("已删除");
  });
});

// ── validateGroupName ───────────────────────────────────────────────────────

describe("validateGroupName", () => {
  it("returns error for empty string", () => {
    const { error } = validateGroupName("", []);
    expect(error).toBe("方案名不能为空");
  });

  it("returns error for whitespace-only", () => {
    const { error } = validateGroupName("   ", []);
    expect(error).toBe("方案名不能为空");
  });

  it("returns no error and trims for valid name", () => {
    const { value, error } = validateGroupName(" 晚餐 ", []);
    expect(error).toBeNull();
    expect(value).toBe("晚餐");
  });

  it("returns error when name already exists", () => {
    const { error } = validateGroupName("雨露均沾", ["雨露均沾", "周末"]);
    expect(error).toBe("方案名已存在");
  });

  it("returns no error when name equals excludeName (rename case)", () => {
    const { error } = validateGroupName("雨露均沾", ["雨露均沾", "周末"], "雨露均沾");
    expect(error).toBeNull();
  });

  it("truncates name longer than 100 chars", () => {
    const { value, error } = validateGroupName("a".repeat(150), []);
    expect(error).toBeNull();
    expect(value).toHaveLength(100);
  });

  it("name of exactly 100 chars is accepted unchanged", () => {
    const exact100 = "a".repeat(100);
    const { value, error } = validateGroupName(exact100, []);
    expect(error).toBeNull();
    expect(value).toBe(exact100);
    expect(value).toHaveLength(100);
  });
});

// ── createDrawConfigGroup ───────────────────────────────────────────────────

describe("createDrawConfigGroup", () => {
  it("creates a new group with empty name and entries for all categories", () => {
    const result = createDrawConfigGroup(groups, categories);
    expect(result).toHaveLength(3);
    const created = result[2];
    expect(created.name).toBe("");
    expect(created.entries).toHaveLength(4);
    expect(created.entries.every((e) => e.count === 1)).toBe(true);
  });

  it("returns unchanged when already at 10 groups", () => {
    const ten: DrawConfigGroup[] = Array.from({ length: 10 }, (_, i) => ({
      id: `grp-${i}`,
      name: `方案${i}`,
      entries: [],
    }));
    const result = createDrawConfigGroup(ten, categories);
    expect(result).toHaveLength(10);
  });

  it("does not mutate the original array", () => {
    const original = [...groups];
    createDrawConfigGroup(groups, categories);
    expect(groups).toEqual(original);
  });

  it("returns unchanged when categories is empty (no empty groups)", () => {
    const result = createDrawConfigGroup(groups, []);
    expect(result).toEqual(groups);
  });

  it("creating at 9 groups succeeds and reaches limit of 10", () => {
    const nine: DrawConfigGroup[] = Array.from({ length: 9 }, (_, i) => ({
      id: `grp-${i}`,
      name: `方案${i}`,
      entries: [],
    }));
    const result = createDrawConfigGroup(nine, categories);
    expect(result).toHaveLength(10);
    expect(result[9].name).toBe("");
  });
});

// ── renameDrawConfigGroup ───────────────────────────────────────────────────

describe("renameDrawConfigGroup", () => {
  it("renames the matching group", () => {
    const result = renameDrawConfigGroup(groups, "grp-1", "新名字");
    expect(result[0].name).toBe("新名字");
    expect(result[1].name).toBe("周末大餐");
  });

  it("does not mutate the original array", () => {
    const original = [...groups];
    renameDrawConfigGroup(groups, "grp-1", "new");
    expect(groups).toEqual(original);
  });

  it("returns unchanged if groupId not found", () => {
    const result = renameDrawConfigGroup(groups, "nonexistent", "new");
    expect(result).toEqual(groups);
  });
});

// ── deleteDrawConfigGroup ───────────────────────────────────────────────────

describe("deleteDrawConfigGroup", () => {
  it("removes the matching group", () => {
    const result = deleteDrawConfigGroup(groups, "grp-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("grp-2");
  });

  it("refuses to delete when only 1 group exists", () => {
    const single: DrawConfigGroup[] = [
      { id: "grp-only", name: "唯一", entries: [] },
    ];
    const result = deleteDrawConfigGroup(single, "grp-only");
    expect(result).toHaveLength(1);
  });

  it("does not mutate the original array", () => {
    const original = [...groups];
    deleteDrawConfigGroup(groups, "grp-1");
    expect(groups).toEqual(original);
  });

  it("returns unchanged if groupId not found", () => {
    const result = deleteDrawConfigGroup(groups, "nonexistent");
    expect(result).toEqual(groups);
  });
});

// ── syncAllGroupNames ───────────────────────────────────────────────────────

describe("syncAllGroupNames", () => {
  it("updates entry names in all groups", () => {
    const stale: DrawConfigGroup[] = [
      {
        id: "grp-1",
        name: "方案",
        entries: [{ categoryId: MEAT, categoryName: "旧", count: 1 }],
      },
    ];
    const result = syncAllGroupNames(stale, categories);
    expect(result[0].entries[0].categoryName).toBe("荤菜");
  });

  it("does not mutate the original array", () => {
    const stale: DrawConfigGroup[] = [
      {
        id: "grp-1",
        name: "方案",
        entries: [{ categoryId: MEAT, categoryName: "旧", count: 1 }],
      },
    ];
    const original = [...stale];
    syncAllGroupNames(stale, categories);
    expect(stale).toEqual(original);
  });

  it("updates names across multiple groups", () => {
    const stale: DrawConfigGroup[] = [
      {
        id: "grp-1",
        name: "方案A",
        entries: [
          { categoryId: MEAT, categoryName: "旧名称", count: 2 },
          { categoryId: VEG, categoryName: "旧名称", count: 1 },
        ],
      },
      {
        id: "grp-2",
        name: "方案B",
        entries: [
          { categoryId: MEAT, categoryName: "旧名称", count: 3 },
        ],
      },
    ];
    const result = syncAllGroupNames(stale, categories);
    expect(result).toHaveLength(2);
    expect(result[0].entries[0].categoryName).toBe("荤菜");
    expect(result[0].entries[1].categoryName).toBe("素菜");
    expect(result[1].entries[0].categoryName).toBe("荤菜");
  });
});

// ── resolveEffectiveGroupId ───────────────────────────────────────────────

describe("resolveEffectiveGroupId", () => {
  it("returns activeId when set and valid", () => {
    const result = resolveEffectiveGroupId(groups, "grp-1", "");
    expect(result).toBe("grp-1");
  });

  it("falls back to lastDrawnId when activeId is empty", () => {
    const result = resolveEffectiveGroupId(groups, "", "grp-2");
    expect(result).toBe("grp-2");
  });

  it("falls back to lastDrawnId when activeId is invalid", () => {
    const result = resolveEffectiveGroupId(groups, "nonexistent", "grp-2");
    expect(result).toBe("grp-2");
  });

  it("falls back to first group when both activeId and lastDrawnId are invalid", () => {
    const result = resolveEffectiveGroupId(groups, "nonexistent", "also-bad");
    expect(result).toBe("grp-1");
  });

  it("falls back to first group when both are empty", () => {
    const result = resolveEffectiveGroupId(groups, "", "");
    expect(result).toBe("grp-1");
  });

  it("returns empty string when groups is empty", () => {
    const result = resolveEffectiveGroupId([], "grp-1", "grp-2");
    expect(result).toBe("");
  });
});
