import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';

/** 客户等级 */
export type CompanyUserLevel = 'A' | 'B' | 'C' | 'D' | 'E';

export interface CompanyUserInput {
  user_users: number;
  company_companies: number;
  role: 'admin' | 'user';
  can_view_price: boolean;
  price_factor: number;
  /** 客户等级，默认 A */
  level?: CompanyUserLevel;
}

const LEVEL_VALUES: CompanyUserLevel[] = ['A', 'B', 'C', 'D', 'E'];

/**
 * 获取公司用户列表，支持按角色、等级筛选
 */
export async function getCompanyUserList(params: {
  companyId: number;
  limit?: number;
  offset?: number;
  /** company_users.role，或 wx_guest_user 表示按 users.role 筛选访客 */
  role?: 'admin' | 'user' | 'wx_guest_user';
  level?: CompanyUserLevel;
}) {
  const companyRole =
    params.role === 'admin' || params.role === 'user' ? params.role : undefined;
  const filterPlatformGuest = params.role === 'wx_guest_user';
  const level = params.level && LEVEL_VALUES.includes(params.level) ? params.level : undefined;

  const andParts: string[] = ['{ company_companies: { _eq: $companyId } }'];
  const varDecls = ['$companyId: bigint!', '$limit: Int', '$offset: Int'];

  if (companyRole) {
    andParts.push('{ role: { _eq: $companyRole } }');
    varDecls.push('$companyRole: String!');
  }
  if (level) {
    andParts.push('{ level: { _eq: $level } }');
    varDecls.push('$level: String!');
  }

  const userPredicates: string[] = [];
  if (filterPlatformGuest) {
    userPredicates.push('{ role: { _eq: $userPlatformRole } }');
    varDecls.push('$userPlatformRole: String!');
  }
  if (userPredicates.length === 1) {
    andParts.push(`{ user: ${userPredicates[0]} }`);
  } else if (userPredicates.length > 1) {
    andParts.push(`{ user: { _and: [ ${userPredicates.join(', ')} ] } }`);
  }

  const whereBody = `{ _and: [ ${andParts.join(', ')} ] }`;

  const query = `
    query GetCompanyUserList(${varDecls.join(', ')}) {
      company_users(
        where: ${whereBody}
        limit: $limit
        offset: $offset
        order_by: { created_at: desc }
      ) {
        id
        role
        level
        can_view_price
        price_factor
        created_at
        user {
          id
          mobile
          nickname
          avatar_url
          role
        }
      }
      company_users_aggregate(where: ${whereBody}) {
        aggregate {
          count
        }
      }
    }
  `;

  const variables: any = {
    companyId: params.companyId,
    limit: params.limit || 20,
    offset: params.offset || 0,
  };
  if (companyRole) variables.companyRole = companyRole;
  if (level) variables.level = level;
  if (filterPlatformGuest) variables.userPlatformRole = 'wx_guest_user';

  const result = await client.execute({
    query,
    variables,
  });

  return {
    users: result?.company_users || [],
    total: result?.company_users_aggregate?.aggregate?.count || 0,
  };
}

/**
 * 根据手机号创建默认账号（仅 mobile + role: user，用于「先创建再添加至公司」）
 */
export async function createUserByMobile(mobile: string) {
  const mutation = `
    mutation CreateUserByMobile($mobile: String!) {
      insert_users_one(
        object: {
          mobile: $mobile
          role: "user"
        }
      ) {
        id
        mobile
        nickname
        avatar_url
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { mobile: String(mobile).trim() },
  });

  return result?.insert_users_one || null;
}

/**
 * 根据手机号搜索用户
 */
export async function searchUserByMobile(mobile: string) {
  const query = `
    query SearchUserByMobile($mobile: String!) {
      users(
        where: { mobile: { _eq: $mobile } }
        limit: 1
      ) {
        id
        mobile
        nickname
        avatar_url
      }
    }
  `;

  const result = await client.execute({
    query,
    variables: { mobile },
  });

  return result?.users?.[0] || null;
}

/**
 * 添加公司用户
 */
export async function addCompanyUser(user: CompanyUserInput) {
  const payload: Record<string, unknown> = {
    user_users: user.user_users,
    company_companies: user.company_companies,
    role: user.role,
    can_view_price: user.can_view_price,
    price_factor: user.price_factor,
    level: user.level ?? 'A',
  };
  const mutation = `
    mutation AddCompanyUser($user: company_users_insert_input!) {
      insert_company_users_one(object: $user) {
        id
        role
        level
        can_view_price
        price_factor
        user {
          id
          mobile
          nickname
        }
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { user: payload },
  });

  return result?.insert_company_users_one;
}

/**
 * 更新公司用户
 */
export async function updateCompanyUser(
  userId: number,
  updates: Partial<CompanyUserInput>
) {
  const set: Record<string, unknown> = { ...updates };
  if (updates.level !== undefined) set.level = updates.level;
  const mutation = `
    mutation UpdateCompanyUser(
      $userId: bigint!
      $updates: company_users_set_input!
    ) {
      update_company_users_by_pk(
        pk_columns: { id: $userId }
        _set: $updates
      ) {
        id
        role
        level
        can_view_price
        price_factor
        updated_at
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: {
      userId,
      updates: set,
    },
  });

  return result?.update_company_users_by_pk;
}

/**
 * 删除公司用户
 */
export async function removeCompanyUser(userId: number) {
  const mutation = `
    mutation RemoveCompanyUser($userId: bigint!) {
      delete_company_users_by_pk(id: $userId) {
        id
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { userId },
  });

  return result?.delete_company_users_by_pk;
}

/** 批量更新时按等级筛选的可选等级 */
export const COMPANY_USER_LEVELS: CompanyUserLevel[] = ['A', 'B', 'C', 'D', 'E'];

/**
 * 按等级批量更新公司用户（显隐价格 或 价格系数）
 */
export async function batchUpdateCompanyUsersByLevel(params: {
  companyId: number;
  level: CompanyUserLevel;
  updates: { can_view_price?: boolean; price_factor?: number };
}) {
  const query = `
    query ListCompanyUserIdsByLevel($companyId: bigint!, $level: String!) {
      company_users(
        where: {
          company_companies: { _eq: $companyId }
          level: { _eq: $level }
        }
        limit: 5000
      ) {
        id
      }
    }
  `;
  const listRes = await client.execute<{ company_users: Array<{ id: number }> }>({
    query,
    variables: { companyId: params.companyId, level: params.level },
  });
  const ids = (listRes?.company_users ?? []).map((r) => r.id);
  const set: Record<string, unknown> = {};
  if (params.updates.can_view_price !== undefined) set.can_view_price = params.updates.can_view_price;
  if (params.updates.price_factor !== undefined) set.price_factor = params.updates.price_factor;
  if (Object.keys(set).length === 0) return { updated: 0 };
  let updated = 0;
  for (const id of ids) {
    await updateCompanyUser(id, set as Partial<CompanyUserInput>);
    updated++;
  }
  return { updated };
}
