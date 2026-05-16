/**
 * 私域小程序：静默登录后必有微信身份（wx_guest_user 或已绑定手机号的 user）。
 * 「已登录」指管理员在后台登记过的正式账号（含平台管理员）。
 */
export function isRegisteredMember(role: string | undefined | null): boolean {
  return role === 'user' || role === 'admin';
}

export function isWxGuestUser(role: string | undefined | null): boolean {
  return role === 'wx_guest_user';
}

/** 有本地 JWT（静默登录成功后即有） */
export function hasWechatSession(token: string | undefined | null): boolean {
  return Boolean(token && String(token).length > 0);
}
