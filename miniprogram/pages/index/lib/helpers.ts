import { QUERY, HISTORY_WINDOW_DAYS } from "@/config";
import { attachDrawerNames, getTodaySummary, isToday, type DrawHistoryRecord } from "@/lib/history";
import type { Dish, DrawResultGroup } from "@/lib/draw-engine";

export interface DrawCard {
  id: string;
  categoryId: string;
  categoryName: string;
  dishId: string;
  dishName: string;
  imageUrl: string;
  flipped: boolean;
  redrawing: boolean;
}

/**
 * 将抽取结果转换为翻牌 UI 卡片数组。
 * @param results - drawDishes() 返回的抽取结果
 * @returns 卡片数组，每张卡片对应一道菜品
 */
export function buildDrawCards(results: DrawResultGroup[]): DrawCard[] {
  let cardIdx = 0;
  const cards: DrawCard[] = [];
  for (const group of results) {
    for (const dish of group.dishes) {
      const imageUrl = dish.images && dish.images.length > 0 ? dish.images[0] : "";
      cards.push({
        id: `card-${cardIdx}`,
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        dishId: dish.id,
        dishName: dish.name,
        imageUrl,
        flipped: false,
        redrawing: false,
      });
      cardIdx++;
    }
  }
  return cards;
}

/**
 * 将翻牌后的卡片数组反序列化为 draw_history 的 results 格式。
 * @param cards - 翻牌完成后的卡片数组
 * @returns 按分类分组的记录条目
 */
export function cardsToResults(
  cards: DrawCard[],
): Array<{
  categoryId: string;
  categoryName: string;
  dishes: Array<{ dishId: string; dishName: string; imageUrl: string }>;
}> {
  const resultMap = new Map<string, {
    categoryId: string;
    categoryName: string;
    dishes: Array<{ dishId: string; dishName: string; imageUrl: string }>;
  }>();

  for (const card of cards) {
    let group = resultMap.get(card.categoryId);
    if (!group) {
      group = {
        categoryId: card.categoryId,
        categoryName: card.categoryName,
        dishes: [],
      };
      resultMap.set(card.categoryId, group);
    }
    group.dishes.push({
      dishId: card.dishId,
      dishName: card.dishName,
      imageUrl: card.imageUrl,
    });
  }

  return [...resultMap.values()];
}

/**
 * 将超期的抽取记录标记为 archived。
 * @param db - 云数据库实例
 * @param groupId - 当前群组 ID
 */
export async function archiveOldRecords(
  db: ReturnType<typeof wx.cloud.database>,
  groupId: string,
): Promise<void> {
  const cutoff = Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  try {
    const PAGE_SIZE = QUERY.LIMIT_GENERIC_MAX;
    let skip = 0;
    let hasMore = true;
    while (hasMore) {
      const res = await db.collection("draw_history")
        .where({
          groupId,
          status: "active",
          confirmedAt: db.command.lt(cutoff),
        })
        .field({ _id: true })
        .limit(PAGE_SIZE)
        .skip(skip)
        .get();

      const batch = res.data as Array<{ _id: string }>;
      for (const item of batch) {
        await db.collection("draw_history")
          .doc(item._id)
          .update({ data: { status: "archived" } });
      }
      skip += batch.length;
      hasMore = batch.length > 0;
    }
  } catch (err) {
    console.error("[index] archive old records failed", err);
  }
}

/**
 * 分页加载群组内所有启用的菜品。
 * @param db - 云数据库实例
 * @param groupId - 当前群组 ID
 * @returns Dish 数组
 */
export async function loadEnabledDishes(
  db: ReturnType<typeof wx.cloud.database>,
  groupId: string,
): Promise<Dish[]> {
  const PAGE_SIZE = QUERY.LIMIT_GENERIC_MAX;
  type RawDish = {
    _id: string;
    name: string;
    categoryId: string;
    enabled: boolean;
    images?: string[];
  };
  let allRaw: RawDish[] = [];
  let skip = 0;
  let hasMore = true;
  while (hasMore) {
    const res = await db.collection("dishes")
      .where({ groupId, enabled: true })
      .limit(PAGE_SIZE)
      .skip(skip)
      .get();
    const batch = res.data as RawDish[];
    allRaw = allRaw.concat(batch);
    skip += batch.length;
    hasMore = batch.length > 0;
  }

  return allRaw.map((d) => ({
    id: d._id,
    name: d.name,
    categoryId: d.categoryId,
    enabled: d.enabled,
    images: d.images,
  }));
}

/**
 * 加载今日抽取记录（含抽取者昵称解析）并生成摘要文本。
 * @param db - 云数据库实例
 * @param groupId - 当前群组 ID
 * @param memberCount - 当前群组成员数
 * @returns 今日记录数组和摘要文本
 */
export async function loadTodayRecords(
  db: ReturnType<typeof wx.cloud.database>,
  groupId: string,
  memberCount: number,
): Promise<{
  summary: string;
  records: DrawHistoryRecord[];
}> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);
  const res = await db.collection("draw_history")
    .where({
      groupId,
      status: "active",
      confirmedAt: db.command.gte(dayStart.getTime()).and(
        db.command.lte(dayEnd.getTime()),
      ),
    })
    .orderBy("confirmedAt", "desc")
    .limit(QUERY.LIMIT_USER_CONFIG)
    .get();

  let records = (res.data as DrawHistoryRecord[]).filter((r) =>
    isToday(r.confirmedAt),
  );

  if (records.length > 0 && memberCount > 1) {
    const drawerIds = [
      ...new Set(records.map((r) => r.drawerId).filter(Boolean)),
    ] as string[];
    if (drawerIds.length > 0) {
      const nameMap: Record<string, string> = {};
      const userRes = await db.collection("users")
        .where({ _openid: db.command.in(drawerIds) })
        .get();
      for (const user of userRes.data as Array<{
        _openid: string;
        nickName: string;
      }>) {
        nameMap[user._openid] = user.nickName;
      }
      records = attachDrawerNames(records, nameMap);
    }
  }

  const summary = getTodaySummary(records, memberCount);
  return { summary, records };
}
