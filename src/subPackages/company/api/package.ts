import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';

function shouldFilterPackageByCategory(categoryId?: number): categoryId is number {
  return categoryId != null && Number.isFinite(Number(categoryId));
}

/** 套餐挂在子分类时，按父级筛选需匹配分类自身或上级链含所选 id */
const PACKAGE_CATEGORY_SUBTREE_WHERE = `{
  category: {
    _or: [
      { id: { _eq: $categoryId } },
      { category: { id: { _eq: $categoryId } } },
      { category: { category: { id: { _eq: $categoryId } } } },
      { category: { category: { category: { id: { _eq: $categoryId } } } } }
    ]
  }
}`;

export interface PackageInput {
  name: string;
  cover_image_url: string;
  description?: string;
  category_categories?: number;
  tags?: string;
  /** 公司 ID，创建套餐时必传 */
  company_companies?: number;
  /** 是否下架 */
  is_shelved?: boolean;
  /** 排序权重，数值越小越靠前 */
  sort_order?: number;
}

export interface PackageProductSkuInput {
  package_packages: number;
  product_sku_product_skus: number;
  quantity: number;
  /** 排序权重，数值越小越靠前 */
  sort_order?: number;
}

const PACKAGE_LIST_FIELDS = `
  id
  name
  cover_image_url
  description
  category_categories
  is_shelved
  category {
    id
    name
    category {
      id
      name
      category { id name }
    }
  }
  created_at
  updated_at
  package_product_skus(order_by: [{ sort_order: asc }, { id: asc }]) {
    id
    quantity
    sort_order
    product_sku {
      id
      name
      price
      product { name }
    }
  }
`;

/**
 * 一次请求获取公司 hidden_package_ids + 套餐列表（合并请求，减少往返）
 */
export async function getPackageListWithCompanyHidden(params: {
  companyId: number;
  categoryId?: number;
  limit?: number;
  offset?: number;
}) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const whereAnd = [
    '{ company_companies: { _eq: $companyId } }',
    ...(shouldFilterPackageByCategory(params.categoryId) ? [PACKAGE_CATEGORY_SUBTREE_WHERE] : []),
  ];
  const catDecl = shouldFilterPackageByCategory(params.categoryId) ? ', $categoryId: bigint!' : '';
  const query = `
    query GetPackageListWithCompany($companyId: bigint!, $limit: Int!, $offset: Int!${catDecl}) {
      company: companies_by_pk(id: $companyId) { hidden_package_ids }
      packages(
        where: {
          _and: [
            ${whereAnd.join(',\n            ')}
          ]
        }
        limit: $limit
        offset: $offset
        order_by: [{ sort_order: asc }, { created_at: desc }]
      ) {
        ${PACKAGE_LIST_FIELDS}
      }
      packages_aggregate(
        where: {
          _and: [
            ${whereAnd.join(',\n            ')}
          ]
        }
      ) {
        aggregate { count }
      }
    }
  `;
  const variables: Record<string, unknown> = {
    companyId: params.companyId,
    limit,
    offset,
  };
  if (shouldFilterPackageByCategory(params.categoryId)) variables.categoryId = params.categoryId;
  const result = await client.execute<{
    company: { hidden_package_ids: (string | number)[] | null } | null;
    packages: any[];
    packages_aggregate: { aggregate: { count: number } };
  }>({
    query,
    variables,
  });
  const hidden = result?.company?.hidden_package_ids;
  const hiddenPackageIds = Array.isArray(hidden) ? hidden.map((id) => Number(id)) : [];
  return {
    hiddenPackageIds,
    packages: result?.packages ?? [],
    total: result?.packages_aggregate?.aggregate?.count ?? 0,
  };
}

/** 一次请求：按公司 id 列表拉取套餐 + 当前公司的 hidden_package_ids（用于「全部」范围单次请求） */
const PACKAGE_LIST_FIELDS_WITH_COMPANY = `
  id
  name
  cover_image_url
  description
  category_categories
  is_shelved
  company_companies
  category {
    id
    name
    category {
      id
      name
      category { id name }
    }
  }
  created_at
  updated_at
  package_product_skus(order_by: [{ sort_order: asc }, { id: asc }]) {
    id
    quantity
    sort_order
    product_sku {
      id
      name
      price
      product { name }
    }
  }
`;

export async function getPackageListMultiCompany(params: {
  companyIds: number[];
  hiddenForCompanyId: number;
  categoryId?: number;
  limit?: number;
  offset?: number;
}) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const whereAnd = [
    '{ company_companies: { _in: $companyIds } }',
    ...(shouldFilterPackageByCategory(params.categoryId) ? [PACKAGE_CATEGORY_SUBTREE_WHERE] : []),
  ];
  const catDecl = shouldFilterPackageByCategory(params.categoryId) ? ', $categoryId: bigint!' : '';
  const query = `
    query GetPackageListMulti($companyIds: [bigint!]!, $hiddenForCompanyId: bigint!, $limit: Int!, $offset: Int!${catDecl}) {
      company: companies_by_pk(id: $hiddenForCompanyId) { hidden_package_ids }
      packages(
        where: {
          _and: [
            ${whereAnd.join(',\n            ')}
          ]
        }
        limit: $limit
        offset: $offset
        order_by: [{ sort_order: asc }, { created_at: desc }]
      ) {
        ${PACKAGE_LIST_FIELDS_WITH_COMPANY}
      }
      packages_aggregate(
        where: {
          _and: [
            ${whereAnd.join(',\n            ')}
          ]
        }
      ) {
        aggregate { count }
      }
    }
  `;
  const variables: Record<string, unknown> = {
    companyIds: params.companyIds,
    hiddenForCompanyId: params.hiddenForCompanyId,
    limit,
    offset,
  };
  if (shouldFilterPackageByCategory(params.categoryId)) variables.categoryId = params.categoryId;
  const result = await client.execute<{
    company: { hidden_package_ids: (string | number)[] | null } | null;
    packages: any[];
    packages_aggregate: { aggregate: { count: number } };
  }>({
    query,
    variables,
  });
  const hidden = result?.company?.hidden_package_ids;
  const hiddenPackageIds = Array.isArray(hidden) ? hidden.map((id) => Number(id)) : [];
  const packages = (result?.packages ?? []).map((p: any) => ({
    ...p,
    _companyId: p.company_companies,
  }));
  return {
    hiddenPackageIds,
    packages,
    total: result?.packages_aggregate?.aggregate?.count ?? 0,
  };
}

/**
 * 获取套餐列表（可选按公司、分类筛选）
 */
export async function getPackageList(params: {
  companyId?: number;
  categoryId?: number;
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = [];
  if (params.companyId != null) {
    conditions.push('{ company_companies: { _eq: $companyId } }');
  }
  if (shouldFilterPackageByCategory(params.categoryId)) {
    conditions.push(PACKAGE_CATEGORY_SUBTREE_WHERE);
  }
  const whereClause =
    conditions.length > 0
      ? `where: { _and: [ ${conditions.join(', ')} ] }, `
      : '';

  const varDecl: string[] = ['$limit: Int', '$offset: Int'];
  const variables: Record<string, unknown> = {
    limit: params.limit || 20,
    offset: params.offset || 0,
  };
  if (params.companyId != null) {
    varDecl.push('$companyId: bigint!');
    variables.companyId = params.companyId;
  }
  if (shouldFilterPackageByCategory(params.categoryId)) {
    varDecl.push('$categoryId: bigint!');
    variables.categoryId = params.categoryId;
  }

  const query = `
    query GetPackageList(${varDecl.join(', ')}) {
      packages(
        ${whereClause}limit: $limit
        offset: $offset
        order_by: [{ sort_order: asc }, { created_at: desc }]
      ) {
        id
        name
        cover_image_url
        description
        category_categories
        is_shelved
        category {
          id
          name
          category {
            id
            name
            category {
              id
              name
            }
          }
        }
        created_at
        updated_at
        package_product_skus(order_by: [{ sort_order: asc }, { id: asc }]) {
          id
          quantity
          sort_order
          product_sku {
            id
            name
            price
            product {
              name
            }
          }
        }
      }
      packages_aggregate(
        ${whereClause.replace(/,\s*$/, '')}
      ) {
        aggregate {
          count
        }
      }
    }
  `;

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
 * 获取套餐详情（含分类完整父子链，用于编辑页回显与完整路径展示）
 */
export async function getPackageDetail(packageId: number) {
  const query = `
    query GetPackageDetail($packageId: bigint!) {
      packages_by_pk(id: $packageId) {
        id
        name
        cover_image_url
        description
        tags
        category_categories
        category {
          id
          name
          category {
            id
            name
            category { id name }
          }
        }
        created_at
        updated_at
        sort_order
        package_product_skus(order_by: [{ sort_order: asc }, { id: asc }]) {
          id
          quantity
          sort_order
          product_sku {
            id
            name
            price
            image_url
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

  return result?.packages_by_pk;
}

/**
 * 创建套餐（必须传入有效的 company_companies，否则会触发外键约束错误）
 */
export async function createPackage(packageData: PackageInput) {
  const companyId = packageData.company_companies;
  if (companyId == null || Number.isNaN(Number(companyId)) || Number(companyId) <= 0) {
    throw new Error('创建套餐时必须选择公司，请先选择当前公司后再保存');
  }
  const company_companies = Number(companyId);

  const insertObject: Record<string, unknown> = {
    name: packageData.name,
    cover_image_url: packageData.cover_image_url,
    description: packageData.description ?? null,
    category_categories: packageData.category_categories ?? null,
    tags: packageData.tags ?? null,
    is_shelved: packageData.is_shelved ?? false,
    company_companies,
  };
  if (packageData.sort_order !== undefined && packageData.sort_order !== null) {
    insertObject.sort_order = packageData.sort_order;
  }

  const mutation = `
    mutation CreatePackage($package: packages_insert_input!) {
      insert_packages_one(object: $package) {
        id
        name
        cover_image_url
        created_at
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { package: insertObject },
  });

  return result?.insert_packages_one;
}

/**
 * 更新套餐
 */
export async function updatePackage(packageId: number, packageData: Partial<PackageInput>) {
  const mutation = `
    mutation UpdatePackage($packageId: bigint!, $package: packages_set_input!) {
      update_packages_by_pk(pk_columns: { id: $packageId }, _set: $package) {
        id
        name
        updated_at
      }
    }
  `;

  const payload: Record<string, unknown> = { ...packageData };
  if (packageData.sort_order !== undefined && packageData.sort_order !== null) {
    payload.sort_order = packageData.sort_order;
  }
  const result = await client.execute({
    query: mutation,
    variables: {
      packageId,
      package: payload,
    },
  });

  return result?.update_packages_by_pk;
}

/**
 * 删除套餐（先删除该套餐下所有套餐商品规格关联 package_product_skus，再删除套餐记录；
 * 仅删除关联关系，不删除商品规格 product_skus 本身）
 */
export async function deletePackage(packageId: number) {
  // 1. 查询该套餐下所有 package_product_skus 的 id
  const listQuery = `
    query ListPackageProductSkus($packageId: bigint!) {
      package_product_skus(where: { package_packages: { _eq: $packageId } }, limit: 5000) {
        id
      }
    }
  `;
  const listResult = await client.execute<{
    package_product_skus: Array<{ id: number }>;
  }>({
    query: listQuery,
    variables: { packageId },
  });
  const skuIds = (listResult?.package_product_skus ?? []).map((row) => row.id);

  // 2. 逐个删除套餐商品规格关联（仅删除关联表记录，不删商品规格）
  for (const skuId of skuIds) {
    await deletePackageSku(skuId);
  }

  // 3. 删除套餐主记录
  const mutation = `
    mutation DeletePackage($packageId: bigint!) {
      delete_packages_by_pk(id: $packageId) {
        id
      }
    }
  `;
  const result = await client.execute({
    query: mutation,
    variables: { packageId },
  });

  return result?.delete_packages_by_pk;
}

/**
 * 添加套餐SKU
 */
export async function addPackageSku(sku: PackageProductSkuInput) {
  const mutation = `
    mutation AddPackageSku($sku: package_product_skus_insert_input!) {
      insert_package_product_skus_one(object: $sku) {
        id
        quantity
      }
    }
  `;

  const skuPayload: Record<string, unknown> = {
    package_packages: sku.package_packages,
    product_sku_product_skus: sku.product_sku_product_skus,
    quantity: sku.quantity,
  };
  if (sku.sort_order !== undefined && sku.sort_order !== null) {
    skuPayload.sort_order = sku.sort_order;
  }
  const result = await client.execute({
    query: mutation,
    variables: { sku: skuPayload },
  });

  return result?.insert_package_product_skus_one;
}

/**
 * 更新套餐SKU（支持 quantity 与 sort_order）
 */
export async function updatePackageSku(
  skuId: number,
  updates: { quantity?: number; sort_order?: number }
) {
  const set: Record<string, number> = {};
  if (updates.quantity !== undefined) set.quantity = updates.quantity;
  if (updates.sort_order !== undefined) set.sort_order = updates.sort_order;
  if (Object.keys(set).length === 0) {
    return await client.execute({
      query: `query GetPps($id: bigint!) { package_product_skus_by_pk(id: $id) { id } }`,
      variables: { id: skuId },
    }).then((r: any) => r?.package_product_skus_by_pk);
  }
  const mutation = `
    mutation UpdatePackageSku($skuId: bigint!, $set: package_product_skus_set_input!) {
      update_package_product_skus_by_pk(
        pk_columns: { id: $skuId }
        _set: $set
      ) {
        id
        quantity
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { skuId, set },
  });

  return result?.update_package_product_skus_by_pk;
}

/**
 * 删除套餐SKU
 */
export async function deletePackageSku(skuId: number) {
  const mutation = `
    mutation DeletePackageSku($skuId: bigint!) {
      delete_package_product_skus_by_pk(id: $skuId) {
        id
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { skuId },
  });

  return result?.delete_package_product_skus_by_pk;
}
