<template>
  <view class="package-page">
    <PageNavBar :title="companyInfo?.name || '套餐'" />

    <!-- 固定在导航下方的搜索 + 分类（仅下方列表区域滚动） -->
    <view class="package-header-fixed">
      <view class="search-bar">
        <view class="search-input-box">
          <image class="search-icon" src="/static/index/srch.png" mode="aspectFit" />
          <input
            :adjust-position="false"
            class="search-input"
            v-model="searchKeyword"
            placeholder="请输入套餐名称"
            confirm-type="search"
            @confirm="onSearchConfirm"
          />
          <text v-if="searchKeyword" class="clear-icon" @click="searchKeyword = ''">×</text>
        </view>
      </view>

      <view class="category-filter">
        <scroll-view scroll-x class="category-scroll" :show-scrollbar="false">
          <view class="category-list">
            <view
              class="category-item"
              :class="{ active: selectedCategoryId === null }"
              @click="selectCategory(null)"
            >
              <text>全部</text>
            </view>
            <view
              v-for="category in categories"
              :key="category.id"
              class="category-item"
              :class="{ active: selectedCategoryId === category.id }"
              @click="selectCategory(category.id)"
            >
              <text>{{ category.name }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 列表区：flex 占满导航+筛选栏下方剩余高度，避免固定 px 与 tabBar 区域错位产生底部灰条/遮挡 -->
    <view class="package-list-region">
      <view v-if="loading && packages.length === 0" class="skeleton-area">
        <SkeletonScreen type="list-grid-3" :count="6" />
      </view>

      <scroll-view
        v-else
        scroll-y
        class="package-list-scroll"
        :lower-threshold="100"
      :enable-back-to-top="true"
      refresher-enabled
      :refresher-triggered="refresherTriggered"
      refresher-default-style="black"
      @scrolltolower="onScrollToLower"
      @refresherrefresh="onRefresherRefresh"
    >
      <view class="package-list">
        <view
          v-for="pkg in packages"
          :key="pkg.id"
          class="package-item"
          @click="goToPackageDetail(pkg.id)"
        >
          <view class="package-image-wrap">
            <image
              class="package-image"
              :src="pkg.cover_image_url || '/static/default.png'"
              mode="aspectFill"
            />
            <ProductImageBadges :tags="pkg.tags" :out-of-stock="false" />
          </view>
          <view class="package-info">
            <view class="package-name">{{ pkg.name }}</view>
          </view>
        </view>

        <view v-if="packages.length === 0" class="empty-state full-row">
          <text class="empty-text">暂无套餐</text>
        </view>

        <!-- 列表底部状态 -->
        <view v-if="packages.length > 0" class="list-footer full-row">
          <view v-if="loading" class="footer-state footer-loading">
            <view class="footer-dots" aria-hidden="true">
              <view class="footer-dot" />
              <view class="footer-dot" />
              <view class="footer-dot" />
            </view>
            <text class="footer-text">正在加载</text>
          </view>
          <view
            v-else-if="hasMore"
            class="footer-state footer-hint"
            @click="loadMore"
          >
            <text class="footer-text">上拉或点击继续加载</text>
          </view>
          <view v-else-if="!hasMore" class="footer-state footer-done">
            <view class="footer-rule" />
            <text class="footer-muted">已显示全部套餐</text>
            <view class="footer-rule" />
          </view>
        </view>
      </view>
    </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { whenAppReady } from '@/utils/appReady';
import { onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { getPackageList } from '@/api/package/index';
import { getCategoryTree } from '@/api/category/index';
import { companyInfo } from '@/store/userStore';
import PageNavBar from '@/components/PageNavBar.vue';
import SkeletonScreen from '@/components/SkeletonScreen.vue';
import ProductImageBadges from '@/components/ProductImageBadges.vue';

const packages = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 12;
const hasMore = ref(true);
const categories = ref<any[]>([]);
const selectedCategoryId = ref<number | null>(null);
const loadingCategories = ref(false);
const searchKeyword = ref('');

const refresherTriggered = ref(false);

/** 与同公司上一次完成列表挂载一致时，onShow 不再全量重置列表，避免从详情返回滚动条回到顶部 */
const lastHydratedCompanyIdForList = ref<number | null>(null);

/** 确认后进入全域套餐搜索页，不带当前分类条件（与横向分类筛选无关） */
const onSearchConfirm = () => {
  const kw = (searchKeyword.value || '').trim();
  let url = `/pages/search/index?type=package`;
  if (kw) url += `&keyword=${encodeURIComponent(kw)}`;
  uni.navigateTo({ url });
};

const PACKAGE_PAGE_CACHE_TTL = 5 * 60 * 1000;
const packagePageCache = ref<{
  companyId: number;
  categoryId: number | null;
  categories: any[];
  packages: any[];
  timestamp: number;
} | null>(null);

const loadCategories = async (useCache = true) => {
  const companyId = companyInfo.value?.id;
  if (!companyId) return;

  const cache = packagePageCache.value;
  if (
    useCache &&
    cache &&
    cache.companyId === companyId &&
    Date.now() - cache.timestamp < PACKAGE_PAGE_CACHE_TTL &&
    cache.categories.length > 0
  ) {
    categories.value = cache.categories;
    return;
  }

  loadingCategories.value = true;
  try {
    const result = await getCategoryTree(companyId, 'package');
    if (result.code === 0 && result.data) {
      categories.value = result.data;
    }
  } catch (error: any) {
    console.error('加载分类失败:', error);
  } finally {
    loadingCategories.value = false;
  }
};

const selectCategory = (categoryId: number | null) => {
  selectedCategoryId.value = categoryId;
  loadPackages(true, false);
};

const loadPackages = async (reset = false, useCache = true) => {
  const companyId = companyInfo.value?.id;
  if (!companyId) {
    uni.showToast({ title: '公司信息不存在', icon: 'none' });
    return;
  }

  if (reset) {
    page.value = 1;
    hasMore.value = true;
  }

  const cid = selectedCategoryId.value ?? null;
  const cache = packagePageCache.value;
  const cacheValid =
    useCache &&
    reset &&
    cache &&
    cache.companyId === companyId &&
    cache.categoryId === cid &&
    Date.now() - cache.timestamp < PACKAGE_PAGE_CACHE_TTL;

  if (cacheValid && cache) {
    packages.value = cache.packages;
    hasMore.value = cache.packages.length >= pageSize;
    if (cache.packages.length >= pageSize) page.value = 2;
    return;
  }

  if (loading.value || (!hasMore.value && !reset)) return;

  loading.value = true;
  try {
    const result = await getPackageList({
      companyId,
      categoryId: cid ?? undefined,
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
    });

    if (reset) packages.value = [];

    if (result.packages && result.packages.length > 0) {
      packages.value = [...packages.value, ...result.packages];
      hasMore.value = result.packages.length >= pageSize;
      if (result.packages.length >= pageSize) page.value++;
      else hasMore.value = false;
    } else {
      hasMore.value = false;
    }

    if (reset) {
      packagePageCache.value = {
        companyId,
        categoryId: cid,
        categories: categories.value,
        packages: packages.value,
        timestamp: Date.now(),
      };
    }
  } catch (error: any) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const loadMore = () => {
  if (!loading.value && hasMore.value) {
    void loadPackages();
  }
};

function onScrollToLower() {
  loadMore();
}

async function onRefresherRefresh() {
  refresherTriggered.value = true;
  try {
    await loadCategories(false);
    await loadPackages(true, false);
  } finally {
    refresherTriggered.value = false;
  }
}

const goToPackageDetail = (packageId: number) => {
  uni.navigateTo({
    url: `/pages/package-detail/index?id=${packageId}`,
  });
};

onShow(async () => {
  await whenAppReady();
  const cid = companyInfo.value?.id;
  if (!cid) return;

  // tabBar 页实例常驻：从详情 navigateBack 会再次触发 onShow，若不区分则每次都 loadPackages(true) 会顶替列表并让 scroll-view 回到顶部。
  if (lastHydratedCompanyIdForList.value === cid) {
    return;
  }
  lastHydratedCompanyIdForList.value = cid;

  await loadCategories(true);
  await loadPackages(true, true);
});

onShareAppMessage(() => {
  const cid = companyInfo.value?.id ?? uni.getStorageSync('companyId') ?? '';
  const path = cid ? `/pages/package/index?companyId=${cid}` : '/pages/package/index';
  return {
    title: companyInfo.value?.name ? `${companyInfo.value.name} - 套餐` : '套餐',
    path,
  };
});

onShareTimeline(() => {
  const cid = companyInfo.value?.id ?? uni.getStorageSync('companyId') ?? '';
  const query = cid ? `companyId=${cid}` : '';
  return {
    title: companyInfo.value?.name ? `${companyInfo.value.name} - 套餐` : '套餐',
    query,
  };
});
</script>

<style scoped>
.package-page {
  height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.package-header-fixed {
  flex-shrink: 0;
  background: #f5f5f5;
}

.package-list-region {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.search-bar {
  padding: 20rpx 30rpx;
  background: #fff;
  border-bottom: 1rpx solid #e8e8e8;
}

.search-input-box {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 50rpx;
  padding: 16rpx 24rpx;
  gap: 16rpx;
}

.search-input-box .search-icon {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
}

.search-input-box .search-input {
  flex: 1;
  font-size: 28rpx;
}

.search-input-box .clear-icon {
  font-size: 36rpx;
  color: #999;
  padding: 8rpx;
}

.skeleton-area {
  flex: 1;
  min-height: 0;
  height: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 24rpx;
  overflow: hidden;
}

/* flex:1 + height:0：与购物车列表一致，scroll-view 在 tabBar 页获得稳定剩余高度，避免底部错位灰条 */
.package-list-scroll {
  flex: 1;
  min-height: 0;
  height: 0;
  width: 100%;
  box-sizing: border-box;
  background: #f5f5f5;
}

.package-list {
  padding: 24rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom, 0px));
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24rpx;
}

.package-list .full-row {
  grid-column: 1 / -1;
}

.package-item {
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.package-image-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: #f5f5f5;
  overflow: hidden;
}

.package-image {
  width: 100%;
  height: 100%;
  display: block;
}

.package-info {
  padding: 16rpx 12rpx;
}

.package-name {
  font-size: 26rpx;
  font-weight: 500;
  color: #333;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty-state {
  padding: 120rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: #999999;
}

/* 列表底部：加载 / 提示 / 结束 */
.list-footer {
  min-height: 100rpx;
}

.footer-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36rpx 24rpx 8rpx;
  gap: 16rpx;
}

.footer-loading .footer-text {
  font-size: 24rpx;
  color: #9ca3af;
 letter-spacing: 0.02em;
}

.footer-dots {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.footer-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #0d9488;
  opacity: 0.35;
  animation: pkg-dot-pulse 1s ease-in-out infinite;
}

.footer-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.footer-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes pkg-dot-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

.footer-hint {
  padding: 28rpx 24rpx;
}

.footer-hint .footer-text {
  font-size: 24rpx;
  color: #6b7280;
}

.footer-done {
  flex-direction: row;
  gap: 20rpx;
  padding: 32rpx 16rpx 16rpx;
}

.footer-rule {
  flex: 1;
  height: 1rpx;
  background: linear-gradient(90deg, transparent, #e5e7eb 20%, #e5e7eb 80%, transparent);
  max-width: 120rpx;
}

.footer-muted {
  font-size: 22rpx;
  color: #c4c4c4;
  flex-shrink: 0;
}

.category-filter {
  background: #ffffff;
  border-bottom: 1rpx solid #e8e8e8;
}

.category-scroll {
  white-space: nowrap;
  width: 100%;
}

.category-list {
  display: flex;
  padding: 20rpx 30rpx;
  gap: 20rpx;
}

.category-item {
  padding: 12rpx 24rpx;
  background: #f5f5f5;
  border-radius: 30rpx;
  font-size: 26rpx;
  color: #666666;
  white-space: nowrap;
  flex-shrink: 0;
}

.category-item.active {
  background: #22c55e;
  color: #ffffff;
}
</style>
