import { describe, it, expect } from "vitest";
import {
  attachCreatorNames,
  buildImportDishData,
  sortDishes,
  validateDishName,
  toggleEnabled,
} from "../miniprogram/lib/dish-pool";
import type { DishRecord } from "../miniprogram/lib/dish-pool";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeDish(id: string, createdAt?: number): DishRecord {
  return {
    _id: id,
    name: `dish-${id}`,
    categoryId: "cat-meat",
    enabled: true,
    ...(createdAt !== undefined ? { createdAt } : {}),
  };
}

// ── sortDishes ────────────────────────────────────────────────────────────────

describe("sortDishes", () => {
  it("returns empty array unchanged", () => {
    expect(sortDishes([])).toEqual([]);
  });

  it("sorts newer createdAt before older", () => {
    const dishes = [
      makeDish("a", 1000),
      makeDish("b", 2000),
      makeDish("c", 500),
    ];
    const sorted = sortDishes(dishes);
    expect(sorted.map((d) => d._id)).toEqual(["b", "a", "c"]);
  });

  it("dishes without createdAt go to end", () => {
    const dishes = [makeDish("no-ts"), makeDish("has-ts", 1000)];
    const sorted = sortDishes(dishes);
    expect(sorted[0]._id).toBe("has-ts");
    expect(sorted[1]._id).toBe("no-ts");
  });

  it("does not mutate the original array", () => {
    const dishes = [makeDish("a", 1000), makeDish("b", 2000)];
    const original = [...dishes];
    sortDishes(dishes);
    expect(dishes).toEqual(original);
  });

  it("single dish returned as-is", () => {
    const dishes = [makeDish("only", 999)];
    expect(sortDishes(dishes)).toEqual(dishes);
  });
});

// ── validateDishName ──────────────────────────────────────────────────────────

describe("validateDishName", () => {
  it("returns error for empty string", () => {
    const { error } = validateDishName("");
    expect(error).not.toBeNull();
  });

  it("returns error for whitespace-only string", () => {
    const { error } = validateDishName("   ");
    expect(error).not.toBeNull();
  });

  it("returns no error for valid name", () => {
    const { value, error } = validateDishName("红烧肉");
    expect(error).toBeNull();
    expect(value).toBe("红烧肉");
  });

  it("trims surrounding whitespace", () => {
    const { value } = validateDishName("  红烧肉  ");
    expect(value).toBe("红烧肉");
  });

  it("truncates name longer than 20 chars and clears error", () => {
    const long = "a".repeat(25);
    const { value, error } = validateDishName(long);
    expect(error).toBeNull();
    expect(value).toHaveLength(20);
  });

  it("name of exactly 20 chars is accepted unchanged", () => {
    const exact = "a".repeat(20);
    const { value, error } = validateDishName(exact);
    expect(error).toBeNull();
    expect(value).toBe(exact);
  });
});

// ── toggleEnabled ─────────────────────────────────────────────────────────────

describe("toggleEnabled", () => {
  it("enabled=true -> false", () => {
    const dish: DishRecord = {
      _id: "x",
      name: "x",
      categoryId: "c",
      enabled: true,
    };
    expect(toggleEnabled(dish).enabled).toBe(false);
  });

  it("enabled=false -> true", () => {
    const dish: DishRecord = {
      _id: "x",
      name: "x",
      categoryId: "c",
      enabled: false,
    };
    expect(toggleEnabled(dish).enabled).toBe(true);
  });

  it("does not mutate source dish", () => {
    const dish: DishRecord = {
      _id: "x",
      name: "x",
      categoryId: "c",
      enabled: true,
    };
    toggleEnabled(dish);
    expect(dish.enabled).toBe(true);
  });
});

// ── attachCreatorNames ────────────────────────────────────────────────────────

describe("attachCreatorNames", () => {
  it("returns empty array unchanged", () => {
    expect(attachCreatorNames([], {})).toEqual([]);
  });

  it("attaches creatorName from map based on creatorId", () => {
    const dishes: DishRecord[] = [
      { _id: "1", name: "a", categoryId: "c", enabled: true, creatorId: "oid1" },
      { _id: "2", name: "b", categoryId: "c", enabled: true, creatorId: "oid2" },
    ];
    const nameMap = { oid1: "张三", oid2: "李四" };
    const result = attachCreatorNames(dishes, nameMap);
    expect(result[0].creatorName).toBe("张三");
    expect(result[1].creatorName).toBe("李四");
  });

  it("preserves existing creatorName", () => {
    const dishes: DishRecord[] = [
      { _id: "1", name: "a", categoryId: "c", enabled: true, creatorId: "oid1", creatorName: "王五" },
    ];
    const nameMap = { oid1: "张三" };
    const result = attachCreatorNames(dishes, nameMap);
    expect(result[0].creatorName).toBe("王五");
  });

  it("leaves dish without creatorId unchanged", () => {
    const dishes: DishRecord[] = [
      { _id: "1", name: "a", categoryId: "c", enabled: true },
    ];
    const nameMap = {};
    const result = attachCreatorNames(dishes, nameMap);
    expect(result[0].creatorName).toBeUndefined();
  });

  it("leaves creatorName undefined when creatorId not in map", () => {
    const dishes: DishRecord[] = [
      { _id: "1", name: "a", categoryId: "c", enabled: true, creatorId: "oid3" },
    ];
    const nameMap = { oid1: "张三" };
    const result = attachCreatorNames(dishes, nameMap);
    expect(result[0].creatorName).toBeUndefined();
  });

  it("does not mutate source dishes", () => {
    const dishes: DishRecord[] = [
      { _id: "1", name: "a", categoryId: "c", enabled: true, creatorId: "oid1" },
    ];
    const nameMap = { oid1: "张三" };
    attachCreatorNames(dishes, nameMap);
    expect(dishes[0].creatorName).toBeUndefined();
  });

  it("handles multiple dishes with same creatorId", () => {
    const dishes: DishRecord[] = [
      { _id: "1", name: "a", categoryId: "c", enabled: true, creatorId: "oid1" },
      { _id: "2", name: "b", categoryId: "c", enabled: true, creatorId: "oid1" },
    ];
    const nameMap = { oid1: "张三" };
    const result = attachCreatorNames(dishes, nameMap);
    expect(result[0].creatorName).toBe("张三");
    expect(result[1].creatorName).toBe("张三");
  });
});

// ── buildImportDishData ──────────────────────────────────────────────────────

describe("buildImportDishData", () => {
  it("copies name, categoryId, enabled, images, creatorId from source", () => {
    const source: DishRecord = {
      _id: "src1",
      name: "红烧肉",
      categoryId: "cat-meat",
      enabled: true,
      images: ["img1"],
      creatorId: "oid1",
      creatorName: "张三",
    };
    const result = buildImportDishData(source, "grp-target");
    expect(result.name).toBe("红烧肉");
    expect(result.categoryId).toBe("cat-meat");
    expect(result.enabled).toBe(true);
    expect(result.images).toEqual(["img1"]);
    expect(result.creatorId).toBe("oid1");
    expect(result.creatorName).toBe("张三");
  });

  it("sets groupId to target group", () => {
    const source: DishRecord = {
      _id: "src1",
      name: "红烧肉",
      categoryId: "cat-meat",
      enabled: true,
    };
    const result = buildImportDishData(source, "grp-target");
    expect(result.groupId).toBe("grp-target");
  });

  it("sets createdAt to current time (approx)", () => {
    const before = Date.now();
    const source: DishRecord = {
      _id: "src1",
      name: "红烧肉",
      categoryId: "cat-meat",
      enabled: true,
    };
    const result = buildImportDishData(source, "grp-target");
    const after = Date.now();
    expect(result.createdAt).toBeGreaterThanOrEqual(before);
    expect(result.createdAt).toBeLessThanOrEqual(after);
  });

  it("preserves disabled state from source", () => {
    const source: DishRecord = {
      _id: "src1",
      name: "红烧肉",
      categoryId: "cat-meat",
      enabled: false,
    };
    const result = buildImportDishData(source, "grp-target");
    expect(result.enabled).toBe(false);
  });

  it("does not include _id in result (type check)", () => {
    const source: DishRecord = {
      _id: "src1",
      name: "红烧肉",
      categoryId: "cat-meat",
      enabled: true,
    };
    const result = buildImportDishData(source, "grp-target");
    expect((result as Record<string, unknown>)._id).toBeUndefined();
  });

  it("handles source without optional fields", () => {
    const source: DishRecord = {
      _id: "src1",
      name: "红烧肉",
      categoryId: "cat-meat",
      enabled: true,
    };
    const result = buildImportDishData(source, "grp-target");
    expect(result.images).toBeUndefined();
    expect(result.creatorId).toBeUndefined();
    expect(result.creatorName).toBeUndefined();
  });
});
