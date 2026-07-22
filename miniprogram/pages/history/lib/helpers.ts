import { formatTime, type DrawHistoryRecord } from "@/lib/history";

/** 带显示字段的历史记录条目类型。 */
export interface EnrichedRecord extends DrawHistoryRecord {
  time: string;
  drawerLabel: string;
}

/**
 * 为历史记录注入显示字段（时间和抽取者标签）。
 * @param records - 原始历史记录数组
 * @returns 注入 time 和 drawerLabel 后的记录数组
 */
export function buildRecordDisplayFields(records: DrawHistoryRecord[]): EnrichedRecord[] {
  return records.map((r) => ({
    ...r,
    time: formatTime(r.confirmedAt),
    drawerLabel: r.drawerName ? `${r.drawerName}抽的` : "",
  }));
}
