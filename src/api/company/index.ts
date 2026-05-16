import client from "@/config-lib/hasura-graphql-client/hasura-graphql-client";
import {
  setCompanyContext,
  setCompanyDetailCache,
  getCompanyDetailFromCache,
} from "@/store/userStore";

/** C 端公司公开信息（资料库、联系我们、关于我们等） */
export interface CompanyPublicInfo {
  id: number;
  name: string;
  logo_url?: string | null;
  description?: string | null;
  contact_code?: string | null;
  wechat_code?: string | null;
  resource_file_url?: string | null;
}

/**
 * 获取公司公开信息（用于资料库、联系我们、关于我们、订单详情展示微信等）
 */
export async function getCompanyPublicInfo(companyId: number): Promise<CompanyPublicInfo | null> {
  const query = `
    query GetCompanyPublicInfo($companyId: bigint!) {
      companies_by_pk(id: $companyId) {
        id
        name
        logo_url
        description
        contact_code
        wechat_code
        resource_file_url
      }
    }
  `;
  const result = await client.execute<{
    companies_by_pk: CompanyPublicInfo | null;
  }>({
    query,
    variables: { companyId },
  });
  return result?.companies_by_pk ?? null;
}

/**
 * 同步公司信息（C 端时序 2）
 * 一次请求拉取公司完整配置，写入内存缓存（5 分钟），后续商品/套餐/分类等可直接用缓存。
 * @param forceRefresh 为 true 时跳过缓存，每次请求接口更新（如 onLaunch 时使用）
 */
export async function syncCompanyInfo(
  companyId: string | number,
  forceRefresh?: boolean
) {
  const id = Number(companyId);
  if (!forceRefresh) {
    const cached = getCompanyDetailFromCache(id);
    if (cached && typeof cached === "object") {
      setCompanyContext({
        id: cached.id,
        name: cached.name,
        logo_url: cached.logo_url ?? undefined,
      });
      return cached;
    }
  }
  try {
    const query = `
      query GetCompanyFullConfig($companyId: bigint!) {
        companies_by_pk(id: $companyId) {
          id
          name
          logo_url
          mode_for_price
          default_for_price_factor
          default_for_can_view_price
          banner_top
          banner_bottom
          hidden_category_ids
          hidden_product_ids
          hidden_package_ids
          description
          contact_code
          wechat_code
          resource_file_url
        }
      }
    `;

    const result = await client.execute<{
      companies_by_pk: {
        id: number;
        name: string;
        logo_url?: string | null;
        mode_for_price?: string | null;
        default_for_price_factor?: number | string | null;
        default_for_can_view_price?: boolean | null;
        banner_top?: any;
        banner_bottom?: any;
        hidden_category_ids?: (string | number)[] | null;
        hidden_product_ids?: (string | number)[] | null;
        hidden_package_ids?: (string | number)[] | null;
        description?: string | null;
        contact_code?: string | null;
        wechat_code?: string | null;
        resource_file_url?: string | null;
      } | null;
    }>({
      query,
      variables: { companyId: id },
    });

    if (!result.companies_by_pk) {
      console.warn("公司信息不存在:", companyId);
      return null;
    }

    const row = result.companies_by_pk;
    const companyBasic = {
      id: row.id,
      name: row.name,
      logo_url: row.logo_url,
      mode_for_price: row.mode_for_price,
      default_for_price_factor: row.default_for_price_factor,
      default_for_can_view_price: row.default_for_can_view_price,
    };

    setCompanyContext(companyBasic);
    setCompanyDetailCache(id, row);

    return row;
  } catch (error: any) {
    console.error("同步公司信息失败:", error);
    throw error;
  }
}
