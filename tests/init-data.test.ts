import { describe, it, expect } from "vitest";
import {
  buildDefaultUserConfig,
  buildPresetDishes,
  DEFAULT_CATEGORIES,
  generateGroupId,
} from "../miniprogram/lib/init-data";

const GROUP_ID = "group-abc";
const OPENID = "oXxx_test123";

describe("generateGroupId", () => {
  it("returns a string starting with grp-", () => {
    expect(generateGroupId().startsWith("grp-")).toBe(true);
  });

  it("returns unique IDs on repeated calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateGroupId()));
    expect(ids.size).toBeGreaterThanOrEqual(98);
  });
});

describe("buildDefaultUserConfig", () => {
  it("sets groupId", () => {
    const cfg = buildDefaultUserConfig(GROUP_ID, OPENID);
    expect(cfg.groupId).toBe(GROUP_ID);
  });

  it("has exactly 4 default categories", () => {
    const cfg = buildDefaultUserConfig(GROUP_ID, OPENID);
    expect(cfg.categories).toHaveLength(4);
  });

  it("default categories are 荤菜/素菜/主食/汤 in order", () => {
    const cfg = buildDefaultUserConfig(GROUP_ID, OPENID);
    expect(cfg.categories.map((c) => c.name)).toEqual([
      "荤菜",
      "素菜",
      "主食",
      "汤",
    ]);
  });

  it("has exactly one default draw config group", () => {
    const cfg = buildDefaultUserConfig(GROUP_ID, OPENID);
    expect(cfg.drawConfigGroups).toHaveLength(1);
    expect(cfg.drawConfigGroups[0].name).toBe("雨露均沾");
  });

  it("default group entries match categories 1-to-1 with count 1", () => {
    const cfg = buildDefaultUserConfig(GROUP_ID, OPENID);
    const entries = cfg.drawConfigGroups[0].entries;
    expect(entries).toHaveLength(cfg.categories.length);
    const entryCatIds = entries.map((d) => d.categoryId);
    const catIds = cfg.categories.map((c) => c.id);
    expect(entryCatIds).toEqual(catIds);
    for (const entry of entries) {
      expect(entry.count).toBe(1);
    }
  });

  it("each entry has the matching categoryName", () => {
    const cfg = buildDefaultUserConfig(GROUP_ID, OPENID);
    for (const entry of cfg.drawConfigGroups[0].entries) {
      const cat = cfg.categories.find((c) => c.id === entry.categoryId)!;
      expect(entry.categoryName).toBe(cat.name);
    }
  });
});

describe("buildPresetDishes", () => {
  it("all dishes belong to the given groupId", () => {
    const dishes = buildPresetDishes(GROUP_ID, OPENID);
    expect(dishes.every((d) => d.groupId === GROUP_ID)).toBe(true);
  });

  it("all dishes are enabled by default", () => {
    const dishes = buildPresetDishes(GROUP_ID, OPENID);
    expect(dishes.every((d) => d.enabled)).toBe(true);
  });

  it("all dishes carry the creatorId passed in", () => {
    const dishes = buildPresetDishes(GROUP_ID, "oCreator99");
    expect(dishes.every((d) => d.creatorId === "oCreator99")).toBe(true);
  });

  it("covers all 4 default categories", () => {
    const dishes = buildPresetDishes(GROUP_ID, OPENID);
    const catIds = new Set(dishes.map((d) => d.categoryId));
    for (const cat of DEFAULT_CATEGORIES) {
      expect(catIds.has(cat.id)).toBe(true);
    }
  });

  it("each category has exactly 5 preset dishes", () => {
    const dishes = buildPresetDishes(GROUP_ID, OPENID);
    for (const cat of DEFAULT_CATEGORIES) {
      const count = dishes.filter((d) => d.categoryId === cat.id).length;
      expect(count).toBe(5);
    }
  });

  it("no duplicate dish names within same category", () => {
    const dishes = buildPresetDishes(GROUP_ID, OPENID);
    for (const cat of DEFAULT_CATEGORIES) {
      const names = dishes
        .filter((d) => d.categoryId === cat.id)
        .map((d) => d.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("all dishes have correct categoryId from the preset map", () => {
    const dishes = buildPresetDishes(GROUP_ID, OPENID);
    for (const cat of DEFAULT_CATEGORIES) {
      const dishesInCat = dishes.filter((d) => d.categoryId === cat.id);
      expect(dishesInCat.length).toBeGreaterThan(0);
      expect(dishesInCat.every((d) => d.categoryId === cat.id)).toBe(true);
    }
  });

  it("returns exactly 20 preset dishes total", () => {
    const dishes = buildPresetDishes(GROUP_ID, OPENID);
    expect(dishes).toHaveLength(20);
  });
});
