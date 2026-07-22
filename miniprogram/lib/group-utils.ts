/** 群组列表项目的精简类型 —— 仅包含 getMemberCount 需要的字段。 */
interface GroupLike {
  _id: string;
  members: string[];
}

/**
 * 从群组列表中查找指定群组的成员数。
 * 若找不到该群组则返回 0。
 */
export function getMemberCount(
  groups: GroupLike[],
  groupId: string,
): number {
  const group = groups.find((g) => g._id === groupId);
  return group ? group.members.length : 0;
}
