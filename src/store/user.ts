import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { getUser } from '@/api/user/index'

const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000
const COMPANY_DETAIL_CACHE_TTL_MS = 5 * 60 * 1000
const HOME_PAGE_CACHE_TTL_MS = 5 * 60 * 1000
const STORAGE_KEY_DEFAULT_COMPANY_ID = 'defaultCompanyId'
const STORAGE_KEY_DEFAULT_COMPANY_ID_TS = 'defaultCompanyIdTs'

export interface HomePageCacheData {
  categoryList: any[]
  topBanners: any[]
  bottomBanners: any[]
}

interface CompanyDetailCacheItem {
  data: any
  ts: number
}

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<any>({})
  const user_token = ref<string>('')
  const companyInfo = ref<any>({})
  let userInfoCacheTs = 0

  const defaultCompanyIdCache = ref<number | null>(null)
  const defaultCompanyIdCacheTime = ref<number>(0)

  const homePageCache = ref<{
    companyId: number
    data: HomePageCacheData
    timestamp: number
  } | null>(null)

  const companyDetailCache = reactive<Record<number, CompanyDetailCacheItem>>({})

  function setDefaultCompanyIdCache(companyId: number | null) {
    defaultCompanyIdCache.value = companyId
    defaultCompanyIdCacheTime.value = Date.now()
    try {
      if (companyId != null) {
        uni.setStorageSync(STORAGE_KEY_DEFAULT_COMPANY_ID, companyId)
        uni.setStorageSync(STORAGE_KEY_DEFAULT_COMPANY_ID_TS, Date.now())
      }
    } catch (e) {
      console.error('持久化默认公司 ID 失败', e)
    }
  }

  function isDefaultCompanyIdCacheValid() {
    return defaultCompanyIdCacheTime.value > 0 && Date.now() - defaultCompanyIdCacheTime.value < CONFIG_CACHE_TTL_MS
  }

  function getDefaultCompanyIdFromStorage(): number | null {
    try {
      const id = uni.getStorageSync(STORAGE_KEY_DEFAULT_COMPANY_ID)
      if (id != null && id !== '') {
        const n = Number(id)
        if (!Number.isNaN(n)) return n
      }
    } catch (_) {}
    return null
  }

  function getHomePageCacheValid(companyId: number): HomePageCacheData | null {
    const c = homePageCache.value
    if (!c || c.companyId !== companyId || Date.now() - c.timestamp > HOME_PAGE_CACHE_TTL_MS) return null
    return c.data
  }

  function setHomePageCache(companyId: number, data: HomePageCacheData) {
    homePageCache.value = { companyId, data, timestamp: Date.now() }
  }

  function setCompanyDetailCache(companyId: number, data: any) {
    companyDetailCache[companyId] = { data, ts: Date.now() }
  }

  function getCompanyDetailFromCache(companyId: number): any | null {
    const item = companyDetailCache[companyId]
    if (!item || Date.now() - item.ts > COMPANY_DETAIL_CACHE_TTL_MS) return null
    return item.data
  }

  function invalidateCompanyDetailCache(companyId?: number) {
    if (companyId != null) delete companyDetailCache[companyId]
    else Object.keys(companyDetailCache).forEach((k) => delete companyDetailCache[Number(k)])
  }

  function setUserContext(info: any) {
    const fromUser = info.user && typeof info.user === 'object' ? info.user : {}
    // 登录接口顶层必有 userId；合并进 user 供 company_users 等查询使用（避免仅写了 user 却缺 id）
    userInfo.value = {
      ...fromUser,
      id: fromUser.id ?? info.userId,
    }
    user_token.value = info.token ?? ''
    userInfoCacheTs = Date.now()
    try {
      if (info.token) uni.setStorageSync('token', info.token)
      if (info.userId != null && info.userId !== '') uni.setStorageSync('userId', String(info.userId))
    } catch (e) {
      console.error('持久化 token/userId 失败', e)
    }
  }

  function setCompanyContext(info: any) {
    companyInfo.value = info
    if (info?.id) {
      uni.setStorageSync('companyId', info.id)
    }
  }

  function restoreUserFromStorage(): boolean {
    try {
      const token = uni.getStorageSync('token')
      const userId = uni.getStorageSync('userId')
      if (token && userId) {
        user_token.value = token
        userInfo.value = { id: userId }
        return true
      }
      return false
    } catch (error) {
      console.error('恢复用户状态失败:', error)
      return false
    }
  }

  function updateUserInfo(partial: Partial<Record<string, unknown>>) {
    if (!partial || typeof partial !== 'object') return
    userInfo.value = { ...userInfo.value, ...partial }
  }

  function isUserInfoCacheValid() {
    return userInfoCacheTs > 0 && Date.now() - userInfoCacheTs < CONFIG_CACHE_TTL_MS
  }

  /** @param forceRefresh 为 true 时跳过缓存，每次请求接口更新（如 onLaunch 时使用） */
  async function ensureUserInfoCached(forceRefresh?: boolean): Promise<void> {
    const userId = userInfo.value?.id
    if (!userId) return
    if (!forceRefresh) {
      const u = userInfo.value
      const hasDisplayFields = u?.role != null && (u?.nickname != null || u?.mobile != null)
      if (isUserInfoCacheValid() && hasDisplayFields) return
    }
    try {
      const full = await getUser({ userId: Number(userId) })
      userInfo.value = { ...userInfo.value, ...full }
      userInfoCacheTs = Date.now()
    } catch (e) {
      console.error('拉取用户信息失败', e)
    }
  }

  function clearUserContext() {
    userInfo.value = {}
    user_token.value = ''
    userInfoCacheTs = 0
    try {
      uni.removeStorageSync('token')
      uni.removeStorageSync('userId')
      uni.removeStorageSync('userInfo')
    } catch (_) {}
  }

  return {
    userInfo,
    user_token,
    companyInfo,
    defaultCompanyIdCache,
    defaultCompanyIdCacheTime,
    homePageCache,
    companyDetailCache,
    setDefaultCompanyIdCache,
    isDefaultCompanyIdCacheValid,
    getDefaultCompanyIdFromStorage,
    getHomePageCacheValid,
    setHomePageCache,
    setCompanyDetailCache,
    getCompanyDetailFromCache,
    invalidateCompanyDetailCache,
    setUserContext,
    setCompanyContext,
    restoreUserFromStorage,
    updateUserInfo,
    isUserInfoCacheValid,
    ensureUserInfoCached,
    clearUserContext,
  }
})
