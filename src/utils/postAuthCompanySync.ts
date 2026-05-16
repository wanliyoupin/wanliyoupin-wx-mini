import { syncCompanyInfo } from '@/api/company/index';
import { getUserJoinedCompanies } from '@/utils/company';
import { clearCompanyUserRoleCache, refreshManagedCompanyAfterLogin } from '@/utils/auth';

function readStoredCompanyId(): number | null {
  try {
    const raw = uni.getStorageSync('companyId');
    if (raw === '' || raw == null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function resolveUserIdAfterAuth(user: { id?: number }): number | null {
  const a = user?.id != null ? Number(user.id) : NaN;
  if (Number.isInteger(a) && a > 0) return a;
  try {
    const b = Number(uni.getStorageSync('userId'));
    if (Number.isInteger(b) && b > 0) return b;
  } catch (_) {}
  return null;
}

/**
 * 手机号/密码登录成功并已 setUserContext 后调用：
 * - 平台管理员：优先写入其作为「公司管理员」的公司；否则同普通成员规则处理已加入列表
 * - 普通用户：若本地 companyId 已在已加入列表中则保留（访客正在看的公司优先）；否则切到列表首条；未加入任何公司则保留本地；无本地且无公司则报错
 */
export async function syncCompanyContextAfterAuthLogin(user: {
  id?: number;
  role?: string;
}): Promise<void> {
  clearCompanyUserRoleCache();

  const authUserId = resolveUserIdAfterAuth(user);
  if (authUserId == null) {
    throw new Error('登录状态异常，请重试');
  }

  if (user.role === 'admin') {
    const managedId = await refreshManagedCompanyAfterLogin();
    if (managedId != null) {
      await syncCompanyInfo(managedId, true);
      return;
    }
    // users.role=admin 也可能仅以普通成员挂在某公司（company_users.role=user）
    const joinedAsAdminUser = await getUserJoinedCompanies(authUserId);
    if (joinedAsAdminUser.length > 0) {
      const local = readStoredCompanyId();
      const idSet = new Set(joinedAsAdminUser.map((j) => j.id));
      const targetId = local != null && idSet.has(local) ? local : joinedAsAdminUser[0].id;
      uni.setStorageSync('companyId', String(targetId));
      await syncCompanyInfo(targetId, true);
      return;
    }
    const local = readStoredCompanyId();
    if (local != null) {
      await syncCompanyInfo(local, true);
    }
    return;
  }

  const joined = await getUserJoinedCompanies(authUserId);
  if (joined.length > 0) {
    const local = readStoredCompanyId();
    const idSet = new Set(joined.map((j) => j.id));
    const targetId = local != null && idSet.has(local) ? local : joined[0].id;
    uni.setStorageSync('companyId', String(targetId));
    await syncCompanyInfo(targetId, true);
    return;
  }

  const local = readStoredCompanyId();
  if (local != null) {
    await syncCompanyInfo(local, true);
    return;
  }

  throw new Error('您的账号尚未加入任何公司，请联系管理员添加后再登录。');
}
