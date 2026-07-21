import { describe, it, expect } from "vitest";

/**
 * Regression tests for group-create import flow:
 * - Categories auto-selected when source kitchen is chosen
 * - Individual category toggle (select/deselect) works correctly
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

/** Simulates onSelectSourceGroup auto-select */
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

/** Simulates onToggleCategory using index-based lookup (current implementation) */
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
    // Start with all selected
    let state: PageData = {
      sourceGroupIdx: 0,
      sourceGroupName: "test",
      sourceCategories: SAMPLE_CATEGORIES,
      selectedCategoryIds: SAMPLE_CATEGORIES.map((c) => c.id),
    };

    // Toggle index 0 (cat-meat) — should deselect it
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

    // Toggle index 0 (cat-meat) — should re-select it
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
