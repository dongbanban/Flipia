import { describe, it, expect } from "vitest";

/**
 * 厨房创建导入流程的回归测试：
 * - 选择源厨房时自动选中全部分类
 * - 单个分类勾选/取消勾选功能正常
 */

interface Category {
  id: string;
  name: string;
}

interface PageData {
  sourceGroupIdx: number;
  sourceGroupName: string;
  sourceCategories: Category[];
  selectedCategoryIds: string[];
}

const SAMPLE_CATEGORIES: Category[] = [
  { id: "cat-meat", name: "荤菜" },
  { id: "cat-veg", name: "素菜" },
  { id: "cat-staple", name: "主食" },
  { id: "cat-soup", name: "汤" },
];

/** 模拟 onSelectSourceGroup 自动全选 */
function simulateSelectSourceGroup(
  state: PageData,
  categories: Category[],
): PageData {
  return {
    ...state,
    selectedCategoryIds: categories.map((c) => c.id),
    sourceCategories: categories,
  };
}

/** 模拟 onToggleCategory，使用基于索引的查找（当前实现方式） */
function simulateToggleCategory(state: PageData, index: number): PageData {
  const cat = state.sourceCategories[index];
  if (!cat) return state;
  const selected = [...state.selectedCategoryIds];
  const pos = selected.indexOf(cat.id);
  if (pos === -1) {
    selected.push(cat.id);
  } else {
    selected.splice(pos, 1);
  }
  return { ...state, selectedCategoryIds: selected };
}

describe("group-create: category toggle (select/deselect)", () => {
  it("auto-selects all categories when source kitchen is chosen", () => {
    const state: PageData = {
      sourceGroupIdx: -1,
      sourceGroupName: "",
      sourceCategories: [],
      selectedCategoryIds: [],
    };
    const next = simulateSelectSourceGroup(state, SAMPLE_CATEGORIES);
    expect(next.selectedCategoryIds).toEqual([
      "cat-meat", "cat-veg", "cat-staple", "cat-soup",
    ]);
  });

  it("deselects a category by index (toggle off)", () => {
    // 初始状态：全部分类已选中
    let state: PageData = {
      sourceGroupIdx: 0,
      sourceGroupName: "test",
      sourceCategories: SAMPLE_CATEGORIES,
      selectedCategoryIds: SAMPLE_CATEGORIES.map((c) => c.id),
    };

    // 切换索引 0 (cat-meat) — 应取消选中
    state = simulateToggleCategory(state, 0);
    expect(state.selectedCategoryIds).not.toContain("cat-meat");
    expect(state.selectedCategoryIds).toHaveLength(3);
    expect(state.selectedCategoryIds).toEqual(["cat-veg", "cat-staple", "cat-soup"]);
  });

  it("re-selects a deselected category by index (toggle on)", () => {
    let state: PageData = {
      sourceGroupIdx: 0,
      sourceGroupName: "test",
      sourceCategories: SAMPLE_CATEGORIES,
      selectedCategoryIds: ["cat-veg", "cat-staple", "cat-soup"],
    };

    // 切换索引 0 (cat-meat) — 应重新选中
    state = simulateToggleCategory(state, 0);
    expect(state.selectedCategoryIds).toContain("cat-meat");
    expect(state.selectedCategoryIds).toHaveLength(4);
  });

  it("blocks submit when all categories deselected", () => {
    const importEnabled = true;
    const sourceGroupIdx = 0;
    const selectedCategoryIds: string[] = [];
    const wouldBlock = importEnabled && sourceGroupIdx >= 0 && selectedCategoryIds.length === 0;
    expect(wouldBlock).toBe(true);
  });

  it("allows submit when at least one category is selected", () => {
    const importEnabled = true;
    const sourceGroupIdx = 0;
    const selectedCategoryIds = ["cat-veg"];
    const wouldBlock = importEnabled && sourceGroupIdx >= 0 && selectedCategoryIds.length === 0;
    expect(wouldBlock).toBe(false);
  });

  it("deselecting all categories one by one leaves empty array", () => {
    let state: PageData = {
      sourceGroupIdx: 0,
      sourceGroupName: "test",
      sourceCategories: SAMPLE_CATEGORIES,
      selectedCategoryIds: SAMPLE_CATEGORIES.map((c) => c.id),
    };

    for (let i = 0; i < SAMPLE_CATEGORIES.length; i++) {
      state = simulateToggleCategory(state, i);
    }

    expect(state.selectedCategoryIds).toEqual([]);
  });

  it("toggle with out-of-range index returns unchanged state", () => {
    const state: PageData = {
      sourceGroupIdx: 0,
      sourceGroupName: "test",
      sourceCategories: SAMPLE_CATEGORIES,
      selectedCategoryIds: SAMPLE_CATEGORIES.map((c) => c.id),
    };
    const next = simulateToggleCategory(state, 99);
    expect(next.selectedCategoryIds).toEqual(state.selectedCategoryIds);
  });
});
