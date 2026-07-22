import type { DrawResultGroup } from "@/lib/draw-engine";

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
