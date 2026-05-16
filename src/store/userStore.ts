/**
 * 兼容层：从 Pinia user store 导出 state/actions，保证原有 import 写法仍可用且响应式一致
 * 需解包 ref，否则 companyInfo.value?.id 得到的是 Ref 而非公司对象，导致套餐/分类/商品管理页「只看自己公司」「只看总部」筛选失效
 */
import { computed } from 'vue'
import { getPinia } from './piniaInstance'
import { useUserStore, type HomePageCacheData } from './user'

export type { HomePageCacheData }

function getStore() {
  const p = getPinia()
  if (!p) throw new Error('Pinia not initialized')
  return useUserStore(p)
}

function unwrapRef<T>(v: T | { value: T } | undefined | null): T {
  if (v == null) return undefined as T
  if (typeof v === 'object' && v !== null && 'value' in v) return (v as { value: T }).value
  return v as T
}

export const userInfo = computed(() => unwrapRef(getStore().userInfo) ?? {})
export const user_token = computed(() => unwrapRef(getStore().user_token) ?? '')
export const companyInfo = computed(() => unwrapRef(getStore().companyInfo) ?? {})
export const defaultCompanyIdCache = computed(() => unwrapRef(getStore().defaultCompanyIdCache) ?? null)
export const defaultCompanyIdCacheTime = computed(() => unwrapRef(getStore().defaultCompanyIdCacheTime) ?? 0)
export const homePageCache = computed(() => unwrapRef(getStore().homePageCache) ?? null)
export const companyDetailCache = computed(() => getStore().companyDetailCache)


export const setDefaultCompanyIdCache = (companyId: number | null) => getStore().setDefaultCompanyIdCache(companyId)
export const isDefaultCompanyIdCacheValid = () => getStore().isDefaultCompanyIdCacheValid()
export const getDefaultCompanyIdFromStorage = () => getStore().getDefaultCompanyIdFromStorage()
export const getHomePageCacheValid = (companyId: number) => getStore().getHomePageCacheValid(companyId)
export const setHomePageCache = (companyId: number, data: HomePageCacheData) => getStore().setHomePageCache(companyId, data)
export const setCompanyDetailCache = (companyId: number, data: any) => getStore().setCompanyDetailCache(companyId, data)
export const getCompanyDetailFromCache = (companyId: number) => getStore().getCompanyDetailFromCache(companyId)
export const invalidateCompanyDetailCache = (companyId?: number) => getStore().invalidateCompanyDetailCache(companyId)
export const setUserContext = (info: any) => getStore().setUserContext(info)
export const setCompanyContext = (info: any) => getStore().setCompanyContext(info)
export const restoreUserFromStorage = () => getStore().restoreUserFromStorage()
export const updateUserInfo = (partial: Partial<Record<string, unknown>>) => getStore().updateUserInfo(partial)
export const isUserInfoCacheValid = () => getStore().isUserInfoCacheValid()
export const ensureUserInfoCached = (forceRefresh?: boolean) => getStore().ensureUserInfoCached(forceRefresh)
export const clearUserContext = () => getStore().clearUserContext()
