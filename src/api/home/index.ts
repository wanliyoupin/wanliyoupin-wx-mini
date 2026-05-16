import client from "@/config-lib/hasura-graphql-client/hasura-graphql-client";
import { getCompanyDetailFromCache } from "@/store/userStore";
import { getDefaultCompanyIdCached } from "@/api/config/index";
import { mapCategoryNode } from "@/api/category/index";
import { getBanners } from "@/api/banner/index";
import type { BannerArray } from "@/types/companies";

export interface HomePageData {
  banners: { top: BannerArray; bottom: BannerArray };
  categoryList: any[];
}

const CATEGORY_TREE_FIELDS = `
  id
  name
  sort_order
  route_ui_style
  icon_url
  parent_categories
  level
  type
  categories(
    where: { is_deleted: { _eq: false }, type: { _eq: $type } }
    order_by: { sort_order: asc }
  ) {
    id
    name
    sort_order
    route_ui_style
    icon_url
    parent_categories
    level
    type
    categories(
      where: { is_deleted: { _eq: false }, type: { _eq: $type } }
      order_by: { sort_order: asc }
    ) {
      id
      name
      sort_order
      route_ui_style
      icon_url
      parent_categories
      level
      type
    }
  }
`;

/**
 * 首页只请求分类树；轮播、隐藏分类从全局公司配置缓存读取（App 已拉取）
 */
export async function getHomePageData(
  companyId: number | null | undefined
): Promise<{ code: number; data: HomePageData; message: string }> {
  const currentCompanyId = companyId ?? null;
  if (!currentCompanyId) {
    return {
      code: 0,
      data: { banners: { top: [], bottom: [] }, categoryList: [] },
      message: "获取首页数据成功",
    };
  }

  try {
    const row = getCompanyDetailFromCache(currentCompanyId);
    let top: BannerArray =
      row && Array.isArray(row.banner_top) ? row.banner_top : [];
    let bottom: BannerArray =
      row && Array.isArray(row.banner_bottom) ? row.banner_bottom : [];
    // 公司详情缓存可能尚未就绪（App syncCompanyInfo 晚于首页加载），轮播为空时直接请求接口兜底
    if (top.length === 0 && bottom.length === 0) {
      const bannerRes = await getBanners(currentCompanyId);
      if (bannerRes?.code === 0 && bannerRes.data) {
        top = bannerRes.data.top ?? [];
        bottom = bannerRes.data.bottom ?? [];
      }
    }
    const hiddenCategoryIds: number[] = Array.isArray(row?.hidden_category_ids)
      ? row.hidden_category_ids.map((id: string | number) => Number(id))
      : [];

    const defaultCompanyId = await getDefaultCompanyIdCached();
    const companyIds: number[] = [currentCompanyId];
    if (defaultCompanyId != null && defaultCompanyId !== currentCompanyId) {
      companyIds.push(defaultCompanyId);
    }
    const isSingleCompany = companyIds.length === 1;
    const whereConditions = [
      "{ parent_categories: { _is_null: true } }",
      "{ is_deleted: { _eq: false } }",
      "{ type: { _eq: $type } }",
      isSingleCompany
        ? "{ company_companies: { _eq: $companyId } }"
        : "{ company_companies: { _in: $companyIds } }",
    ];

    const query = isSingleCompany
      ? `
      query GetHomePageCategories($companyId: bigint!, $type: String!) {
        categories(
          where: { _and: [ ${whereConditions.join(", ")} ] }
          order_by: { sort_order: asc }
        ) {
          ${CATEGORY_TREE_FIELDS}
        }
      }
    `
      : `
      query GetHomePageCategoriesMulti($companyIds: [bigint!]!, $type: String!) {
        categories(
          where: { _and: [ ${whereConditions.join(", ")} ] }
          order_by: { sort_order: asc }
        ) {
          ${CATEGORY_TREE_FIELDS}
        }
      }
    `;

    const variables: Record<string, unknown> = isSingleCompany
      ? { companyId: companyIds[0], type: "product" }
      : { companyIds, type: "product" };

    const result = await client.execute<{ categories: any[] }>({
      query,
      variables,
    });

    const rawList = result?.categories ?? [];
    const categoryList = rawList
      .map((c) => mapCategoryNode(c, hiddenCategoryIds))
      .filter(Boolean);

    return {
      code: 0,
      data: {
        banners: { top, bottom },
        categoryList,
      },
      message: "获取首页数据成功",
    };
  } catch (error: any) {
    console.error("获取首页数据失败:", error);
    return {
      code: -1,
      data: {
        banners: { top: [], bottom: [] },
        categoryList: [],
      },
      message: "获取首页数据失败: " + (error?.message ?? String(error)),
    };
  }
}
