<template>
  <view class="mine-page">
    <!-- 顶部装饰背景 -->
    <view class="header-bg">
      <view class="bg-decoration"></view>
    </view>

    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="user-header">
        <view class="avatar-section" @click="handleAvatarClick">
          <view class="avatar-wrapper">
            <image
              class="avatar"
              :src="userInfo?.avatar_url || '../../static/mine/touxiang.png'"
              mode="aspectFill"
            ></image>
            <view v-if="isMember" class="avatar-badge">
              <text class="badge-icon">✓</text>
            </view>
          </view>
        </view>
        <view class="user-info">
          <view class="nickname-section">
            <text class="nickname">{{ sessionTitle }}</text>
            <view v-if="isAdmin" class="role-badge admin">
              <text class="role-text">平台管理员</text>
            </view>
            <view
              v-else-if="isCompanyAdminUser"
              class="role-badge company-admin"
            >
              <text class="role-text">公司管理员</text>
            </view>
            <view
              v-else-if="userInfo?.role === 'wx_guest_user'"
              class="role-badge guest"
            >
              <text class="role-text">访客</text>
            </view>
            <view v-else-if="isCompanyUser" class="role-badge user">
              <text class="role-text">公司用户</text>
            </view>
          </view>
          <view v-if="isMember && userInfo?.mobile" class="phone-section">
            <text class="phone-icon">📱</text>
            <text class="phone-number">{{ userInfo.mobile }}</text>
          </view>
          <view
            v-if="user_token && !isMember"
            class="login-prompt phone-auth-prompt"
          >
            <text class="prompt-text"
              >请使用已向管理员登记的本机微信手机号授权，成为正式用户。</text
            >
            <button
              class="login-btn"
              open-type="getPhoneNumber"
              @getphonenumber="onPhoneNumberAuth"
            >
              手机号快捷授权
            </button>
            <view class="admin-login-hint" @click.stop="goToPasswordLogin"
              >管理员账号密码登录</view
            >
          </view>
          <view
            v-else-if="isMember"
            class="password-link"
            @click.stop="goToSetPassword"
          >
            <text class="password-link-icon">🔒</text>
            <text class="password-link-text">设置密码</text>
          </view>
          <view v-else-if="!user_token" class="login-prompt">
            <text class="prompt-text">正在初始化，请稍候…</text>
          </view>
        </view>
      </view>
    </view>
    <!-- 无公司账号提示：进入某公司但该用户未注册为公司用户时显示 -->
    <view
      v-if="user_token && companyInfo?.id && !isCompanyUser"
      class="register-tip"
    >
      <view class="tip-icon">⚠️</view>
      <view class="tip-content">
        <text class="tip-title">提示</text>
        <text class="tip-text"
          >您在公司尚未注册账号或开通价格访问权限，请联系客服管理员为您注册或开通后使用</text
        >
      </view>
    </view>
    <!-- 快捷功能区域 -->
    <view class="quick-actions">
      <view class="action-item" @click="goToOrders">
        <view class="action-icon-wrapper order">
          <image
            class="action-icon"
            src="../../static/mine/order.png"
            mode="aspectFit"
          ></image>
        </view>
        <text class="action-label">我的订单</text>
      </view>
      <view class="action-item" @click="goToFiles">
        <view class="action-icon-wrapper resource">
          <image
            class="action-icon"
            src="../../static/mine/ziliao.png"
            mode="aspectFit"
          ></image>
        </view>
        <text class="action-label">资料库</text>
      </view>
      <view class="action-item" @click="goToAddressList">
        <view class="action-icon-wrapper settings">
          <image
            class="action-icon"
            src="../../static/mine/shezhi.png"
            mode="aspectFit"
          ></image>
        </view>
        <text class="action-label">地址管理</text>
      </view>
      <view v-if="user_token" class="action-item" @click="goToSwitchCompany">
        <view class="action-icon-wrapper company-switch">
          <text class="action-icon-emoji">🏢</text>
        </view>
        <text class="action-label">切换公司</text>
      </view>
    </view>

    <!-- 超级管理员区域：仅 user.role === admin 可见 -->
    <view v-if="isAdmin" class="admin-section">
      <view class="section-header">
        <text class="section-title">超级管理员</text>
      </view>
      <view class="admin-grid">
        <view class="admin-item" @click="goToCompanyManagement">
          <view class="admin-icon-wrapper company">
            <text class="admin-icon">🏢</text>
          </view>
          <text class="admin-label">公司管理</text>
          <text class="admin-desc">管理公司信息</text>
        </view>
        <view
          class="admin-item"
          @tap="goToUserManagement"
          @click="goToUserManagement"
        >
          <view class="admin-icon-wrapper user">
            <text class="admin-icon">👥</text>
          </view>
          <text class="admin-label">账号管理</text>
          <text class="admin-desc">管理用户账号</text>
        </view>
      </view>
    </view>

    <!-- 我的公司板块：进入某公司且 company_user.role === admin 可见 -->
    <view v-if="isCompanyAdminUser" class="admin-section">
      <view class="section-header">
        <text class="section-title"
          >我的公司{{
            companyInfo?.name ? `（${companyInfo.name}）` : ""
          }}</text
        >
      </view>
      <view class="admin-grid">
        <view class="admin-item" @click="goToCompanySettings">
          <view class="admin-icon-wrapper settings">
            <text class="admin-icon">⚙️</text>
          </view>
          <text class="admin-label">公司设置</text>
          <text class="admin-desc">设置logo、轮播图、名称</text>
        </view>
        <view class="admin-item" @click="goToCategoryManagement">
          <view class="admin-icon-wrapper category">
            <text class="admin-icon">📂</text>
          </view>
          <text class="admin-label">分类管理</text>
          <text class="admin-desc">管理本公司下的分类</text>
        </view>
        <view class="admin-item" @click="goToProductManagement">
          <view class="admin-icon-wrapper product">
            <text class="admin-icon">📦</text>
          </view>
          <text class="admin-label">商品管理</text>
          <text class="admin-desc">管理本公司下的商品</text>
        </view>
        <view class="admin-item" @click="goToPackageManagement">
          <view class="admin-icon-wrapper package">
            <text class="admin-icon">🎁</text>
          </view>
          <text class="admin-label">套餐管理</text>
          <text class="admin-desc">管理本公司下的套餐</text>
        </view>
        <view class="admin-item" @click="goToCompanyUserManagement">
          <view class="admin-icon-wrapper user">
            <text class="admin-icon">👥</text>
          </view>
          <text class="admin-label">用户管理</text>
          <text class="admin-desc">管理本公司下的用户</text>
        </view>
        <view class="admin-item" @click="goToCompanyOrderManagement">
          <view class="admin-icon-wrapper order">
            <text class="admin-icon">📋</text>
          </view>
          <text class="admin-label">订单管理</text>
          <text class="admin-desc">查看本公司下的用户订单</text>
        </view>
      </view>
    </view>

    <!-- C 端：联系我们、关于我们（有公司且配置了联系/介绍时展示） -->
    <view
      v-if="
        user_token &&
        companyInfo?.id &&
        companyPublicInfo &&
        (companyPublicInfo.contact_code || companyPublicInfo.description)
      "
      class="more-section"
    >
      <view class="section-header">
        <text class="section-title">更多</text>
      </view>
      <view class="more-grid">
        <view
          v-if="companyPublicInfo.contact_code || companyPublicInfo.description"
          class="more-item"
          @click="goToContact"
        >
          <text class="more-icon">📞</text>
          <text class="more-label">联系我们</text>
        </view>
        <view
          v-if="companyPublicInfo.description"
          class="more-item"
          @click="showAboutModal = true"
        >
          <text class="more-icon">ℹ️</text>
          <text class="more-label">关于我们</text>
        </view>
      </view>
    </view>

    <!-- 关于我们弹窗 -->
    <view
      v-if="showAboutModal"
      class="modal-overlay"
      @click="showAboutModal = false"
    >
      <view class="modal-content about-modal" @click.stop>
        <view class="about-modal-accent" />
        <view class="modal-header about-modal-header">
          <text class="modal-title">关于我们</text>
          <view class="modal-close-wrap" @click.stop="showAboutModal = false">
            <text class="modal-close">×</text>
          </view>
        </view>
        <scroll-view
          scroll-y
          class="modal-body about-modal-body"
          :show-scrollbar="false"
        >
          <view v-if="companyPublicInfo" class="about-brand">
            <image
              v-if="companyPublicInfo.logo_url"
              class="about-logo"
              :src="companyPublicInfo.logo_url"
              mode="aspectFill"
            />
            <view v-else class="about-logo-placeholder">
              <text class="about-logo-letter">{{
                (companyPublicInfo.name || "公").charAt(0)
              }}</text>
            </view>
            <text class="about-co-name">{{ companyPublicInfo.name }}</text>
          </view>
          <view
            v-if="companyPublicInfo?.description"
            class="about-text-card"
          >
            <text class="about-desc">{{ companyPublicInfo.description }}</text>
          </view>
          <view v-else class="empty-tip">暂无介绍</view>
        </scroll-view>
      </view>
    </view>

    <!-- 退出登录 -->
    <view v-if="user_token && isMember" class="logout-section">
      <button class="logout-btn" @click="handleLogout">退出登录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { whenAppReady } from "@/utils/appReady";
import { onShow } from "@dcloudio/uni-app";
import {
  userInfo,
  user_token,
  companyInfo,
  clearUserContext,
  getCompanyDetailFromCache,
  ensureUserInfoCached,
} from "@/store/userStore";
import {
  getCompanyUserRoleCached,
  clearCompanyUserRoleCache,
  isCompanyUser as queryHasCompanyMembershipRow,
} from "@/utils/auth";
import { ensureWxSilentAuth } from "@/utils/wxSilentAuth";
import { isRegisteredMember } from "@/utils/memberSession";
import { completePhoneNumberAuth } from "@/utils/wechatPhoneAuth";
import { getCompanyPublicInfo, syncCompanyInfo } from "@/api/company/index";
import type { CompanyPublicInfo } from "@/api/company/index";

const isCompanyUser = ref(false);
const companyPublicInfo = ref<CompanyPublicInfo | null>(null);
const showAboutModal = ref(false);
const isAdmin = ref(false);
const isCompanyAdminUser = ref(false);

const isMember = computed(() => isRegisteredMember(userInfo.value?.role));

const displayNickname = computed(() => {
  const u = userInfo.value as {
    nickname?: string;
    mobile?: string;
    role?: string;
  };
  return u?.nickname || u?.mobile || "用户";
});

/** 访客展示为未登录；正式用户展示昵称/手机号 */
const sessionTitle = computed(() => {
  if (!user_token.value) return "未登录";
  if (!isMember.value) return "未登录";
  return displayNickname.value;
});

const PERMISSIONS_CACHE_TTL = 5 * 60 * 1000;
/** 必须包含 companyId：切换公司后旧缓存不能与当前公司混用 */
const permissionsCache = ref<{
  userId: number;
  companyId: number | null;
  isAdmin: boolean;
  isCompanyUser: boolean;
  isCompanyAdminUser: boolean;
  ts: number;
} | null>(null);

function readStoredCompanyId(): number | null {
  try {
    const raw = uni.getStorageSync("companyId");
    if (raw === "" || raw == null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function normalizeCompanyId(id: unknown): number | null {
  if (id == null || id === "") return null;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// 权限与展示数据：先确保全局 userInfo 已拉取（昵称、头像、role），再根据缓存或接口得到 isAdmin / 公司角色
const checkUserPermissions = async () => {
  const userId = userInfo.value?.id;
  if (!user_token.value || !userId) {
    isCompanyUser.value = false;
    isAdmin.value = false;
    isCompanyAdminUser.value = false;
    permissionsCache.value = null;
    return;
  }

  // 先保证全局 userInfo 有昵称、头像、role（从 App 缓存或接口拉取），我的页直接读 userInfo 展示
  await ensureUserInfoCached();

  const currentCompanyId = normalizeCompanyId(companyInfo.value?.id);
  const cache = permissionsCache.value;
  if (
    cache &&
    cache.userId === Number(userId) &&
    cache.companyId === currentCompanyId &&
    Date.now() - cache.ts < PERMISSIONS_CACHE_TTL
  ) {
    isAdmin.value = cache.isAdmin;
    isCompanyUser.value = cache.isCompanyUser;
    isCompanyAdminUser.value = cache.isCompanyAdminUser;
    return;
  }

  isAdmin.value = userInfo.value?.role === "admin";

  if (currentCompanyId != null) {
    const role = await getCompanyUserRoleCached(currentCompanyId, true);
    /** 是否存在 company_users 行；无行时 getCompanyUserRoleCached 仍可能返回公司 default_* 策略，不能用来判断成员身份 */
    isCompanyUser.value = await queryHasCompanyMembershipRow(currentCompanyId);
    isCompanyAdminUser.value = (role?.isAdmin ?? false) && isCompanyUser.value;
  } else {
    isCompanyUser.value = false;
    isCompanyAdminUser.value = false;
  }

  permissionsCache.value = {
    userId: Number(userId),
    companyId: currentCompanyId,
    isAdmin: isAdmin.value,
    isCompanyUser: isCompanyUser.value,
    isCompanyAdminUser: isCompanyAdminUser.value,
    ts: Date.now(),
  };
};

const goToPasswordLogin = () => {
  uni.navigateTo({
    url: "/pages/login/index",
  });
};

const onPhoneNumberAuth = async (e: {
  detail?: { errMsg?: string; code?: string };
}) => {
  const detail = e?.detail ?? {};
  const { ok, message } = await completePhoneNumberAuth(detail);
  if (ok) {
    uni.showToast({ title: "授权成功", icon: "success" });
    permissionsCache.value = null;
    await checkUserPermissions();
    await loadCompanyPublicSection();
    return;
  }
  if (message) {
    uni.showToast({ title: message, icon: "none", duration: 3200 });
  }
};

function needUserId(): boolean {
  if (!userInfo.value?.id) {
    uni.showToast({ title: "请稍候…", icon: "none" });
    return false;
  }
  return true;
}

// 跳转到订单列表
const goToOrders = () => {
  if (!needUserId()) return;
  uni.navigateTo({
    url: "/pages/order-list/index",
  });
};

// 跳转到资料库
const goToFiles = () => {
  if (!needUserId()) return;
  uni.navigateTo({
    url: "/pages/resource/index",
  });
};

// 跳转到设置密码
const goToSetPassword = () => {
  if (!needUserId()) return;
  if (!isRegisteredMember(userInfo.value?.role)) {
    uni.showToast({ title: "请先完成手机号授权", icon: "none" });
    return;
  }
  uni.navigateTo({
    url: "/pages/set-password/index",
  });
};

// 跳转到地址管理
const goToAddressList = () => {
  if (!needUserId()) return;
  uni.navigateTo({
    url: "/pages/address-list/index",
  });
};

// 跳转到联系客服页
const goToContact = () => {
  if (!needUserId()) return;
  const companyId = companyInfo.value?.id;
  if (!companyId) {
    uni.showToast({
      title: "请先选择公司",
      icon: "none",
    });
    return;
  }
  uni.navigateTo({
    url: `/pages/contact/index?companyId=${companyId}`,
  });
};

// 跳转到切换公司页（已加入的公司列表，可切换当前访问的公司）
const goToSwitchCompany = () => {
  if (!needUserId()) return;
  uni.navigateTo({
    url: "/pages/switch-company/index",
  });
};

// 跳转到公司设置（公司管理员）
const goToCompanySettings = () => {
  if (!needUserId()) return;
  if (!companyInfo.value?.id) {
    uni.showToast({
      title: "公司信息不存在",
      icon: "none",
    });
    return;
  }
  uni.navigateTo({
    url: `/subPackages/company/company-settings/index?id=${companyInfo.value.id}`,
  });
};

// 跳转到分类管理（公司管理员）
const goToCategoryManagement = () => {
  if (!needUserId()) return;
  uni.navigateTo({
    url: "/subPackages/company/category-list/index",
  });
};

// 跳转到商品管理（公司管理员）
const goToProductManagement = () => {
  if (!needUserId()) return;
  uni.navigateTo({
    url: "/subPackages/company/product-list/index",
  });
};

// 跳转到套餐管理（公司管理员）
const goToPackageManagement = () => {
  if (!needUserId()) return;
  uni.navigateTo({
    url: "/subPackages/company/package-list/index",
  });
};

// 跳转到公司用户管理（公司管理员）
const goToCompanyUserManagement = () => {
  if (!needUserId()) return;
  uni.navigateTo({
    url: "/subPackages/company/company-user-list/index",
  });
};

// 跳转到公司订单管理（公司管理员，查看本公司下的用户订单）
const goToCompanyOrderManagement = () => {
  if (!needUserId()) return;
  if (!companyInfo.value?.id) {
    uni.showToast({
      title: "公司信息不存在",
      icon: "none",
    });
    return;
  }
  uni.navigateTo({
    url: "/subPackages/company/order-list/index",
  });
};

// 跳转到公司管理（平台管理员）
const goToCompanyManagement = () => {
  if (!needUserId()) return;
  uni.navigateTo({
    url: "/subPackages/admin/company-list/index",
  });
};

// 跳转到账号管理（平台管理员）
const goToUserManagement = () => {
  console.log("点击账号管理");
  if (!needUserId()) return;
  console.log("准备跳转到账号管理页面");
  uni.navigateTo({
    url: "/subPackages/admin/user-list/index",
    success: () => {
      console.log("跳转成功");
    },
    fail: (err) => {
      console.error("跳转失败:", err);
      uni.showToast({
        title: "页面跳转失败: " + (err.errMsg || "未知错误"),
        icon: "none",
        duration: 3000,
      });
    },
  });
};

// 处理头像点击
const handleAvatarClick = () => {
  if (!needUserId()) return;
  uni.navigateTo({
    url: "/pages/user-profile/index",
  });
};

// 退出登录：清 JWT 后必须再次静默登录，否则会长期无 token，卡在「正在初始化」
const handleLogout = () => {
  uni.showModal({
    title: "提示",
    content: "确定要退出登录吗？",
    success: (res) => {
      void (async () => {
        if (!res.confirm) return;
        clearUserContext();
        clearCompanyUserRoleCache();
        permissionsCache.value = null;
        isCompanyUser.value = false;
        isAdmin.value = false;
        isCompanyAdminUser.value = false;

        try {
          await ensureWxSilentAuth();
          await ensureUserInfoCached(true);
          await checkUserPermissions();
          await loadCompanyPublicSection();
        } catch (e) {
          console.error("退出后恢复访客身份失败:", e);
        }

        uni.showToast({
          title: "已退出登录",
          icon: "success",
        });
      })();
    },
  });
};

async function loadCompanyPublicSection() {
  const companyId = normalizeCompanyId(companyInfo.value?.id);
  if (!companyId) {
    companyPublicInfo.value = null;
    return;
  }
  const cached = getCompanyDetailFromCache(companyId);
  if (cached && typeof cached === "object") {
    companyPublicInfo.value = {
      id: cached.id,
      name: cached.name,
      logo_url: cached.logo_url ?? null,
      description: cached.description ?? null,
      contact_code: cached.contact_code ?? null,
      wechat_code: cached.wechat_code ?? null,
      resource_file_url: cached.resource_file_url ?? null,
    };
    return;
  }
  getCompanyPublicInfo(companyId)
    .then((info) => {
      companyPublicInfo.value = info;
    })
    .catch(() => {
      companyPublicInfo.value = null;
    });
}

// storage 与 Pinia 不一致时（例如切公司后 tab 页 onShow 早于上下文写回），先对齐再算权限
async function ensureCompanyContextMatchesStorage(): Promise<void> {
  const stored = readStoredCompanyId();
  const storeId = normalizeCompanyId(companyInfo.value?.id);
  if (stored != null && storeId !== stored) {
    permissionsCache.value = null;
    try {
      await syncCompanyInfo(stored, true);
    } catch (e) {
      console.error("我的页：对齐公司上下文失败", e);
    }
  }
}

// 切换公司后即使未再次触发 onShow，store 的 companyId 变化也应刷新权限（tab 页实例常保留在内存）
watch(
  () => normalizeCompanyId(companyInfo.value?.id),
  async (id, prev) => {
    if (id === prev) return;
    await whenAppReady();
    if (!user_token.value) return;
    permissionsCache.value = null;
    await checkUserPermissions();
    await loadCompanyPublicSection();
  },
);

// onShow：等全局就绪后再拉取/补齐 userInfo 与权限，再填公司公开信息（优先缓存）
onShow(async () => {
  await whenAppReady();
  if (!user_token.value) {
    try {
      await ensureWxSilentAuth();
      await ensureUserInfoCached(true);
    } catch (e) {
      console.warn("我的页：补齐静默登录失败", e);
    }
  }
  await ensureCompanyContextMatchesStorage();
  await checkUserPermissions();
  await loadCompanyPublicSection();
});
</script>

<style scoped>
.mine-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%);
  padding-bottom: 40rpx;
}

/* 顶部背景装饰 */
.header-bg {
  position: relative;
  height: 280rpx;
  overflow: hidden;
}

.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  transform: skewY(-3deg);
  transform-origin: top left;
  margin-top: -40rpx;
}

/* 用户信息卡片 */
.user-card {
  position: relative;
  margin: -200rpx 30rpx 30rpx;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 40rpx;
  box-shadow: 0 8rpx 32rpx rgba(102, 126, 234, 0.15);
  z-index: 10;
}

.user-header {
  display: flex;
  align-items: flex-start;
  gap: 24rpx;
}

.avatar-section {
  flex-shrink: 0;
}

.avatar-wrapper {
  position: relative;
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  overflow: hidden;
  border: 4rpx solid #ffffff;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
}

.avatar {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.avatar-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 36rpx;
  height: 36rpx;
  background: #52c41a;
  border-radius: 50%;
  border: 3rpx solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-icon {
  font-size: 20rpx;
  color: #ffffff;
  font-weight: bold;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.nickname-section {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.nickname {
  font-size: 40rpx;
  font-weight: bold;
  color: #1a1a1a;
}

.role-badge {
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.role-badge.admin {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  color: #ffffff;
}

.role-badge.company-admin {
  background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
  color: #ffffff;
}

.role-badge.user {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
  color: #333333;
}

.role-badge.guest {
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  color: #3730a3;
}

.role-text {
  font-size: 22rpx;
  font-weight: 500;
}

.guest-bind-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 16rpx;
  padding: 20rpx 24rpx;
  background: #f5f3ff;
  border-radius: 12rpx;
  border: 1rpx solid #e9d5ff;
}

.guest-bind-text {
  flex: 1;
  font-size: 26rpx;
  color: #5b21b6;
  line-height: 1.4;
}

.guest-bind-arrow {
  font-size: 32rpx;
  color: #7c3aed;
  font-weight: 300;
}

.phone-section {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 16rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  width: fit-content;
}

.phone-icon {
  font-size: 24rpx;
}

.phone-number {
  font-size: 26rpx;
  color: #666666;
}

.password-link {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 16rpx;
  padding: 12rpx 0;
  width: fit-content;
}

.password-link-icon {
  font-size: 24rpx;
}

.password-link-text {
  font-size: 26rpx;
  color: #667eea;
  font-weight: 500;
}

.login-prompt {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.prompt-text {
  font-size: 26rpx;
  color: #999999;
}

.login-btn {
  width: 180rpx;
  height: 64rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border-radius: 32rpx;
  font-size: 28rpx;
  font-weight: 500;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(102, 126, 234, 0.3);
}

.login-btn::after {
  border: none;
}

.phone-auth-prompt .login-btn {
  width: 100%;
  max-width: 100%;
}

.admin-login-hint {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #667eea;
  text-align: center;
  text-decoration: underline;
}

/* 快捷功能区域 */
.quick-actions {
  display: flex;
  justify-content: space-around;
  margin: 0 30rpx 30rpx;
  padding: 30rpx;
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  flex: 1;
}

.action-icon-wrapper {
  width: 100rpx;
  height: 100rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.action-icon-wrapper.order {
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
}

.action-icon-wrapper.resource {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
}

.action-icon-wrapper.settings {
  background: linear-gradient(135deg, #d299c2 0%, #fef9d7 100%);
}

.action-icon-wrapper.company-switch {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.action-icon-emoji {
  font-size: 48rpx;
}

.action-icon {
  width: 56rpx;
  height: 56rpx;
}

.action-label {
  font-size: 26rpx;
  color: #333333;
  font-weight: 500;
}

/* 管理功能区域 */
.admin-section {
  margin: 0 30rpx 30rpx;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.section-header {
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #1a1a1a;
  position: relative;
  padding-left: 16rpx;
}

.section-title::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6rpx;
  height: 24rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 3rpx;
}

.admin-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.admin-item {
  padding: 30rpx;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-radius: 16rpx;
  border: 2rpx solid #f0f0f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  transition: all 0.3s;
}

.admin-item:active {
  transform: scale(0.98);
  background: linear-gradient(135deg, #f0f0f0 0%, #f8f9fa 100%);
}

.admin-icon-wrapper {
  width: 100rpx;
  height: 100rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8rpx;
}

.admin-icon-wrapper.company {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.admin-icon-wrapper.user {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.admin-icon-wrapper.product {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.admin-icon-wrapper.category {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.admin-icon-wrapper.order {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.admin-icon-wrapper.company {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.admin-icon-wrapper.settings {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.admin-icon-wrapper.package {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.admin-icon-wrapper.user {
  background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
}

.admin-icon {
  font-size: 48rpx;
}

.admin-label {
  font-size: 28rpx;
  font-weight: bold;
  color: #1a1a1a;
}

.admin-desc {
  font-size: 22rpx;
  color: #999999;
}

/* 注册提示 */
.more-section {
  margin: 0 30rpx 30rpx;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.more-section .section-header {
  margin-bottom: 20rpx;
}

.more-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
}

.more-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 28rpx;
  background: #f8f9fa;
  border-radius: 16rpx;
}

.more-icon {
  font-size: 36rpx;
}

.more-label {
  font-size: 28rpx;
  color: #333;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.48);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx 40rpx;
  box-sizing: border-box;
}

.modal-content {
  width: 100%;
  max-width: 620rpx;
  background: #fff;
  border-radius: 28rpx;
  overflow: hidden;
  box-shadow: 0 24rpx 64rpx rgba(15, 23, 42, 0.18);
}

.about-modal {
  display: flex;
  flex-direction: column;
  max-height: 82vh;
}

.about-modal-accent {
  height: 8rpx;
  width: 100%;
  background: linear-gradient(90deg, #4ecdc4 0%, #44a08d 100%);
}

.about-modal-header {
  padding: 28rpx 32rpx 24rpx;
  border-bottom: 1rpx solid #f1f5f9;
  flex-shrink: 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.5rpx;
}

.modal-close-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close {
  font-size: 40rpx;
  color: #64748b;
  line-height: 1;
  padding: 0;
}

.about-modal-body {
  padding: 28rpx 32rpx 36rpx;
  box-sizing: border-box;
  max-height: 68vh;
}

.about-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 28rpx;
  padding-bottom: 28rpx;
  border-bottom: 1rpx solid #f1f5f9;
}

.about-logo {
  width: 120rpx;
  height: 120rpx;
  border-radius: 24rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
}

.about-logo-placeholder {
  width: 120rpx;
  height: 120rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #e0f2fe 0%, #ccfbf1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #e2e8f0;
}

.about-logo-letter {
  font-size: 48rpx;
  font-weight: 700;
  color: #0d9488;
}

.about-co-name {
  margin-top: 20rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #1e293b;
  text-align: center;
  line-height: 1.4;
  padding: 0 16rpx;
}

.about-text-card {
  background: #f8fafc;
  border-radius: 20rpx;
  padding: 28rpx 26rpx;
  border: 1rpx solid #e2e8f0;
}

.about-desc {
  display: block;
  font-size: 28rpx;
  color: #334155;
  line-height: 1.85;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}

.empty-tip {
  font-size: 28rpx;
  color: #94a3b8;
  text-align: center;
  padding: 48rpx 24rpx;
}

.register-tip--top {
  margin-top: 8rpx;
}

.register-tip {
  margin: 0 30rpx 30rpx;
  padding: 24rpx;
  background: linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%);
  border-radius: 16rpx;
  border-left: 6rpx solid #ffc107;
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
}

.tip-icon {
  font-size: 40rpx;
  flex-shrink: 0;
}

.tip-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.tip-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #856404;
}

.tip-text {
  font-size: 26rpx;
  color: #856404;
  line-height: 1.6;
}

/* 退出登录 */
.logout-section {
  margin: 0 30rpx;
  padding: 20rpx 0;
}

.logout-btn {
  width: 100%;
  height: 88rpx;
  background: #ffffff;
  color: #ff6b6b;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
  border: 2rpx solid #ffebee;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logout-btn::after {
  border: none;
}

.logout-btn:active {
  background: #fff5f5;
}
</style>
