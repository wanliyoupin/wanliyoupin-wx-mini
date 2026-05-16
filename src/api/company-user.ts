/**
 * 主包内公司用户相关 API（供 App.vue 等主包逻辑使用，避免引用分包导致运行时 module not defined）
 * 仅包含「自动注册为公司普通用户」所需的最小能力。
 */
import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';

export interface CompanyUserDefaults {
  can_view_price: boolean;
  price_factor: number;
}

/**
 * 自动注册为 company_users 时的默认字段（系数取公司 default_for_price_factor）。
 */
export async function getCompanyUserDefaults(
  companyId: number
): Promise<CompanyUserDefaults> {
  const query = `
    query GetCompanyUserDefaults($companyId: bigint!) {
      companies_by_pk(id: $companyId) {
        default_for_price_factor
      }
    }
  `;
  const result = await client.execute({
    query,
    variables: { companyId },
  });
  const row = (result as any)?.companies_by_pk;
  return {
    can_view_price: true,
    price_factor: row?.default_for_price_factor != null ? Number(row.default_for_price_factor) : 1,
  };
}

/**
 * 将用户添加为指定公司的普通用户
 * 若已存在 (user, company) 会报错，调用方需先 isCompanyUser 判断
 * @param defaults 不传则使用 can_view_price: false, price_factor: 1
 */
export async function addCompanyUserAsNormal(
  userId: number,
  companyId: number,
  defaults?: { can_view_price?: boolean; price_factor?: number }
): Promise<{ id: number } | null> {
  const canViewPrice = defaults?.can_view_price ?? false;
  const priceFactor = defaults?.price_factor ?? 1;
  const mutation = `
    mutation AddCompanyUserAsNormal($user: company_users_insert_input!) {
      insert_company_users_one(object: $user) {
        id
      }
    }
  `;
  const result = await client.execute({
    query: mutation,
    variables: {
      user: {
        user_users: userId,
        company_companies: companyId,
        role: 'user',
        can_view_price: canViewPrice,
        price_factor: priceFactor,
      },
    },
  });
  return result?.insert_company_users_one ?? null;
}
