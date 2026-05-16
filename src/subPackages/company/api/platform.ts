import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';
import {
  getCompanyDetailFromCache,
  setCompanyDetailCache,
  invalidateCompanyDetailCache,
} from '@/store/userStore';

export interface CompanyInput {
  name: string;
  logo_url?: string;
  banner_top?: any[];
  banner_bottom?: any[];
  hidden_category_ids?: number[];
  hidden_product_ids?: number[];
  hidden_package_ids?: number[];
  description?: string;
  contact_code?: string;
  wechat_code?: string;
  resource_file_url?: string;
  /** 公司配置的初始用户能否查看价格，默认 false */
  default_for_can_view_price?: boolean;
  /** 公司配置的初始用户价格系数，默认 1 */
  default_for_price_factor?: number;
  /** company：全公司统一系数/可看价；user：按成员单独设置 */
  mode_for_price?: 'company' | 'user';
}

const COMPANY_SORT_ORDER: Record<
  string,
  Array<Record<string, string>>
> = {
  created_desc: [{ created_at: 'desc' }],
  created_asc: [{ created_at: 'asc' }],
  name_asc: [{ name: 'asc' }],
  name_desc: [{ name: 'desc' }],
};

function buildCompaniesWhere(q?: string, filter?: string): Record<string, unknown> {
  const parts: Record<string, unknown>[] = [];
  const keyword = (q || '')
    .trim()
    .slice(0, 100)
    .replace(/[%_]/g, '');
  if (keyword) {
    parts.push({ name: { _ilike: `%${keyword}%` } });
  }
  const f = filter || 'all';
  if (f === 'has_admin') {
    parts.push({ company_users: { role: { _eq: 'admin' } } });
  } else if (f === 'no_admin') {
    parts.push({ _not: { company_users: { role: { _eq: 'admin' } } } });
  }
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { _and: parts };
}

export async function getCompanyList(params: {
  limit?: number;
  offset?: number;
  q?: string;
  filter?: string;
  sort?: string;
}) {
  const sortKey = COMPANY_SORT_ORDER[params.sort || 'created_desc']
    ? params.sort || 'created_desc'
    : 'created_desc';
  const orderBy = COMPANY_SORT_ORDER[sortKey];
  const where = buildCompaniesWhere(params.q, params.filter);

  const query = `
    query GetCompanyList($limit: Int!, $offset: Int!, $orderBy: [companies_order_by!]!, $where: companies_bool_exp!) {
      companies(
        limit: $limit
        offset: $offset
        order_by: $orderBy
        where: $where
      ) {
        id
        name
        logo_url
        hidden_category_ids
        hidden_product_ids
        hidden_package_ids
        created_at
        updated_at
        company_users(
          where: { role: { _eq: "admin" } }
        ) {
          id
          user {
            id
            mobile
            nickname
          }
        }
        company_users_total: company_users_aggregate {
          aggregate {
            count
          }
        }
        company_users_admin: company_users_aggregate(where: { role: { _eq: "admin" } }) {
          aggregate {
            count
          }
        }
        company_users_regular: company_users_aggregate(where: { role: { _eq: "user" } }) {
          aggregate {
            count
          }
        }
      }
      companies_aggregate(where: $where) {
        aggregate {
          count
        }
      }
    }
  `;

  const result = await client.execute({
    query,
    variables: {
      limit: params.limit || 20,
      offset: params.offset || 0,
      orderBy,
      where,
    },
  });

  return {
    companies: result?.companies || [],
    total: result?.companies_aggregate?.aggregate?.count || 0,
  };
}

export async function getCompanyDetail(companyId: number) {
  const query = `
    query GetCompanyDetail($companyId: bigint!) {
      companies_by_pk(id: $companyId) {
        id
        name
        logo_url
        banner_top
        banner_bottom
        hidden_category_ids
        hidden_product_ids
        hidden_package_ids
        description
        contact_code
        wechat_code
        resource_file_url
        default_for_can_view_price
        default_for_price_factor
        mode_for_price
        created_at
        updated_at
        company_users(
          where: { role: { _eq: "admin" } }
        ) {
          id
          user {
            id
            mobile
            nickname
            avatar_url
          }
        }
      }
    }
  `;

  const result = await client.execute({
    query,
    variables: { companyId },
  });

  return result?.companies_by_pk;
}

export async function getCompanyDetailCached(companyId: number, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCompanyDetailFromCache(companyId);
    if (cached) return cached;
  }
  const data = await getCompanyDetail(companyId);
  if (data) setCompanyDetailCache(companyId, data);
  return data;
}

export async function createCompany(company: CompanyInput) {
  const mutation = `
    mutation CreateCompany($company: companies_insert_input!) {
      insert_companies_one(object: $company) {
        id
        name
        logo_url
        created_at
      }
    }
  `;

  const companyData = {
    ...company,
    banner_top: company.banner_top ?? [],
    banner_bottom: company.banner_bottom ?? [],
    hidden_category_ids: company.hidden_category_ids ?? [],
    hidden_product_ids: company.hidden_product_ids ?? [],
    hidden_package_ids: company.hidden_package_ids ?? [],
  };

  const result = await client.execute({
    query: mutation,
    variables: { company: companyData },
  });

  return result?.insert_companies_one;
}

export async function updateCompany(companyId: number, company: Partial<CompanyInput>) {
  const mutation = `
    mutation UpdateCompany($companyId: bigint!, $company: companies_set_input!) {
      update_companies_by_pk(pk_columns: { id: $companyId }, _set: $company) {
        id
        name
        updated_at
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: {
      companyId,
      company,
    },
  });
  if (result?.update_companies_by_pk) invalidateCompanyDetailCache(companyId);
  return result?.update_companies_by_pk;
}

export async function deleteCompany(companyId: number) {
  const mutation = `
    mutation DeleteCompany($companyId: bigint!) {
      delete_companies_by_pk(id: $companyId) {
        id
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { companyId },
  });

  return result?.delete_companies_by_pk;
}

export async function authorizeCompanyAdmin(params: {
  userId: number;
  companyId: number;
  companyRole?: 'admin' | 'user';
  canViewPrice?: boolean;
  priceFactor?: number;
}) {
  const companyRole = params.companyRole === 'user' ? 'user' : 'admin';
  const mutation = `
    mutation AuthorizeCompanyMember($user: company_users_insert_input!) {
      insert_company_users_one(
        object: $user
        on_conflict: {
          constraint: company_users_company_companies_user_users_key
          update_columns: [role, level, can_view_price, price_factor]
        }
      ) {
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
    variables: {
      user: {
        user_users: params.userId,
        company_companies: params.companyId,
        role: companyRole,
        level: 'A',
        can_view_price: params.canViewPrice ?? true,
        price_factor: params.priceFactor ?? 1,
      },
    },
  });

  return result?.insert_company_users_one;
}

export async function getDefaultDisplayCompanyId(): Promise<number | null> {
  try {
    const query = `
      query GetDefaultCompanyIdConfig {
        configs(where: { name: { _eq: "default_company_id" } }, limit: 1) {
          id
          value
        }
      }
    `;

    const result = await client.execute({
      query,
    });

    if (!result?.configs || result.configs.length === 0) {
      return null;
    }

    const value = result.configs[0].value;

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? null : parsed;
    }

    if (typeof value === 'object' && value !== null) {
      if (typeof value.content === 'number') {
        return value.content;
      }
      if (typeof value.companyId === 'number') {
        return value.companyId;
      }
      if (typeof value.id === 'number') {
        return value.id;
      }
    }

    return null;
  } catch (error) {
    console.error('获取默认展示公司ID失败:', error);
    return null;
  }
}

export async function setDefaultDisplayCompanyId(companyId: number) {
  const mutation = `
    mutation SetDefaultDisplayCompanyId($companyId: jsonb!) {
      insert_configs_one(
        object: {
          name: "default_company_id"
          value: $companyId
          description: "小程序默认展示的公司ID"
          is_deletable: false
        }
        on_conflict: {
          constraint: configs_name_key
          update_columns: [value, updated_at]
        }
      ) {
        id
        name
        value
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { companyId },
  });

  return result?.insert_configs_one;
}

export async function searchUserByMobileForPlatform(mobile: string) {
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
        role
      }
    }
  `;

  const result = await client.execute({
    query,
    variables: { mobile },
  });

  return result?.users?.[0] || null;
}
