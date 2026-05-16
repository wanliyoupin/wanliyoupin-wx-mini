import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';
import { companyInfo, getCompanyDetailFromCache } from '@/store/userStore';
import { getDefaultCompanyIdCached } from '@/api/config/index';

/**
 * 获取套餐列表（前端展示）
 * 当前公司 + 系统默认公司；隐藏套餐从公司配置缓存读取并在查询时过滤
 */
export async function getPackageList(params: {
  companyId?: number;
  categoryId?: number;
  keyword?: string;
  limit?: number;
  offset?: number;
}) {
  const currentCompanyId = params.companyId || companyInfo.value?.id;

  const defaultCompanyId = await getDefaultCompanyIdCached();
  const companyIds: number[] = [];
  if (currentCompanyId) companyIds.push(currentCompanyId);
  if (defaultCompanyId != null && defaultCompanyId !== currentCompanyId) companyIds.push(defaultCompanyId);

  if (companyIds.length === 0) {
    return {
      packages: [],
      total: 0,
    };
  }

  // 当前公司隐藏套餐 id：从全局公司配置缓存读取（App 已拉取，无需再请求）
  const companyDetail = currentCompanyId ? getCompanyDetailFromCache(currentCompanyId) : null;
  const arr = companyDetail?.hidden_package_ids;
  const hiddenPackageIds: number[] = Array.isArray(arr) ? arr.map((id) => Number(id)) : [];

  const packageCompanyFilter = companyIds.length === 1
    ? 'company_companies: { _eq: $companyId }'
    : 'company_companies: { _in: $companyIds }';

  const whereConditions: string[] = [
    packageCompanyFilter,
    // 与其它项一致：仅 key 片段，外层由 map 包一层 `{ ... }`
    'is_shelved: { _eq: false }',
    `package_product_skus: {
              product_sku: {
                is_deleted: { _eq: false }
                is_shelved: { _eq: false }
              }
            }`,
  ];

  // 如果指定了分类ID，添加分类过滤条件
  if (params.categoryId) {
    whereConditions.push(`category_categories: { _eq: $categoryId }`);
  }

  // 当前公司已隐藏的套餐 id 不展示
  if (hiddenPackageIds.length > 0) {
    whereConditions.push('id: { _nin: $hiddenPackageIds }');
  }

  if (params.keyword && params.keyword.trim()) {
    whereConditions.push('name: { _ilike: $keyword }');
  }

  // 构建where子句（_and 的每一项必须是对象，需用 {} 包裹）
  const whereClause = whereConditions.length > 1
    ? `_and: [
            ${whereConditions.map((c) => `{ ${c} }`).join(',\n            ')}
          ]`
    : whereConditions[0];

  const hiddenVars = hiddenPackageIds.length > 0 ? ', $hiddenPackageIds: [bigint!]!' : '';
  const keywordVar = params.keyword?.trim() ? ', $keyword: String!' : '';
  const isSingle = companyIds.length === 1;
  const query = isSingle
    ? `
    query GetPackageList($companyId: bigint!, $limit: Int, $offset: Int${params.categoryId ? ', $categoryId: bigint!' : ''}${keywordVar}${hiddenVars}) {
      packages(
        where: { ${whereClause} }
        limit: $limit
        offset: $offset
        order_by: [{ sort_order: asc }, { created_at: desc }]
      ) {
        id
        name
        cover_image_url
        description
        tags
        created_at
        package_product_skus(where: { product_sku: { is_deleted: { _eq: false }, is_shelved: { _eq: false } } }, order_by: [{ sort_order: asc }, { id: asc }]) {
          id
          quantity
          product_sku {
            id
            name
            price
            image_url
            product { id
              name
              cover_image_url
            }
          }
        }
      }
      packages_aggregate(where: { ${whereClause} }) {
        aggregate { count }
      }
    }
  `
    : `
    query GetPackageListMulti($companyIds: [bigint!]!, $limit: Int, $offset: Int${params.categoryId ? ', $categoryId: bigint!' : ''}${keywordVar}${hiddenVars}) {
      packages(
        where: { ${whereClause} }
        limit: $limit
        offset: $offset
        order_by: [{ sort_order: asc }, { created_at: desc }]
      ) {
        id
        name
        cover_image_url
        description
        tags
        created_at
        package_product_skus(where: { product_sku: { is_deleted: { _eq: false }, is_shelved: { _eq: false } } }, order_by: [{ sort_order: asc }, { id: asc }]) {
          id
          quantity
          product_sku {
            id
            name
            price
            image_url
            product { id
              name
              cover_image_url
            }
          }
        }
      }
      packages_aggregate(where: { ${whereClause} }) {
        aggregate { count }
      }
    }
  `;

  const variables: any = {
    limit: params.limit || 20,
    offset: params.offset || 0,
  };
  if (isSingle) {
    variables.companyId = companyIds[0];
  } else {
    variables.companyIds = companyIds;
  }

  // 如果指定了分类ID，添加到变量中
  if (params.categoryId) {
    variables.categoryId = params.categoryId;
  }
  if (params.keyword?.trim()) {
    variables.keyword = `%${params.keyword.trim()}%`;
  }
  if (hiddenPackageIds.length > 0) {
    variables.hiddenPackageIds = hiddenPackageIds;
  }

  const result = await client.execute({
    query,
    variables,
  });

  return {
    packages: result?.packages || [],
    total: result?.packages_aggregate?.aggregate?.count || 0,
  };
}

/**
 * 获取套餐详情
 */
export async function getPackageDetail(packageId: number) {
  const query = `
    query GetPackageDetail($packageId: bigint!) {
      packages_by_pk(id: $packageId) {
        id
        name
        cover_image_url
        description
        is_shelved
        created_at
        updated_at
        package_product_skus(
          where: {
            product_sku: {
              is_deleted: { _eq: false }
              is_shelved: { _eq: false }
            }
          }
          order_by: [{ sort_order: asc }, { id: asc }]
        ) {
          id
          quantity
          product_sku {
            id
            name
            price
            stock
            image_url
            is_shelved
            product {
              id
              name
              cover_image_url
            }
          }
        }
      }
    }
  `;

  const result = await client.execute({
    query,
    variables: { packageId },
  });

  const row = result?.packages_by_pk;
  /** 套餐 is_shelved 表示是否下架 */
  if (!row || row.is_shelved === true) return undefined;
  return row;
}
