import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';
import { userInfo, companyInfo, setCompanyContext } from '@/store/userStore';

const ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

/** 用户管理的公司（仅当无 companyId 时查询并返回） */
export interface ManagedCompanyInfo {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface CompanyUserRoleResult {
  isAdmin: boolean;
  canViewPrice: boolean;
  priceFactor: number;
  /** 仅当无 companyId 且用户为某公司管理员时存在 */
  managedCompany?: ManagedCompanyInfo;
}

interface RoleCacheEntry {
  data: CompanyUserRoleResult;
  ts: number;
}
/** 缓存 key：companyId 为 0 表示「管理的公司」查询结果 */
let roleCache: { userId: number; companyKey: number; entry: RoleCacheEntry } | null = null;

/** company_users 行 + 嵌套公司策略（与 companies 表 mode_for_price / default_* 一致） */
type CompanyUserPolicyRow = {
  can_view_price: boolean;
  price_factor: number | string;
  company?: {
    mode_for_price?: string | null;
    default_for_price_factor?: number | string | null;
    default_for_can_view_price?: boolean | null;
  } | null;
};

/**
 * mode=company 时用公司 default_for_price_factor；否则用 company_users.price_factor。
 * company_users 嵌套 company 在部分权限下字段可能为空，此时用当前上下文的 companyInfo（syncCompanyInfo 已拉取）补齐。
 */
function resolveEffectivePriceFactor(row: CompanyUserPolicyRow): number {
  const ci = companyInfo.value as {
    mode_for_price?: string | null;
    default_for_price_factor?: number | string | null;
  } | null;
  const mode = row.company?.mode_for_price ?? ci?.mode_for_price ?? null;
  const companyFactor = Number(
    row.company?.default_for_price_factor ?? ci?.default_for_price_factor ?? 1
  );
  const userFactor = Number(row.price_factor ?? 1);
  if (mode === 'company' && companyFactor > 0) return companyFactor;
  if (userFactor > 0) return userFactor;
  return 1;
}

/**
 * mode=company：users.role=wx_guest_user 用 default_for_can_view_price；其余正式成员一律可看价。
 * mode=user：company_users.can_view_price；无 company_users 行时由 fetchCompanyPriceWhenNoMembership（公司 default_*）。
 */
function resolveEffectiveCanViewPrice(
  row: CompanyUserPolicyRow,
  appUserRole: string | null | undefined
): boolean {
  const ci = companyInfo.value as {
    mode_for_price?: string | null;
    default_for_can_view_price?: boolean | null;
  } | null;
  const mode = row.company?.mode_for_price ?? ci?.mode_for_price ?? null;
  const companyCan = Boolean(
    row.company?.default_for_can_view_price ?? ci?.default_for_can_view_price ?? false
  );
  const userCan = Boolean(row.can_view_price);
  if (mode === 'company') {
    if (appUserRole === 'wx_guest_user') return companyCan;
    return true;
  }
  return userCan;
}

/**
 * 当前公司下无 company_users 行时（含微信访客、尚未被管理员拉进成员表的账号）：
 * 按 companies.default_for_can_view_price、default_for_price_factor 展示，与「按用户」模式下新成员默认值一致。
 */
async function fetchCompanyPriceWhenNoMembership(
  companyId: number
): Promise<CompanyUserRoleResult | null> {
  try {
    const res = (await client.execute({
      query: `
        query CompanyDefaultsWhenNoMembership($id: bigint!) {
          companies_by_pk(id: $id) {
            default_for_price_factor
            default_for_can_view_price
          }
        }
      `,
      variables: { id: companyId },
    })) as {
      companies_by_pk?: {
        default_for_price_factor?: number | string | null;
        default_for_can_view_price?: boolean | null;
      } | null;
    };
    const c = res?.companies_by_pk;
    if (!c) return null;
    const pf = Number(c.default_for_price_factor ?? 1);
    return {
      isAdmin: false,
      canViewPrice: Boolean(c.default_for_can_view_price),
      priceFactor: pf > 0 ? pf : 1,
    };
  } catch (e) {
    console.error('fetchCompanyPriceWhenNoMembership', e);
    return null;
  }
}

/** 清除角色缓存，登录后调用以强制下次使用最新数据 */
export function clearCompanyUserRoleCache(): void {
  roleCache = null;
}

/**
 * 检查用户是否是平台管理员
 */
export async function isPlatformAdmin(): Promise<boolean> {
  if (!userInfo.value?.id) {
    return false;
  }

  try {
    const query = `
      query CheckPlatformAdmin($userId: bigint!) {
        users_by_pk(id: $userId) {
          id
          role
        }
      }
    `;

    const result = await client.execute({
      query,
      variables: { userId: Number(userInfo.value.id) },
    });

    return result?.users_by_pk?.role === 'admin';
  } catch (error) {
    console.error('检查平台管理员失败:', error);
    return false;
  }
}

/**
 * 检查用户是否是公司管理员
 * @param companyId 公司ID，如果不传则使用当前公司ID
 */
export async function isCompanyAdmin(companyId?: number): Promise<boolean> {
  if (!userInfo.value?.id) {
    return false;
  }

  const targetCompanyId = companyId || companyInfo.value?.id;
  if (!targetCompanyId) {
    return false;
  }

  try {
    const query = `
      query CheckCompanyAdmin($userId: bigint!, $companyId: bigint!) {
        company_users(
          where: {
            user_users: { _eq: $userId }
            company_companies: { _eq: $companyId }
            role: { _eq: "admin" }
          }
          limit: 1
        ) {
          id
        }
      }
    `;

    const result = await client.execute({
      query,
      variables: {
        userId: Number(userInfo.value.id),
        companyId: Number(targetCompanyId),
      },
    });

    return (result?.company_users?.length || 0) > 0;
  } catch (error) {
    console.error('检查公司管理员失败:', error);
    return false;
  }
}

/**
 * 检查用户是否是公司用户（包括管理员和普通用户）
 * @param companyId 公司ID，如果不传则使用当前公司ID
 */
export async function isCompanyUser(companyId?: number): Promise<boolean> {
  if (!userInfo.value?.id) {
    return false;
  }

  const targetCompanyId = companyId || companyInfo.value?.id;
  if (!targetCompanyId) {
    return false;
  }

  try {
    const query = `
      query CheckCompanyUser($userId: bigint!, $companyId: bigint!) {
        company_users(
          where: {
            user_users: { _eq: $userId }
            company_companies: { _eq: $companyId }
          }
          limit: 1
        ) {
          id
        }
      }
    `;

    const result = await client.execute({
      query,
      variables: {
        userId: Number(userInfo.value.id),
        companyId: Number(targetCompanyId),
      },
    });

    return (result?.company_users?.length || 0) > 0;
  } catch (error) {
    console.error('检查公司用户失败:', error);
    return false;
  }
}

/**
 * 获取用户在公司中的角色信息（直接请求，无缓存）
 * @param companyId 不传且当前无公司上下文时，查询「用户管理的公司」并返回 managedCompany
 */
export async function getCompanyUserRole(companyId?: number): Promise<CompanyUserRoleResult | null> {
  if (!userInfo.value?.id) {
    return null;
  }

  const targetCompanyId = companyId ?? companyInfo.value?.id;
  const userId = Number(userInfo.value.id);

  // 无公司上下文：查用户作为管理员的公司（limit 1），一次请求同时得到角色与公司信息
  if (!targetCompanyId) {
    try {
      const query = `
        query GetUserManagedCompanyRole($userId: bigint!) {
          company_users(
            where: {
              user_users: { _eq: $userId }
              role: { _eq: "admin" }
            }
            limit: 1
          ) {
            id
            role
            can_view_price
            price_factor
            company {
              id
              name
              logo_url
              mode_for_price
              default_for_price_factor
              default_for_can_view_price
            }
          }
        }
      `;
      const result = await client.execute({ query, variables: { userId } });
      if (!result?.company_users || result.company_users.length === 0) return null;
      const row = result.company_users[0];
      const company = row.company;
      return {
        isAdmin: row.role === 'admin',
        canViewPrice: resolveEffectiveCanViewPrice(row, userInfo.value?.role ?? null),
        priceFactor: resolveEffectivePriceFactor(row),
        managedCompany: company
          ? { id: company.id, name: company.name, logo_url: company.logo_url ?? null }
          : undefined,
      };
    } catch (error) {
      console.error('获取用户管理的公司角色失败:', error);
      return null;
    }
  }

  // 有公司上下文：只查该公司的角色
  try {
    const query = `
      query GetCompanyUserRole($userId: bigint!, $companyId: bigint!) {
        company_users(
          where: {
            user_users: { _eq: $userId }
            company_companies: { _eq: $companyId }
          }
          limit: 1
        ) {
          id
          role
          can_view_price
          price_factor
          company {
            mode_for_price
            default_for_price_factor
            default_for_can_view_price
          }
        }
      }
    `;
    const result = await client.execute({
      query,
      variables: { userId, companyId: Number(targetCompanyId) },
    });

    if (!result?.company_users || result.company_users.length === 0) {
      return await fetchCompanyPriceWhenNoMembership(Number(targetCompanyId));
    }

    const companyUser = result.company_users[0];
    return {
      isAdmin: companyUser.role === 'admin',
      canViewPrice: resolveEffectiveCanViewPrice(companyUser, userInfo.value?.role ?? null),
      priceFactor: resolveEffectivePriceFactor(companyUser),
    };
  } catch (error) {
    console.error('获取公司用户角色失败:', error);
    return null;
  }
}

/**
 * 获取用户在当前公司下的角色（带 5 分钟内存缓存）
 * 进入小程序后请求一次即可，各页通过此包装取数，过期再请求。
 * 无 companyId 时返回「用户管理的公司」及角色（含 managedCompany），登录后可传 forceRefresh 强制刷新。
 */
export async function getCompanyUserRoleCached(
  companyId?: number,
  forceRefresh?: boolean
): Promise<CompanyUserRoleResult | null> {
  const userId = userInfo.value?.id;
  if (!userId) return null;

  if (forceRefresh) {
    roleCache = null;
  }

  const targetCompanyId = companyId ?? companyInfo.value?.id;
  const companyKey = targetCompanyId != null ? Number(targetCompanyId) : 0;
  const u = Number(userId);

  if (
    roleCache?.userId === u &&
    roleCache?.companyKey === companyKey &&
    Date.now() - roleCache.entry.ts < ROLE_CACHE_TTL_MS
  ) {
    return roleCache.entry.data;
  }

  const data = await getCompanyUserRole(companyId ?? undefined);
  if (data) {
    roleCache = { userId: u, companyKey, entry: { data, ts: Date.now() } };
  } else {
    roleCache = null;
  }
  return data;
}

/**
 * 登录成功后调用：强制刷新角色缓存，若用户为某公司管理员则设置公司上下文并返回该公司 ID
 */
export async function refreshManagedCompanyAfterLogin(): Promise<number | null> {
  clearCompanyUserRoleCache();
  const result = await getCompanyUserRoleCached(undefined, true);
  const managed = result?.managedCompany;
  if (managed) {
    setCompanyContext(managed);
    return managed.id;
  }
  return null;
}
