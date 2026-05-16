<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { syncCompanyInfo } from "@/api/company/index";
import { getDefaultCompanyIdCached } from "@/api/config/index";
import {
  companyInfo,
  userInfo,
  restoreUserFromStorage,
  user_token,
  getDefaultCompanyIdFromStorage,
  ensureUserInfoCached,
} from "@/store/userStore";
import { ensureWxSilentAuth } from "@/utils/wxSilentAuth";
import {
  getCompanyUserRoleCached,
  refreshManagedCompanyAfterLogin,
} from "@/utils/auth";
import { setAppReady } from "@/utils/appReady";
import { mergeMiniProgramEntryQuery, parsePositiveIntParam } from "@/utils/sceneParams";
import { isRegisteredMember } from "@/utils/memberSession";
import { getUserJoinedCompanies } from "@/utils/company";

/** 本地已持久化的公司 ID（有效正整数才算「有本地公司」） */
function readValidCompanyIdFromStorage(): number | null {
  try {
    const raw = uni.getStorageSync("companyId");
    if (raw === "" || raw == null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * 从启动/入口参数解析 companyId（直传 companyId、小程序码 scene、普通二维码 q 内 URL 参数）
 * 注意：App.onLaunch 顶层的 options.scene 是微信「场景值」整数（如 1047），不是自定义 scene 字符串。
 * 自定义 scene 在 options.query.scene 中；并与 launch/enter 的 query 合并，避免首次扫码页面未带上 scene。
 */
function extractCompanyIdFromEntryOptions(options: Record<string, unknown> | null | undefined): number | null {
  const q = options?.query as Record<string, string | undefined> | undefined;
  const merged = mergeMiniProgramEntryQuery(q);
  return parsePositiveIntParam(merged.companyId);
}

/** 系统默认公司（配置 / 兜底） */
async function resolveDefaultCompanyId(): Promise<number | null> {
  const defaultRaw = getDefaultCompanyIdFromStorage() ?? (await getDefaultCompanyIdCached());
  if (defaultRaw == null) return null;
  const defaultNum = Number(defaultRaw);
  if (!Number.isInteger(defaultNum) || defaultNum <= 0) return null;
  uni.setStorageSync("companyId", String(defaultNum));
  console.log("使用系统默认公司 ID:", defaultNum);
  return defaultNum;
}

/**
 * 解析冷启动应使用的公司：
 * - 微信访客：入口链接 companyId 优先于本地（任意扫码/分享进入对应公司）
 * - 正式用户且已加入≥1家公司：仅用本地（含手动切换结果）；无本地时用账号关联公司；分享/扫码链接不自动改公司
 * - 正式用户但未加入任何公司：与访客相同，分享/扫码可指定公司
 */
async function resolveInitialCompanyId(launchOptions: Record<string, unknown> | null | undefined): Promise<number | null> {
  await ensureUserInfoCached(true);
  const fromLink = extractCompanyIdFromEntryOptions(launchOptions ?? undefined);
  const fromLocal = readValidCompanyIdFromStorage();
  const member = isRegisteredMember(userInfo.value?.role);

  if (!member) {
    if (fromLink != null) {
      uni.setStorageSync("companyId", String(fromLink));
      console.log("访客：使用启动入口链接中的 companyId:", fromLink);
      return fromLink;
    }
    if (fromLocal != null) return fromLocal;
    return resolveDefaultCompanyId();
  }

  if (fromLocal != null) {
    return fromLocal;
  }

  const joined = await getUserJoinedCompanies();

  if (joined.length > 0) {
    if (userInfo.value?.role === "admin") {
      const managedId = await refreshManagedCompanyAfterLogin();
      if (managedId != null) {
        console.log("管理员：无本地公司，使用管理的公司 ID:", managedId);
        return managedId;
      }
    }
    const id = joined[0].id;
    uni.setStorageSync("companyId", String(id));
    console.log("正式用户：无本地公司，使用账号关联公司:", id);
    return id;
  }

  if (userInfo.value?.role === "admin") {
    const managedId = await refreshManagedCompanyAfterLogin();
    if (managedId != null) {
      console.log("管理员：无本地与成员公司，使用管理的公司 ID:", managedId);
      return managedId;
    }
  }

  // 已登录但未加入任何公司：仍可按分享/扫码链接进入对应公司（与访客一致）
  if (fromLink != null) {
    uni.setStorageSync("companyId", String(fromLink));
    console.log("正式用户（无成员公司）：使用启动入口链接中的 companyId:", fromLink);
    return fromLink;
  }

  return resolveDefaultCompanyId();
}

/** 全局请求就绪后再允许页面请求：onLaunch 内完成公司 ID、公司信息、用户信息等后再 setAppReady，页面请求前 await whenAppReady() */

/** 同步指定公司并刷新用户/角色；公司成员仅能通过管理员添加，不在此自动写入 company_users */
async function applyCompanyAndRefreshUserRole(companyId: number) {
  try {
    await syncCompanyInfo(companyId, true);
    console.log("公司信息同步成功:", companyInfo.value);
  } catch (error) {
    console.error("同步公司信息失败:", error);
  }
  if (user_token.value) {
    try {
      await ensureUserInfoCached(true);
      await getCompanyUserRoleCached(undefined, true);
    } catch (e) {
      console.error("预拉用户/角色失败:", e);
    }
  }
}

onLaunch(async (options) => {
  console.log("App Launch", options);
  try {
    restoreUserFromStorage();
    await ensureWxSilentAuth();

    const finalCompanyId = await resolveInitialCompanyId(options as unknown as Record<string, unknown>);
    if (finalCompanyId == null) {
      console.warn("无法确定公司ID，跳过公司信息同步");
      return;
    }

    await applyCompanyAndRefreshUserRole(finalCompanyId);
  } finally {
    setAppReady();
  }
});

/**
 * 非冷启动入口（如从分享卡进入）：
 * - 访客：若链接带 companyId 则切换过去
 * - 正式用户且已加入公司：不因分享/扫码自动改公司
 * - 正式用户但未加入任何公司：仍可按链接切换公司
 */
onShow(() => {
  void (async () => {
    try {
      await ensureWxSilentAuth();
      const enterOptions = (uni as any).getEnterOptionsSync?.() as Record<string, unknown> | undefined;
      const fromLink = extractCompanyIdFromEntryOptions(enterOptions);
      if (fromLink == null) return;

      await ensureUserInfoCached(true);
      if (userInfo.value?.role === "admin") {
        return;
      }
      if (isRegisteredMember(userInfo.value?.role)) {
        const joined = await getUserJoinedCompanies();
        if (joined.length > 0) {
          return;
        }
      }

      const storageId = readValidCompanyIdFromStorage();
      const storeIdRaw = companyInfo.value?.id;
      const storeId =
        storeIdRaw != null && storeIdRaw !== "" ? Number(storeIdRaw) : NaN;
      const storeMatches =
        Number.isInteger(storeId) && storeId > 0 && storeId === fromLink;
      // 仅 storage 对齐不够：详情页可能先写了 storage，内存 companyInfo 仍是上一家公司
      if (storageId === fromLink && storeMatches) {
        return;
      }

      uni.setStorageSync("companyId", String(fromLink));
      console.log("onShow（访客或无成员公司）：使用本次进入链接中的 companyId:", fromLink);
      void applyCompanyAndRefreshUserRole(fromLink);
    } catch (e) {
      console.error("onShow 解析入口公司失败:", e);
    }
  })();
});

onHide(() => {
  console.log("App Hide");
});
</script>
<style>
</style>
