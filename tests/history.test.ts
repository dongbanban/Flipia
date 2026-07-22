import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isToday,
  isYesterday,
  formatDateLabel,
  formatTime,
  toDateKey,
  groupByDay,
  attachDrawerNames,
  getTodaySummary,
  type DrawHistoryRecord,
} from "../miniprogram/lib/history";

function makeRecord(
  id: string,
  drawerId: string,
  confirmedAt: number,
  overrides: Partial<DrawHistoryRecord> = {},
): DrawHistoryRecord {
  return {
    _id: id,
    drawerId,
    status: "active",
    results: [
      {
        categoryId: "cat-meat",
        categoryName: "荤菜",
        dishes: [{ dishId: "d1", dishName: "红烧排骨", imageUrl: "" }],
      },
    ],
    confirmedAt,
    ...overrides,
  };
}

function withDrawerName(r: DrawHistoryRecord, name: string): DrawHistoryRecord {
  return { ...r, drawerName: name };
}

function local(year: number, month: number, day: number, hours = 0, minutes = 0): number {
  return new Date(year, month - 1, day, hours, minutes).getTime();
}

function setNow(year: number, month: number, day: number, hours = 0): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(year, month - 1, day, hours).getTime());
}

afterEach(() => {
  vi.useRealTimers();
});

describe("isToday", () => {
  it("returns true for today", () => {
    setNow(2026, 7, 20, 10);
    expect(isToday(local(2026, 7, 20, 8, 30))).toBe(true);
  });

  it("returns false for yesterday", () => {
    setNow(2026, 7, 20, 10);
    expect(isToday(local(2026, 7, 19, 23, 59))).toBe(false);
  });

  it("returns false for a week ago", () => {
    setNow(2026, 7, 20, 10);
    expect(isToday(local(2026, 7, 13, 12))).toBe(false);
  });
});

describe("isYesterday", () => {
  it("returns true for yesterday", () => {
    setNow(2026, 7, 20, 10);
    expect(isYesterday(local(2026, 7, 19, 12))).toBe(true);
  });

  it("returns false for today", () => {
    setNow(2026, 7, 20, 10);
    expect(isYesterday(local(2026, 7, 20, 8))).toBe(false);
  });

  it("returns true across month boundary (Jan 1 → Dec 31)", () => {
    setNow(2026, 1, 1, 10);
    expect(isYesterday(local(2025, 12, 31, 23))).toBe(true);
  });
});

describe("formatDateLabel", () => {
  it("formats as M月D日", () => {
    expect(formatDateLabel(local(2026, 7, 15, 12))).toBe("7月15日");
  });

  it("handles single-digit month/day without padding", () => {
    expect(formatDateLabel(local(2026, 1, 3))).toBe("1月3日");
  });
});

describe("formatTime", () => {
  it("formats HH:mm with zero padding", () => {
    expect(formatTime(local(2026, 7, 20, 8, 5))).toBe("08:05");
  });

  it("pads single-digit hours", () => {
    expect(formatTime(local(2026, 7, 20, 0, 0))).toBe("00:00");
  });
});

describe("toDateKey", () => {
  it("returns YYYY-MM-DD", () => {
    expect(toDateKey(local(2026, 7, 20, 12))).toBe("2026-07-20");
  });
});

describe("groupByDay", () => {
  it("groups records by day and labels today/yesterday/date", () => {
    setNow(2026, 7, 20, 10);

    const records = [
      makeRecord("r1", "a", local(2026, 7, 20, 8)),
      makeRecord("r2", "a", local(2026, 7, 20, 12)),
      makeRecord("r3", "b", local(2026, 7, 19, 18)),
      makeRecord("r4", "a", local(2026, 7, 18, 19)),
    ];

    const groups = groupByDay(records);
    expect(groups).toHaveLength(3);
    expect(groups[0].label).toBe("今天");
    expect(groups[0].records).toHaveLength(2);
    expect(groups[1].label).toBe("昨天");
    expect(groups[1].records).toHaveLength(1);
    expect(groups[2].label).toBe("7月18日");
    expect(groups[2].records).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(groupByDay([])).toEqual([]);
  });

  it("single record returns one group", () => {
    setNow(2026, 7, 20, 10);
    const records = [makeRecord("r1", "a", local(2026, 7, 20, 8))];
    const groups = groupByDay(records);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("今天");
  });

  it("groups sorted by date descending (newest first)", () => {
    setNow(2026, 7, 20, 10);
    const records = [
      makeRecord("r1", "a", local(2026, 7, 20, 8)),
      makeRecord("r2", "a", local(2026, 7, 19, 18)),
      makeRecord("r3", "b", local(2026, 7, 18, 19)),
    ];
    const groups = groupByDay(records);
    expect(groups).toHaveLength(3);
    expect(groups[0].date).toBe("2026-07-20");
    expect(groups[1].date).toBe("2026-07-19");
    expect(groups[2].date).toBe("2026-07-18");
  });
});

describe("attachDrawerNames", () => {
  it("attaches drawer names from name map", () => {
    const records = [
      makeRecord("r1", "openid-a", 1000),
      makeRecord("r2", "openid-b", 2000),
    ];
    const nameMap = { "openid-a": "张三", "openid-b": "李四" };

    const result = attachDrawerNames(records, nameMap);
    expect(result[0].drawerName).toBe("张三");
    expect(result[1].drawerName).toBe("李四");
  });

  it("does not overwrite existing drawerName", () => {
    const records = [withDrawerName(makeRecord("r1", "openid-a", 1000), "王五")];
    const nameMap = { "openid-a": "张三" };

    const result = attachDrawerNames(records, nameMap);
    expect(result[0].drawerName).toBe("王五");
  });

  it("leaves record unchanged when drawerId not in map", () => {
    const records = [makeRecord("r1", "unknown-id", 1000)];
    const nameMap = { "openid-a": "张三" };

    const result = attachDrawerNames(records, nameMap);
    expect(result[0].drawerName).toBeUndefined();
  });

  it("leaves record unchanged when drawerId is missing", () => {
    const records = [{ ...makeRecord("r1", "", 1000), drawerId: "" }];
    const nameMap = { "openid-a": "张三" };

    const result = attachDrawerNames(records, nameMap);
    expect(result[0].drawerName).toBeUndefined();
  });
});

describe("getTodaySummary", () => {
  it("returns empty string for no records", () => {
    expect(getTodaySummary([], 2)).toBe("");
  });

  it("does not show drawer names when memberCount <= 1", () => {
    const records = [withDrawerName(makeRecord("r1", "a", 1000), "张三")];
    expect(getTodaySummary(records, 1)).toBe("今天抽了 1 次");
  });

  it("shows single drawer name when memberCount > 1 and one drawer", () => {
    const records = [
      withDrawerName(makeRecord("r1", "a", 1000), "张三"),
      withDrawerName(makeRecord("r2", "a", 2000), "张三"),
    ];
    expect(getTodaySummary(records, 3)).toBe("张三 今天抽了 2 次");
  });

  it("shows multiple drawer names separated by 、 when memberCount > 1", () => {
    const records = [
      withDrawerName(makeRecord("r1", "a", 1000), "张三"),
      withDrawerName(makeRecord("r2", "b", 2000), "李四"),
      withDrawerName(makeRecord("r3", "a", 3000), "张三"),
    ];
    expect(getTodaySummary(records, 3)).toBe("张三、李四 今天抽了 3 次");
  });

  it("deduplicates drawer names in order of first appearance", () => {
    const records = [
      withDrawerName(makeRecord("r1", "b", 1000), "李四"),
      withDrawerName(makeRecord("r2", "a", 2000), "张三"),
      withDrawerName(makeRecord("r3", "b", 3000), "李四"),
    ];
    expect(getTodaySummary(records, 3)).toBe("李四、张三 今天抽了 3 次");
  });

  it("caps at 3 drawer names with 等人 suffix", () => {
    const records = [
      withDrawerName(makeRecord("r1", "a", 1000), "张三"),
      withDrawerName(makeRecord("r2", "b", 2000), "李四"),
      withDrawerName(makeRecord("r3", "c", 3000), "王五"),
      withDrawerName(makeRecord("r4", "d", 4000), "赵六"),
    ];
    expect(getTodaySummary(records, 5)).toBe("张三、李四、王五等人 今天抽了 4 次");
  });

  it("falls back to no names when drawer names are empty", () => {
    const records = [makeRecord("r1", "a", 1000)];
    expect(getTodaySummary(records, 3)).toBe("今天抽了 1 次");
  });

  it("exactly 3 unique drawers shows all names without 等人 suffix", () => {
    const records = [
      withDrawerName(makeRecord("r1", "a", 1000), "张三"),
      withDrawerName(makeRecord("r2", "b", 2000), "李四"),
      withDrawerName(makeRecord("r3", "c", 3000), "王五"),
    ];
    expect(getTodaySummary(records, 4)).toBe("张三、李四、王五 今天抽了 3 次");
  });

  it("shows names when memberCount is exactly 2", () => {
    const records = [
      withDrawerName(makeRecord("r1", "a", 1000), "张三"),
      withDrawerName(makeRecord("r2", "b", 2000), "李四"),
    ];
    expect(getTodaySummary(records, 2)).toBe("张三、李四 今天抽了 2 次");
  });
});
