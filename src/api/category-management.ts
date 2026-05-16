/**
 * 管理端分类 API（公司端分类管理、CategoryPicker 等）
 * 放在主包以便主包组件 CategoryPicker 可引用；分包页面也可从主包 require
 *
 * 分类树上的商品数必须与「当前可见公司范围」内商品一致：聚合需带 company_companies 条件。
 * 深层嵌套里对 $companyIds 的 aggregate 在 Hasura 可能不生效，故采用「先拉树、再根级批量聚合」与 judengyoupin-backend 一致。
 */
import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';

export interface CategoryInput {
  name: string;
  icon_url: string;
  company_companies: number;
  parent_categories?: number;
  level: number;
  route_ui_style: 'categories' | 'products';
  sort_order: number;
  type: 'product' | 'package';
}

const TREE_CORE = `
        id
        name
        icon_url
        parent_categories
        level
        route_ui_style
        sort_order
        type
`;

type AggRow = {
  id: number;
  products_aggregate?: { aggregate?: { count?: number } | null } | null;
  products_listed_aggregate?: { aggregate?: { count?: number } | null } | null;
  packages_aggregate?: { aggregate?: { count?: number } | null } | null;
};

function collectCategoryIds(nodes: unknown[]): number[] {
  const ids: number[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const o = n as { id?: unknown; categories?: unknown[] };
    if (typeof o.id === 'number' && Number.isFinite(o.id)) ids.push(o.id);
    if (Array.isArray(o.categories)) o.categories.forEach(walk);
  };
  nodes.forEach(walk);
  return [...new Set(ids)];
}

function mergeAggregatesIntoTree(nodes: unknown[], map: Map<number, AggRow>): void {
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown> & { id?: number; categories?: unknown[] };
    if (typeof o.id === 'number') {
      const row = map.get(o.id);
      if (row) {
        o.products_aggregate = row.products_aggregate;
        o.products_listed_aggregate = row.products_listed_aggregate;
        o.packages_aggregate = row.packages_aggregate;
      }
    }
    if (Array.isArray(o.categories)) o.categories.forEach(walk);
  };
  nodes.forEach(walk);
}

async function fetchAndMergeAggregatesSingleCompany(
  categories: unknown[],
  companyId: number,
): Promise<void> {
  const ids = collectCategoryIds(categories);
  if (ids.length === 0) return;
  const aggQuery = `
    query CategoryAggregatesSingle($companyId: bigint!, $categoryIds: [bigint!]!) {
      categories(where: { id: { _in: $categoryIds } }) {
        id
        products_aggregate(
          where: {
            _and: [
              { is_deleted: { _eq: false } }
              { company_companies: { _eq: $companyId } }
            ]
          }
        ) {
          aggregate { count }
        }
        products_listed_aggregate: products_aggregate(
          where: {
            _and: [
              { is_deleted: { _eq: false } }
              { is_shelved: { _eq: false } }
              { company_companies: { _eq: $companyId } }
            ]
          }
        ) {
          aggregate { count }
        }
        packages_aggregate(
          where: {
            _and: [
              { company_companies: { _eq: $companyId } }
              { is_shelved: { _eq: false } }
            ]
          }
        ) {
          aggregate { count }
        }
      }
    }
  `;
  const aggRes = await client.execute<{ categories?: AggRow[] }>({
    query: aggQuery,
    variables: { companyId, categoryIds: ids },
  });
  const rows = aggRes?.categories ?? [];
  mergeAggregatesIntoTree(categories, new Map(rows.map((r) => [r.id, r])));
}

async function fetchAndMergeAggregatesMultiCompany(
  categories: unknown[],
  companyIds: number[],
): Promise<void> {
  const ids = collectCategoryIds(categories);
  if (ids.length === 0) return;
  const aggQuery = `
    query CategoryAggregates($companyIds: [bigint!]!, $categoryIds: [bigint!]!) {
      categories(where: { id: { _in: $categoryIds } }) {
        id
        products_aggregate(
          where: {
            _and: [
              { is_deleted: { _eq: false } }
              { company_companies: { _in: $companyIds } }
            ]
          }
        ) {
          aggregate { count }
        }
        products_listed_aggregate: products_aggregate(
          where: {
            _and: [
              { is_deleted: { _eq: false } }
              { is_shelved: { _eq: false } }
              { company_companies: { _in: $companyIds } }
            ]
          }
        ) {
          aggregate { count }
        }
        packages_aggregate(
          where: {
            _and: [
              { company_companies: { _in: $companyIds } }
              { is_shelved: { _eq: false } }
            ]
          }
        ) {
          aggregate { count }
        }
      }
    }
  `;
  const aggRes = await client.execute<{ categories?: AggRow[] }>({
    query: aggQuery,
    variables: { companyIds, categoryIds: ids },
  });
  const rows = aggRes?.categories ?? [];
  mergeAggregatesIntoTree(categories, new Map(rows.map((r) => [r.id, r])));
}

/**
 * 获取分类树（一次请求返回三层：根 → 二级 → 三级）
 */
export async function getCategoryTree(companyId: number, type?: 'product' | 'package') {
  const typeCondition = type ? ', type: { _eq: $type }' : '';
  const nested = `
        ${TREE_CORE}
        company_companies
        categories(
          where: { is_deleted: { _eq: false }${typeCondition} }
          order_by: { sort_order: asc }
        ) {
          ${TREE_CORE}
          company_companies
          categories(
            where: { is_deleted: { _eq: false }${typeCondition} }
            order_by: { sort_order: asc }
          ) {
            ${TREE_CORE}
            company_companies
          }
        }
  `;
  const query = `
    query GetCategoryTree($companyId: bigint!${type ? ', $type: String!' : ''}) {
      categories(
        where: {
          company_companies: { _eq: $companyId }
          is_deleted: { _eq: false }
          parent_categories: { _is_null: true }
          ${type ? 'type: { _eq: $type }' : ''}
        }
        order_by: { sort_order: asc }
      ) {
        ${nested}
      }
    }
  `;

  const variables: { companyId: number; type?: string } = { companyId };
  if (type) variables.type = type;

  const result = await client.execute<{ categories: unknown[] }>({
    query,
    variables,
  });

  const categories = result?.categories || [];
  await fetchAndMergeAggregatesSingleCompany(categories, companyId);
  return categories;
}

/** 递归给节点打上 _companyId（用于多公司合并树） */
function tagTreeWithCompanyId(nodes: any[]): any[] {
  return nodes.map((node: any) => ({
    ...node,
    _companyId: node.company_companies,
    categories: node.categories ? tagTreeWithCompanyId(node.categories) : [],
  }));
}

/**
 * 一次请求获取多公司分类树 + 指定公司的 hidden_category_ids（用于「全部」范围）
 */
export async function getCategoryTreeMultiCompany(params: {
  companyIds: number[];
  hiddenForCompanyId: number;
  type?: 'product' | 'package';
}) {
  const typeCondition = params.type ? ', type: { _eq: $type }' : '';
  const nested = `
        ${TREE_CORE}
        company_companies
        categories(
          where: { is_deleted: { _eq: false }${typeCondition} }
          order_by: { sort_order: asc }
        ) {
          ${TREE_CORE}
          company_companies
          categories(
            where: { is_deleted: { _eq: false }${typeCondition} }
            order_by: { sort_order: asc }
          ) {
            ${TREE_CORE}
            company_companies
          }
        }
  `;
  const query = `
    query GetCategoryTreeMulti($companyIds: [bigint!]!, $hiddenForCompanyId: bigint!${params.type ? ', $type: String!' : ''}) {
      company: companies_by_pk(id: $hiddenForCompanyId) { hidden_category_ids }
      categories(
        where: {
          company_companies: { _in: $companyIds }
          is_deleted: { _eq: false }
          parent_categories: { _is_null: true }
          ${params.type ? ', type: { _eq: $type }' : ''}
        }
        order_by: { sort_order: asc }
      ) {
        ${nested}
      }
    }
  `;
  const variables: Record<string, unknown> = {
    companyIds: params.companyIds,
    hiddenForCompanyId: params.hiddenForCompanyId,
  };
  if (params.type) variables.type = params.type;

  const result = await client.execute<{
    company: { hidden_category_ids: (string | number)[] | null } | null;
    categories: unknown[];
  }>({
    query,
    variables,
  });

  const hidden = result?.company?.hidden_category_ids;
  const hiddenCategoryIds = Array.isArray(hidden) ? hidden.map((id) => Number(id)) : [];
  const categories = result?.categories ?? [];

  await fetchAndMergeAggregatesMultiCompany(categories, params.companyIds);

  return {
    categories: tagTreeWithCompanyId(categories as any[]),
    hiddenCategoryIds,
  };
}

export async function createCategory(category: CategoryInput) {
  const mutation = `
    mutation CreateCategory($category: categories_insert_input!) {
      insert_categories_one(object: $category) {
        id
        name
        icon_url
        level
        sort_order
        type
      }
    }
  `;

  const payload = {
    name: category.name,
    icon_url: category.icon_url,
    company_companies: category.company_companies,
    parent_categories: category.parent_categories ?? null,
    level: category.level,
    route_ui_style: category.route_ui_style,
    sort_order: category.sort_order,
    type: category.type,
  };

  const result = await client.execute({
    query: mutation,
    variables: { category: payload },
  });

  return result?.insert_categories_one;
}

export async function updateCategory(categoryId: number, category: Partial<CategoryInput>) {
  const mutation = `
    mutation UpdateCategory($categoryId: bigint!, $category: categories_set_input!) {
      update_categories_by_pk(pk_columns: { id: $categoryId }, _set: $category) {
        id
        name
        icon_url
        updated_at
        type
      }
    }
  `;

  const payload: Record<string, unknown> = {};
  if (category.name !== undefined) payload.name = category.name;
  if (category.icon_url !== undefined) payload.icon_url = category.icon_url;
  if (category.company_companies !== undefined) payload.company_companies = category.company_companies;
  if (category.parent_categories !== undefined) payload.parent_categories = category.parent_categories;
  if (category.level !== undefined) payload.level = category.level;
  if (category.route_ui_style !== undefined) payload.route_ui_style = category.route_ui_style;
  if (category.sort_order !== undefined) payload.sort_order = category.sort_order;
  if (category.type !== undefined) payload.type = category.type;

  const result = await client.execute({
    query: mutation,
    variables: {
      categoryId,
      category: payload,
    },
  });

  return result?.update_categories_by_pk;
}

export async function getCategoryDetail(categoryId: number) {
  const query = `
    query GetCategoryDetail($categoryId: bigint!) {
      categories_by_pk(id: $categoryId) {
        id
        name
        icon_url
        parent_categories
        level
        route_ui_style
        sort_order
        type
      }
    }
  `;

  const result = await client.execute({
    query,
    variables: { categoryId },
  });

  return result?.categories_by_pk;
}

export async function deleteCategory(categoryId: number) {
  const mutation = `
    mutation DeleteCategory($categoryId: bigint!) {
      update_categories_by_pk(
        pk_columns: { id: $categoryId }
        _set: { is_deleted: true }
      ) {
        id
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { categoryId },
  });

  return result?.update_categories_by_pk;
}

export async function getCategoryChildren(parentId: number, companyId: number, type?: 'product' | 'package') {
  const query = `
    query GetCategoryChildren($parentId: bigint!, $companyId: bigint!${type ? ', $type: String!' : ''}) {
      categories(
        where: {
          parent_categories: { _eq: $parentId }
          company_companies: { _eq: $companyId }
          is_deleted: { _eq: false }
          ${type ? 'type: { _eq: $type }' : ''}
        }
        order_by: { sort_order: asc }
      ) {
        id
        name
        icon_url
        parent_categories
        level
        route_ui_style
        sort_order
        type
      }
    }
  `;
  const variables: { parentId: number; companyId: number; type?: string } = { parentId, companyId };
  if (type) variables.type = type;
  const result = await client.execute({
    query,
    variables,
  });
  return result?.categories || [];
}
