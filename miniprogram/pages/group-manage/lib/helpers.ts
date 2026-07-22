/**
 * 将用户档案数组转换为 { openid: nickName } 映射。
 */
export function buildProfileMap(profiles: Array<{ _openid: string; nickName: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of profiles) {
    map[p._openid] = p.nickName;
  }
  return map;
}

/**
 * 根据 openid 生成默认昵称 —— "用户" + openid 后 6 位。
 */
export function buildFallbackNickname(openid: string): string {
  return `用户${openid.slice(-6)}`;
}

/**
 * 根据成员 openid 列表和昵称映射，生成成员信息列表。
 * 若无昵称，使用 buildFallbackNickname 生成默认昵称，首字取昵称第一个字。
 */
export function buildMemberInfoList(
  memberOpenids: string[],
  profileMap: Record<string, string>,
  groupOwnerOpenid: string,
): Array<{
  openid: string;
  nickName: string;
  initial: string;
  isOwner: boolean;
}> {
  return memberOpenids.map((openid) => {
    const nickName = profileMap[openid] || buildFallbackNickname(openid);
    return {
      openid,
      nickName,
      initial: nickName.charAt(0),
      isOwner: openid === groupOwnerOpenid,
    };
  });
}
