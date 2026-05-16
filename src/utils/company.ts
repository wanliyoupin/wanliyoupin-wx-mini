import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';
import { userInfo } from '@/store/userStore';

/**
 * 获取用户管理的公司 ID 请使用 @/utils/auth 的 refreshManagedCompanyAfterLogin，
 * 登录后强制刷新角色缓存即可拿到 managedCompany 并写入公司上下文，无需单独请求。
 */

/** 用户已加入的公司（用于切换公司列表） */
export interface UserJoinedCompany {
  id: number;
  name: string;
  logo_url: string | null;
}

function resolveUserIdForCompanyQuery(forUserId?: number): number | null {
  const fromArg = forUserId != null ? Number(forUserId) : NaN;
  if (Number.isInteger(fromArg) && fromArg > 0) return fromArg;
  const fromStore = userInfo.value?.id != null ? Number(userInfo.value.id) : NaN;
  if (Number.isInteger(fromStore) && fromStore > 0) return fromStore;
  try {
    const raw = uni.getStorageSync('userId');
    if (raw === '' || raw == null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * 获取当前用户已加入的公司列表（id、name、logo），用于「切换公司」入口
 * @param forUserId 登录刚完成时可传入，避免与 Pinia 合并时序导致读不到 id
 */
export async function getUserJoinedCompanies(forUserId?: number): Promise<UserJoinedCompany[]> {
  const userId = resolveUserIdForCompanyQuery(forUserId);
  if (userId == null) {
    return [];
  }

  try {
    const query = `
      query GetUserJoinedCompanies($userId: bigint!) {
        company_users(
          where: { user_users: { _eq: $userId } }
          order_by: { id: asc }
        ) {
          company {
            id
            name
            logo_url
          }
        }
      }
    `;

    const result = await client.execute({
      query,
      variables: { userId },
    });

    if (!result?.company_users) return [];

    const list = result.company_users
      .map((cu: any) => cu.company)
      .filter((c: { id?: number } | null) => c?.id != null)
      .map((c: { id: number; name?: string; logo_url?: string | null }) => ({
        id: Number(c.id),
        name: c.name ?? '',
        logo_url: c.logo_url ?? null,
      }));

    // 去重（同一公司只保留一条）
    const seen = new Set<number>();
    return list.filter((c: UserJoinedCompany) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  } catch (error) {
    console.error('获取用户已加入公司列表失败:', error);
    return [];
  }
}

/**
 * 获取用户所属的公司ID列表（包括管理员和普通用户）
 */
export async function getUserCompanyIds(): Promise<number[]> {
  const companies = await getUserJoinedCompanies();
  return companies.map((c) => c.id);
}
