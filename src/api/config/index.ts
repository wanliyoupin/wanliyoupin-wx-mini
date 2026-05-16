import client from "@/config-lib/hasura-graphql-client/hasura-graphql-client";
import {
  defaultCompanyIdCache,
  isDefaultCompanyIdCacheValid,
  setDefaultCompanyIdCache,
  getDefaultCompanyIdFromStorage,
} from "@/store/userStore";

/**
 * 获取配置值
 * @param configName 配置名称
 * @returns 配置值（可能是 string、number、array 或 object）
 */
export async function getConfig(configName: string): Promise<any> {
  try {
    const query = `
      query GetConfig($name: String!) {
        configs(where: { name: { _eq: $name } }, limit: 1) {
          id
          name
          value
          description
        }
      }
    `;

    const result = await client.execute({
      query,
      variables: { name: configName },
    });

    if (result?.configs && result.configs.length > 0) {
      return result.configs[0].value;
    }

    return null;
  } catch (error) {
    console.error(`获取配置失败 [${configName}]:`, error);
    return null;
  }
}

/** 从 value 中解析出公司 ID */
function parseCompanyIdFromConfigValue(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "object" && value !== null) {
    if (typeof value.content === "number") return value.content;
    if (typeof value.companyId === "number") return value.companyId;
    if (typeof value.id === "number") return value.id;
  }
  return null;
}

/**
 * 获取默认公司ID：优先内存缓存 → 本地存储（5 分钟内）→ 请求 config 表
 * @param forceRefresh 为 true 时跳过缓存强制拉取
 */
export async function getDefaultCompanyIdCached(forceRefresh = false): Promise<number | null> {
  if (!forceRefresh && isDefaultCompanyIdCacheValid() && defaultCompanyIdCache.value != null) {
    return defaultCompanyIdCache.value;
  }
  if (!forceRefresh) {
    const fromStorage = getDefaultCompanyIdFromStorage();
    if (fromStorage != null) {
      setDefaultCompanyIdCache(fromStorage);
      return fromStorage;
    }
  }
  const id = await getDefaultCompanyId();
  if (id != null) setDefaultCompanyIdCache(id);
  return id;
}

/**
 * 获取默认公司ID（成功后会更新全局缓存，供 getDefaultCompanyIdCached 使用）
 * @returns 默认公司ID（number），如果配置不存在则返回 null
 */
export async function getDefaultCompanyId(): Promise<number | null> {
  try {
    const value = await getConfig("default_company_id");
    const id = parseCompanyIdFromConfigValue(value);
    if (id != null) setDefaultCompanyIdCache(id);
    return id;
  } catch (error) {
    console.error("获取默认公司ID失败:", error);
    return null;
  }
}
