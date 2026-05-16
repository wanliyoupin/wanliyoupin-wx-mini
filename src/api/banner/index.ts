import client from "@/config-lib/hasura-graphql-client/hasura-graphql-client";
import type { BannerArray } from "@/types/companies";

/** 一次请求返回顶部+底部轮播，供首页等合并请求使用 */
export interface BannersResult {
  top: BannerArray;
  bottom: BannerArray;
}

/**
 * 一次请求获取顶部与底部轮播图（合并请求，减少往返）
 */
export async function getBanners(companyId?: number | null): Promise<{ code: number; data: BannersResult; message: string }> {
  try {
    if (!companyId) {
      return {
        code: 0,
        data: { top: [], bottom: [] },
        message: "获取轮播图成功",
      };
    }
    const query = `
      query GetBanners($companyId: bigint!) {
        companies_by_pk(id: $companyId) {
          banner_top
          banner_bottom
        }
      }
    `;
    const result = await client.execute<{
      companies_by_pk: { banner_top: BannerArray | null; banner_bottom: BannerArray | null } | null;
    }>({
      query,
      variables: { companyId },
    });
    const row = result?.companies_by_pk;
    const top: BannerArray = row && Array.isArray(row.banner_top) ? row.banner_top : [];
    const bottom: BannerArray = row && Array.isArray(row.banner_bottom) ? row.banner_bottom : [];
    return {
      code: 0,
      data: { top, bottom },
      message: "获取轮播图成功",
    };
  } catch (error: any) {
    console.error("获取轮播图失败:", error);
    return {
      code: -1,
      data: { top: [], bottom: [] },
      message: "获取轮播图失败: " + (error.message || JSON.stringify(error)),
    };
  }
}

/**
 * 获取顶部轮播图
 * 从 companies 表的 banner_top 字段获取
 */
export async function getTopBanners(companyId?: number | null) {
  const res = await getBanners(companyId);
  return res.code === 0
    ? { code: 0, data: res.data.top, message: "获取顶部轮播图成功" }
    : { code: res.code, data: [] as BannerArray, message: res.message };
}

/**
 * 获取底部轮播图
 * 从 companies 表的 banner_bottom 字段获取
 */
export async function getBottomBanners(companyId?: number | null) {
  const res = await getBanners(companyId);
  return res.code === 0
    ? { code: 0, data: res.data.bottom, message: "获取底部轮播图成功" }
    : { code: res.code, data: [] as BannerArray, message: res.message };
}
