import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';

export interface ProductInput {
  name: string;
  cover_image_url: string;
  description?: string;
  detail_medias?: Array<{ file_type: string; file_url: string }>;
  scene_medias?: Array<{ file_type: string; file_url: string }>;
  category_categories?: number;
  company_companies: number;
  is_shelved?: boolean;
  tags?: string;
  /** 排序权重，数值越小越靠前 */
  sort_order?: number;
}

export interface ProductSkuInput {
  name: string;
  image_url?: string;
  price: number;
  stock: number;
  product_products: number;
  company_companies: number;
  is_shelved?: boolean;
  /** 排序权重，数值越小越靠前 */
  sort_order?: number;
}

/** 一次请求返回公司 hidden_product_ids + 商品列表（用于商品列表页合并请求） */
const PRODUCT_LIST_FIELDS = `
  id
  name
  cover_image_url
  description
  tags
  detail_medias
  scene_medias
  category_categories
  is_shelved
  created_at
  updated_at
  category {
    id
    name
    category {
      id
      name
      category { id name }
    }
  }
  product_skus(where: { is_deleted: { _eq: false } }, order_by: [{ sort_order: asc }, { id: asc }]) {
    id
    name
    image_url
    price
    stock
    is_shelved
    sort_order
  }
`;

/** 列表按分类筛选：商品挂在子分类上，需匹配「自身或上级链」含所选 id（与后台树形选择一致） */
function shouldFilterByCategory(categoryId?: number): categoryId is number {
  return categoryId != null && Number.isFinite(Number(categoryId));
}

const PRODUCT_CATEGORY_SUBTREE_WHERE = `{
  category: {
    _or: [
      { id: { _eq: $categoryId } },
      { category: { id: { _eq: $categoryId } } },
      { category: { category: { id: { _eq: $categoryId } } } },
      { category: { category: { category: { id: { _eq: $categoryId } } } } }
    ]
  }
}`;

/** 名称 / 描述模糊（与后台商品列表一致） */
const PRODUCT_KEYWORD_WHERE = `{ _or: [ { name: { _ilike: $keywordPattern } }, { description: { _ilike: $keywordPattern } } ] }`;

function shouldUseKeyword(keyword?: string): boolean {
  return (keyword ?? '').trim().length > 0;
}

/**
 * 一次请求获取公司 hidden_product_ids + 商品列表（合并请求，减少往返）
 */
export async function getProductListWithCompanyHidden(params: {
  companyId: number;
  categoryId?: number;
  limit?: number;
  offset?: number;
  /** 名称/描述模糊搜索，服务端过滤 */
  keyword?: string;
}) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const whereAnd = [
    '{ company_companies: { _eq: $companyId } }',
    '{ is_deleted: { _eq: false } }',
    ...(shouldFilterByCategory(params.categoryId) ? [PRODUCT_CATEGORY_SUBTREE_WHERE] : []),
    ...(shouldUseKeyword(params.keyword) ? [PRODUCT_KEYWORD_WHERE] : []),
  ];
  const catDecl = shouldFilterByCategory(params.categoryId) ? ', $categoryId: bigint!' : '';
  const kwDecl = shouldUseKeyword(params.keyword) ? ', $keywordPattern: String!' : '';
  const query = `
    query GetProductListWithCompany($companyId: bigint!, $limit: Int!, $offset: Int!${catDecl}${kwDecl}) {
      company: companies_by_pk(id: $companyId) { hidden_product_ids }
      products(
        where: {
          _and: [
            ${whereAnd.join(',\n            ')}
          ]
        }
        limit: $limit
        offset: $offset
        order_by: [{ sort_order: asc }, { created_at: desc }]
      ) {
        ${PRODUCT_LIST_FIELDS}
      }
      products_aggregate(
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
  if (shouldFilterByCategory(params.categoryId)) variables.categoryId = params.categoryId;
  if (shouldUseKeyword(params.keyword)) {
    variables.keywordPattern = `%${String(params.keyword).trim()}%`;
  }
  const result = await client.execute<{
    company: { hidden_product_ids: (string | number)[] | null } | null;
    products: any[];
    products_aggregate: { aggregate: { count: number } };
  }>({
    query,
    variables,
  });
  const hidden = result?.company?.hidden_product_ids;
  const hiddenProductIds = Array.isArray(hidden) ? hidden.map((id) => Number(id)) : [];
  return {
    hiddenProductIds,
    products: result?.products ?? [],
    total: result?.products_aggregate?.aggregate?.count ?? 0,
  };
}

/** 一次请求：按公司 id 列表拉取商品 + 当前公司的 hidden_product_ids（用于「全部」范围单次请求） */
const PRODUCT_LIST_FIELDS_WITH_COMPANY = `
  id
  name
  cover_image_url
  description
  tags
  detail_medias
  scene_medias
  category_categories
  is_shelved
  company_companies
  created_at
  updated_at
  category {
    id
    name
    category {
      id
      name
      category { id name }
    }
  }
  product_skus(where: { is_deleted: { _eq: false } }, order_by: [{ sort_order: asc }, { id: asc }]) {
    id
    name
    image_url
    price
    stock
    is_shelved
    sort_order
  }
`;

export async function getProductListMultiCompany(params: {
  companyIds: number[];
  hiddenForCompanyId: number;
  categoryId?: number;
  limit?: number;
  offset?: number;
  keyword?: string;
}) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const whereAnd = [
    '{ company_companies: { _in: $companyIds } }',
    '{ is_deleted: { _eq: false } }',
    ...(shouldFilterByCategory(params.categoryId) ? [PRODUCT_CATEGORY_SUBTREE_WHERE] : []),
    ...(shouldUseKeyword(params.keyword) ? [PRODUCT_KEYWORD_WHERE] : []),
  ];
  const catDecl = shouldFilterByCategory(params.categoryId) ? ', $categoryId: bigint!' : '';
  const kwDecl = shouldUseKeyword(params.keyword) ? ', $keywordPattern: String!' : '';
  const query = `
    query GetProductListMulti($companyIds: [bigint!]!, $hiddenForCompanyId: bigint!, $limit: Int!, $offset: Int!${catDecl}${kwDecl}) {
      company: companies_by_pk(id: $hiddenForCompanyId) { hidden_product_ids }
      products(
        where: {
          _and: [
            ${whereAnd.join(',\n            ')}
          ]
        }
        limit: $limit
        offset: $offset
        order_by: [{ sort_order: asc }, { created_at: desc }]
      ) {
        ${PRODUCT_LIST_FIELDS_WITH_COMPANY}
      }
      products_aggregate(
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
  if (shouldFilterByCategory(params.categoryId)) variables.categoryId = params.categoryId;
  if (shouldUseKeyword(params.keyword)) {
    variables.keywordPattern = `%${String(params.keyword).trim()}%`;
  }
  const result = await client.execute<{
    company: { hidden_product_ids: (string | number)[] | null } | null;
    products: any[];
    products_aggregate: { aggregate: { count: number } };
  }>({
    query,
    variables,
  });
  const hidden = result?.company?.hidden_product_ids;
  const hiddenProductIds = Array.isArray(hidden) ? hidden.map((id) => Number(id)) : [];
  const products = (result?.products ?? []).map((p: any) => ({
    ...p,
    _companyId: p.company_companies,
  }));
  return {
    hiddenProductIds,
    products,
    total: result?.products_aggregate?.aggregate?.count ?? 0,
  };
}

/**
 * 获取商品列表
 */
export async function getProductList(params: {
  companyId: number;
  categoryId?: number;
  limit?: number;
  offset?: number;
  keyword?: string;
}) {
  // 动态构建 where 条件
  const whereConditions: string[] = [
    '{ company_companies: { _eq: $companyId } }',
    '{ is_deleted: { _eq: false } }',
  ];

  if (shouldFilterByCategory(params.categoryId)) {
    whereConditions.push(PRODUCT_CATEGORY_SUBTREE_WHERE);
  }
  if (shouldUseKeyword(params.keyword)) {
    whereConditions.push(PRODUCT_KEYWORD_WHERE);
  }

  const kwDecl = shouldUseKeyword(params.keyword) ? ', $keywordPattern: String!' : '';

  // 根据是否有 categoryId 动态构建查询
  const query = shouldFilterByCategory(params.categoryId)
    ? `
      query GetProductList(
        $companyId: bigint!
        $categoryId: bigint!
        $limit: Int
        $offset: Int${kwDecl}
      ) {
        products(
          where: {
            _and: [
              ${whereConditions.join(',\n              ')}
            ]
          }
          limit: $limit
          offset: $offset
          order_by: [{ sort_order: asc }, { created_at: desc }]
        ) {
          id
          name
          cover_image_url
          description
          tags
          detail_medias
          scene_medias
          category_categories
          is_shelved
          created_at
          updated_at
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
          product_skus(
            where: { is_deleted: { _eq: false } }
            order_by: [{ sort_order: asc }, { id: asc }]
          ) {
            id
            name
            image_url
            price
            stock
            is_shelved
            sort_order
          }
        }
        products_aggregate(
          where: {
            _and: [
              ${whereConditions.join(',\n              ')}
            ]
          }
        ) {
          aggregate {
            count
          }
        }
      }
    `
    : `
      query GetProductList(
        $companyId: bigint!
        $limit: Int
        $offset: Int${kwDecl}
      ) {
        products(
          where: {
            _and: [
              ${whereConditions.join(',\n              ')}
            ]
          }
          limit: $limit
          offset: $offset
          order_by: [{ sort_order: asc }, { created_at: desc }]
        ) {
          id
          name
          cover_image_url
          description
          tags
          detail_medias
          scene_medias
          category_categories
          is_shelved
          created_at
          updated_at
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
          product_skus(
            where: { is_deleted: { _eq: false } }
            order_by: [{ sort_order: asc }, { id: asc }]
          ) {
            id
            name
            image_url
            price
            stock
            is_shelved
            sort_order
          }
        }
        products_aggregate(
          where: {
            _and: [
              ${whereConditions.join(',\n              ')}
            ]
          }
        ) {
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

  if (shouldFilterByCategory(params.categoryId)) {
    variables.categoryId = params.categoryId;
  }
  if (shouldUseKeyword(params.keyword)) {
    variables.keywordPattern = `%${String(params.keyword).trim()}%`;
  }

  const result = await client.execute({
    query,
    variables,
  });

  return {
    products: result?.products || [],
    total: result?.products_aggregate?.aggregate?.count || 0,
  };
}

/**
 * 按关键词搜索商品及其规格（用于套餐编辑「添加商品」：先搜索再选择，分页）
 * 查询当前公司 + 系统默认公司的商品，支持按商品名称模糊匹配
 */
export async function searchProductsWithSkus(params: {
  keyword?: string;
  companyId: number;
  defaultCompanyId?: number | null;
  limit?: number;
  offset?: number;
}) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const hasKeyword = (params.keyword ?? '').trim().length > 0;
  const pattern = hasKeyword ? `%${String(params.keyword).trim()}%` : '%';

  const companyIds = [params.companyId];
  if (params.defaultCompanyId != null && params.defaultCompanyId !== params.companyId) {
    companyIds.push(params.defaultCompanyId);
  }

  const whereCompany =
    companyIds.length === 1
      ? `{ company_companies: { _eq: $companyId } }`
      : `{ _or: [ { company_companies: { _eq: $companyId } }, { company_companies: { _eq: $defaultCompanyId } } ] }`;

  const whereName = hasKeyword ? `{ name: { _ilike: $pattern } }` : '';

  const whereConditions = [
    '{ is_deleted: { _eq: false } }',
    whereCompany,
    ...(whereName ? [whereName] : []),
  ];

  const query = `
    query SearchProductsWithSkus(
      $companyId: bigint!
      ${companyIds.length > 1 ? '$defaultCompanyId: bigint!' : ''}
      ${hasKeyword ? '$pattern: String!' : ''}
      $limit: Int!
      $offset: Int!
    ) {
      products(
        where: { _and: [ ${whereConditions.join(', ')} ] }
        limit: $limit
        offset: $offset
        order_by: [{ sort_order: asc }, { created_at: desc }]
      ) {
        id
        name
        product_skus(where: { is_deleted: { _eq: false } }, order_by: [{ sort_order: asc }, { id: asc }]) {
          id
          name
          image_url
          price
          stock
          is_shelved
          sort_order
        }
      }
      products_aggregate(
        where: { _and: [ ${whereConditions.join(', ')} ] }
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
  if (companyIds.length > 1) variables.defaultCompanyId = params.defaultCompanyId;
  if (hasKeyword) variables.pattern = pattern;

  const result = await client.execute<{
    products: Array<{
      id: number;
      name: string;
      product_skus: Array<{
        id: number;
        name: string;
        image_url?: string;
        price: number;
        stock?: number;
        is_shelved?: boolean;
      }>;
    }>;
    products_aggregate: { aggregate: { count: number } };
  }>({ query, variables });

  const products = result?.products ?? [];
  const total = result?.products_aggregate?.aggregate?.count ?? 0;

  const skus: Array<{
    id: number;
    name: string;
    image_url?: string;
    price: number;
    stock?: number;
    is_shelved?: boolean;
    product_name: string;
    product_id?: number;
  }> = [];
  products.forEach((p) => {
    (p.product_skus || []).forEach((sku) => {
      skus.push({
        ...sku,
        product_name: p.name,
        product_id: p.id,
      });
    });
  });

  return {
    products,
    skus,
    total,
  };
}

/**
 * 获取商品详情（含分类完整父子链，用于编辑页回显与完整路径展示）
 */
export async function getProductDetail(productId: number) {
  const query = `
    query GetProductDetail($productId: bigint!) {
      products_by_pk(id: $productId) {
        id
        name
        cover_image_url
        description
        tags
        detail_medias
        scene_medias
        category_categories
        company_companies
        is_shelved
        sort_order
        created_at
        updated_at
        category {
          id
          name
          category {
            id
            name
            category { id name }
          }
        }
        product_skus(
          where: { is_deleted: { _eq: false } }
          order_by: [{ sort_order: asc }, { id: asc }]
        ) {
          id
          name
          image_url
          price
          stock
          is_shelved
          sort_order
        }
      }
    }
  `;

  const result = await client.execute({
    query,
    variables: { productId },
  });

  return result?.products_by_pk;
}

/**
 * 创建商品
 */
export async function createProduct(product: ProductInput) {
  const mutation = `
    mutation CreateProduct($product: products_insert_input!) {
      insert_products_one(object: $product) {
        id
        name
        cover_image_url
        created_at
      }
    }
  `;

  // 确保 detail_medias 和 scene_medias 是有效的 JSONB 数组
  const productData: any = {
    name: product.name,
    cover_image_url: product.cover_image_url,
    company_companies: product.company_companies,
    is_shelved: product.is_shelved ?? false,
    detail_medias: Array.isArray(product.detail_medias) && product.detail_medias.length > 0 
      ? product.detail_medias 
      : [],
    scene_medias: Array.isArray(product.scene_medias) && product.scene_medias.length > 0 
      ? product.scene_medias 
      : [],
  };

  // 可选字段，只在有值时才添加
  if (product.description !== undefined && product.description !== null && product.description !== '') {
    productData.description = product.description;
  }
  
  if (product.tags !== undefined && product.tags !== null) {
    productData.tags = product.tags;
  }
  if (product.category_categories !== undefined && product.category_categories !== null) {
    productData.category_categories = product.category_categories;
  }
  if (product.sort_order !== undefined && product.sort_order !== null) {
    productData.sort_order = product.sort_order;
  }

  const result = await client.execute({
    query: mutation,
    variables: {
      product: productData,
    },
  });

  return result?.insert_products_one;
}

/**
 * 更新商品
 */
export async function updateProduct(productId: number, product: Partial<ProductInput>) {
  const mutation = `
    mutation UpdateProduct($productId: bigint!, $product: products_set_input!) {
      update_products_by_pk(pk_columns: { id: $productId }, _set: $product) {
        id
        name
        updated_at
      }
    }
  `;

  // 确保 detail_medias 和 scene_medias 是有效的 JSONB 数组
  const productData: any = {};
  
  // 只添加有值的字段
  if (product.name !== undefined) productData.name = product.name;
  if (product.cover_image_url !== undefined) productData.cover_image_url = product.cover_image_url;
  if (product.is_shelved !== undefined) productData.is_shelved = product.is_shelved;
  if (product.description !== undefined && product.description !== null && product.description !== '') {
    productData.description = product.description;
  }
  if (product.tags !== undefined && product.tags !== null) {
    productData.tags = product.tags;
  }
  if (product.category_categories !== undefined && product.category_categories !== null) {
    productData.category_categories = product.category_categories;
  }
  if (product.sort_order !== undefined && product.sort_order !== null) {
    productData.sort_order = product.sort_order;
  }
  
  // JSONB 数组字段，确保是数组格式
  if (product.detail_medias !== undefined) {
    productData.detail_medias = Array.isArray(product.detail_medias) && product.detail_medias.length > 0 
      ? product.detail_medias 
      : [];
  }
  
  if (product.scene_medias !== undefined) {
    productData.scene_medias = Array.isArray(product.scene_medias) && product.scene_medias.length > 0 
      ? product.scene_medias 
      : [];
  }

  const result = await client.execute({
    query: mutation,
    variables: {
      productId,
      product: productData,
    },
  });

  return result?.update_products_by_pk;
}

/**
 * 删除商品（软删除）
 */
export async function deleteProduct(productId: number) {
  const mutation = `
    mutation DeleteProduct($productId: bigint!) {
      update_products_by_pk(
        pk_columns: { id: $productId }
        _set: { is_deleted: true }
      ) {
        id
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { productId },
  });

  return result?.update_products_by_pk;
}

/**
 * 创建商品规格（SKU）
 */
export async function createProductSku(sku: ProductSkuInput) {
  const mutation = `
    mutation CreateProductSku($sku: product_skus_insert_input!) {
      insert_product_skus_one(object: $sku) {
        id
        name
        price
        stock
      }
    }
  `;

  const skuPayload: any = {
    ...sku,
    is_shelved: sku.is_shelved ?? false,
  };
  if (sku.sort_order !== undefined && sku.sort_order !== null) {
    skuPayload.sort_order = sku.sort_order;
  }
  const result = await client.execute({
    query: mutation,
    variables: {
      sku: skuPayload,
    },
  });

  return result?.insert_product_skus_one;
}

/**
 * 更新商品规格（SKU）
 */
export async function updateProductSku(skuId: number, sku: Partial<ProductSkuInput>) {
  const mutation = `
    mutation UpdateProductSku($skuId: bigint!, $sku: product_skus_set_input!) {
      update_product_skus_by_pk(pk_columns: { id: $skuId }, _set: $sku) {
        id
        name
        price
        stock
        updated_at
      }
    }
  `;

  const skuPayload: any = { ...sku };
  if (sku.sort_order !== undefined && sku.sort_order !== null) {
    skuPayload.sort_order = sku.sort_order;
  }
  const result = await client.execute({
    query: mutation,
    variables: {
      skuId,
      sku: skuPayload,
    },
  });

  return result?.update_product_skus_by_pk;
}

/**
 * 删除商品规格（软删除）
 */
export async function deleteProductSku(skuId: number) {
  const mutation = `
    mutation DeleteProductSku($skuId: bigint!) {
      update_product_skus_by_pk(
        pk_columns: { id: $skuId }
        _set: { is_deleted: true }
      ) {
        id
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { skuId },
  });

  return result?.update_product_skus_by_pk;
}
