export interface DrawHistoryDish {
  dishId: string;
  dishName: string;
  imageUrl: string;
}

export interface DrawHistoryResultGroup {
  categoryId: string;
  categoryName: string;
  dishes: DrawHistoryDish[];
}

export interface DrawHistoryRecord {
  _id: string;
  drawerId: string;
  drawerName?: string;
  status: "active" | "archived";
  results: DrawHistoryResultGroup[];
  images?: string[];
  confirmedAt: number;
}

export interface DayGroup {
  label: string;
  date: string;
  records: DrawHistoryRecord[];
}

export function isToday(ts: number): boolean {
  const d = new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function isYesterday(ts: number): boolean {
  const d = new Date(ts);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  );
}

export function formatDateLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function toDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function groupByDay(records: DrawHistoryRecord[]): DayGroup[] {
  const map = new Map<string, DrawHistoryRecord[]>();
  for (const r of records) {
    const key = toDateKey(r.confirmedAt);
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return [...map.entries()].map(([date, recs]) => ({
    label: isToday(recs[0].confirmedAt)
      ? "今天"
      : isYesterday(recs[0].confirmedAt)
        ? "昨天"
        : formatDateLabel(recs[0].confirmedAt),
    date,
    records: recs,
  }));
}

export function attachDrawerNames(
  records: DrawHistoryRecord[],
  nameMap: Record<string, string>,
): DrawHistoryRecord[] {
  return records.map((r) => {
    if (r.drawerName) return r;
    const name = r.drawerId ? nameMap[r.drawerId] : undefined;
    return name ? { ...r, drawerName: name } : r;
  });
}

export function getTodaySummary(
  todayRecords: DrawHistoryRecord[],
  memberCount: number,
): string {
  const count = todayRecords.length;
  if (count === 0) return "";

  if (memberCount <= 1) {
    return `今天抽了 ${count} 次`;
  }

  const seen = new Set<string>();
  const ordered = todayRecords
    .map((r) => r.drawerName ?? "")
    .filter((n) => n && !seen.has(n) && seen.add(n));

  if (ordered.length === 0) return `今天抽了 ${count} 次`;

  const names = ordered;
  const drawerStr =
    names.length === 1
      ? names[0]
      : names.slice(0, 3).join("、") +
        (names.length > 3 ? "等人" : "");

  return `${drawerStr} 今天抽了 ${count} 次`;
}
