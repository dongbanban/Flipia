import { describe, it, expect } from "vitest";
import { drawDishes, validateDrawConfig } from "../miniprogram/lib/draw-engine";
import type { Dish, DrawConfigEntry } from "../miniprogram/lib/draw-engine";

// ── 辅助函数 ──────────────────────────────────────────────────────────────────

function makeDish(
  id: string,
  categoryId: string,
  overrides: Partial<Dish> = {},
): Dish {
  return { id, name: `dish-${id}`, categoryId, enabled: true, ...overrides };
}

function makeDishWithImages(
  id: string,
  categoryId: string,
  images: string[],
): Dish {
  return { id, name: `dish-${id}`, categoryId, enabled: true, images };
}

const MEAT = "cat-meat";
const VEG = "cat-veg";

const POOL: Dish[] = [
  makeDish("m1", MEAT),
  makeDish("m2", MEAT),
  makeDish("m3", MEAT),
  makeDish("v1", VEG),
  makeDish("v2", VEG),
];

const CONFIG: DrawConfigEntry[] = [
  { categoryId: MEAT, categoryName: "肉菜", count: 2 },
  { categoryId: VEG, categoryName: "蔬菜", count: 1 },
];

// ── drawDishes ────────────────────────────────────────────────────────────────

describe("drawDishes", () => {
  it("returns one group per config entry", () => {
    const result = drawDishes(POOL, CONFIG);
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.categoryId)).toEqual([MEAT, VEG]);
  });

  it("draws the requested count per category", () => {
    const result = drawDishes(POOL, CONFIG);
    const meatGroup = result.find((g) => g.categoryId === MEAT)!;
    const vegGroup = result.find((g) => g.categoryId === VEG)!;
    expect(meatGroup.dishes).toHaveLength(2);
    expect(vegGroup.dishes).toHaveLength(1);
  });

  it("each result group includes categoryName from config", () => {
    const result = drawDishes(POOL, CONFIG);
    const meatGroup = result.find((g) => g.categoryId === MEAT)!;
    const vegGroup = result.find((g) => g.categoryId === VEG)!;
    expect(meatGroup.categoryName).toBe("肉菜");
    expect(vegGroup.categoryName).toBe("蔬菜");
  });

  it("preserves dish images in draw result", () => {
    const pool: Dish[] = [
      makeDishWithImages("m1", MEAT, ["cloud://img1.jpg", "cloud://img2.jpg"]),
      makeDish("m2", MEAT),
    ];
    const config: DrawConfigEntry[] = [
      { categoryId: MEAT, categoryName: "肉菜", count: 2 },
    ];
    const result = drawDishes(pool, config);
    const m1 = result[0].dishes.find((d) => d.id === "m1");
    expect(m1?.images).toEqual(["cloud://img1.jpg", "cloud://img2.jpg"]);
  });

  it("dishes in a group all belong to that category", () => {
    const result = drawDishes(POOL, CONFIG);
    for (const group of result) {
      for (const dish of group.dishes) {
        expect(dish.categoryId).toBe(group.categoryId);
      }
    }
  });

  it("no duplicates within the same category group", () => {
    // 运行 20 次以检测任何意外重复
    for (let i = 0; i < 20; i++) {
      const result = drawDishes(POOL, CONFIG);
      for (const group of result) {
        const ids = group.dishes.map((d) => d.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("draws from pool only — returned dishes are in the pool", () => {
    const result = drawDishes(POOL, CONFIG);
    const poolIds = new Set(POOL.map((d) => d.id));
    for (const group of result) {
      for (const dish of group.dishes) {
        expect(poolIds.has(dish.id)).toBe(true);
      }
    }
  });

  it("defensive: count > available → takes all available, no error", () => {
    const config: DrawConfigEntry[] = [
      { categoryId: VEG, categoryName: "蔬菜", count: 99 },
    ];
    const result = drawDishes(POOL, config);
    expect(result[0].dishes).toHaveLength(2); // 仅有 2 道素菜
  });

  it("empty pool → all groups have 0 dishes", () => {
    const result = drawDishes([], CONFIG);
    for (const group of result) {
      expect(group.dishes).toHaveLength(0);
    }
  });

  it("empty config → returns empty array", () => {
    expect(drawDishes(POOL, [])).toEqual([]);
  });

  it("randomness: multiple calls return different orderings over many runs", () => {
    // 从 3 道荤菜中抽 3 道 — 多次调用顺序应不同
    const allMeat: Dish[] = [
      makeDish("m1", MEAT),
      makeDish("m2", MEAT),
      makeDish("m3", MEAT),
    ];
    const cfg: DrawConfigEntry[] = [
      { categoryId: MEAT, categoryName: "肉菜", count: 3 },
    ];
    const orders = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const order = drawDishes(allMeat, cfg)[0]
        .dishes.map((d) => d.id)
        .join(",");
      orders.add(order);
    }
    // 有 3! = 6 种可能顺序，运行 30 次仅出现 1 种的概率极低
    expect(orders.size).toBeGreaterThan(1);
  });
});

// ── validateDrawConfig ────────────────────────────────────────────────────────

describe("validateDrawConfig", () => {
  it("returns valid when all categories have enough dishes", () => {
    const result = validateDrawConfig(POOL, CONFIG);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("returns invalid when a category has insufficient dishes", () => {
    const config: DrawConfigEntry[] = [
      { categoryId: VEG, categoryName: "蔬菜", count: 5 }, // 仅有 2 道素菜
    ];
    const result = validateDrawConfig(POOL, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("reason includes category name and required count", () => {
    const config: DrawConfigEntry[] = [
      { categoryId: VEG, categoryName: "蔬菜", count: 5 },
    ];
    const { reason } = validateDrawConfig(POOL, config);
    expect(reason).toContain("蔬菜");
    expect(reason).toContain("5");
  });

  it("returns invalid for the first failing category", () => {
    const config: DrawConfigEntry[] = [
      { categoryId: MEAT, categoryName: "肉菜", count: 10 }, // 该分类最先不满足
      { categoryId: VEG, categoryName: "蔬菜", count: 1 },
    ];
    const { valid, reason } = validateDrawConfig(POOL, config);
    expect(valid).toBe(false);
    expect(reason).toContain("肉菜");
  });

  it("empty pool → invalid (if any count > 0)", () => {
    const result = validateDrawConfig([], CONFIG);
    expect(result.valid).toBe(false);
  });

  it("empty config → valid (nothing to violate)", () => {
    const result = validateDrawConfig(POOL, []);
    expect(result.valid).toBe(true);
  });

  it("count 0 for a category → valid", () => {
    const config: DrawConfigEntry[] = [
      { categoryId: VEG, categoryName: "蔬菜", count: 0 },
    ];
    const result = validateDrawConfig(POOL, config);
    expect(result.valid).toBe(true);
  });
});
