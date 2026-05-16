import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';

/**
 * 获取用户列表（平台管理员）
 * 支持按关键词（手机号/昵称）、角色筛选
 */
export async function getUserList(params: {
  limit?: number;
  offset?: number;
  keyword?: string;
  role?: 'user' | 'admin' | 'wx_guest_user';
}) {
  const hasKeyword = params.keyword != null && String(params.keyword).trim() !== '';
  const keyword = hasKeyword ? `%${String(params.keyword).trim()}%` : '';
  const role =
    params.role === 'user' || params.role === 'admin' || params.role === 'wx_guest_user'
      ? params.role
      : undefined;

  const conditions: string[] = [];
  if (hasKeyword) {
    conditions.push(`_or: [
              { mobile: { _ilike: $keyword } },
              { nickname: { _ilike: $keyword } },
              { wx_mini_openid: { _ilike: $keyword } }
            ]`);
  }
  if (role) {
    conditions.push('role: { _eq: $role }');
  }
  const hasWhere = conditions.length > 0;
  const whereBody =
    conditions.length === 1
      ? conditions[0]
      : `_and: [ ${conditions.map((c) => `{ ${c} }`).join(', ')} ]`;
  const whereArg = hasWhere ? `where: { ${whereBody} }` : '';

  const varDecls = ['$limit: Int', '$offset: Int'];
  if (hasKeyword) varDecls.push('$keyword: String!');
  if (role) varDecls.push('$role: String!');

  const usersArgs = hasWhere
    ? `${whereArg}, limit: $limit, offset: $offset, order_by: { created_at: desc }`
    : 'limit: $limit, offset: $offset, order_by: { created_at: desc }';
  const aggregateArgs = hasWhere ? whereArg : '';

  const queryFinal = `
    query GetUserList(${varDecls.join(', ')}) {
      users(${usersArgs}) {
        id
        mobile
        nickname
        avatar_url
        role
        created_at
        wx_mini_openid
        company_users(order_by: { company: { name: asc } }) {
          company {
            id
            name
          }
        }
      }
      users_aggregate${aggregateArgs ? `(${aggregateArgs})` : ''} {
        aggregate {
          count
        }
      }
    }
  `;

  const variables: any = {
    limit: params.limit || 20,
    offset: params.offset || 0,
  };
  if (hasKeyword) variables.keyword = keyword;
  if (role) variables.role = role;

  const result = await client.execute({
    query: queryFinal,
    variables,
  });

  return {
    users: result?.users || [],
    total: result?.users_aggregate?.aggregate?.count || 0,
  };
}

/**
 * 更新用户角色
 */
/** 仅可设为普通用户或平台管理员；微信访客不可通过后台指派 */
export async function updateUserRole(userId: number, role: 'user' | 'admin') {
  const mutation = `
    mutation UpdateUserRole($userId: bigint!, $role: String!) {
      update_users_by_pk(
        pk_columns: { id: $userId }
        _set: { role: $role }
      ) {
        id
        role
        updated_at
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: {
      userId,
      role,
    },
  });

  return result?.update_users_by_pk;
}
