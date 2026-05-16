import { userInfo } from '@/store/userStore';
import { getUserJoinedCompanies } from '@/utils/company';
import { isRegisteredMember } from '@/utils/memberSession';

/**
 * 与 App.vue 一致：仅访客、或已登录但未加入任何公司时，允许分享/扫码等「入口参数」自动切换公司。
 * 正式 user且已加入 ≥1 家公司、或 admin：只能通过「切换公司」等手动操作改公司，避免被外链/太阳码拐跑。
 */
export async function shouldAllowAutoSwitchCompanyFromEntry(): Promise<boolean> {
  const role = userInfo.value?.role;
  if (role === 'admin') return false;
  if (!isRegisteredMember(role)) return true;
  const joined = await getUserJoinedCompanies();
  return joined.length === 0;
}
