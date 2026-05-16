<template>
  <view class="search-page">
    <PageNavBar :title="pageTitle" :show-back="true" @back="goBack" />

    <!-- 固定在导航下方：搜索 + 分类说明（仅下方列表滚动） -->
    <view class="search-header-fixed">
      <view class="search-bar">
        <view class="search-input-box">
          <image class="search-icon-img" src="/static/index/srch.png" mode="aspectFit" />
          <input
            :adjust-position="false"
            class="search-input"
            v-model="keyword"
            :placeholder="searchPlaceholder"
            :focus="inputFocused"
            confirm-type="search"
            @confirm="onSearch"
            @input="onInput"
          />
          <text v-if="keyword" class="clear-icon" @click="clearSearch">×</text>
        </view>
      </view>

      <view v-if="categoryName" class="category-desc-bar">
        <view class="category-desc-line"></view>
        <text class="category-desc-text">{{ categoryName }}</text>
      </view>
    </view>

    <!-- flex:1 占满导航+搜索栏下方剩余高度，避免 JS 按 windowHeight 测高在模拟器与真机不一致产生底部空白 -->
    <view class="search-list-region">
      <view
        v-if="loading && (searchType === 'product' ? products.length === 0 : packages.length === 0)"
        class="skeleton-area"
      >
        <!-- 商品/套餐列表均为 3 列宫格 + 上图下文，与 .product-grid / .package-list 一致 -->
        <SkeletonScreen type="list-grid-3" :count="6" custom-class="search-skel" />
      </view>

      <scroll-view
        v-else
        scroll-y
        class="list-scroll"
        :lower-threshold="100"
      :enable-back-to-top="true"
      refresher-enabled
      :refresher-triggered="refresherTriggered"
      refresher-default-style="black"
      @scrolltolower="onScrollToLower"
      @refresherrefresh="onRefresherRefresh"
    >
      <!-- 商品 -->
      <view v-if="searchType === 'product'" class="list-inner">
        <view class="product-grid" v-if="products.length > 0">
          <view
            v-for="product in products"
            :key="product.id"
            class="product-card"
            @click="goProductDetail(product)"
          >
            <view class="product-card-image-wrap">
              <image class="product-card-image" :src="product.cover_image_url" mode="aspectFill" lazy-load />
              <ProductImageBadges :tags="product.tags" :out-of-stock="isProductOutOfStock(product)" />
            </view>
            <view class="product-card-info">
              <view class="product-card-name">{{ product.name }}</view>
            </view>
          </view>
        </view>
        <view v-else class="empty-state">
          <text class="empty-text">暂无商品</text>
        </view>
        <view v-if="products.length > 0" class="list-footer">
          <view v-if="loading" class="footer-state footer-loading">
            <view class="footer-dots" aria-hidden="true">
              <view class="footer-dot" />
              <view class="footer-dot" />
              <view class="footer-dot" />
            </view>
            <text class="footer-text-muted">正在加载</text>
          </view>
          <view v-else-if="!hasMore" class="footer-state footer-done">
            <view class="footer-rule" />
            <text class="footer-muted">已显示全部</text>
            <view class="footer-rule" />
          </view>
          <view v-else class="footer-state footer-hint">
            <text class="footer-text-muted">上拉加载更多</text>
          </view>
        </view>
      </view>

      <!-- 套餐 -->
      <view v-else class="list-inner">
        <view class="package-list" v-if="packages.length > 0">
          <view
            v-for="pkg in packages"
            :key="pkg.id"
            class="package-item"
            @click="goPackageDetail(pkg.id)"
          >
            <view class="package-image-wrap">
              <image
                class="package-image"
                :src="pkg.cover_image_url || '/static/default.png'"
                mode="aspectFill"
                lazy-load
              />
              <ProductImageBadges :tags="pkg.tags" :out-of-stock="false" />
            </view>
            <view class="package-info">
              <view class="package-name">{{ pkg.name }}</view>
            </view>
          </view>
        </view>
        <view v-else class="empty-state">
          <text class="empty-text">暂无套餐</text>
        </view>
        <view v-if="packages.length > 0" class="list-footer">
          <view v-if="loading" class="footer-state footer-loading">
            <view class="footer-dots" aria-hidden="true">
              <view class="footer-dot" />
              <view class="footer-dot" />
              <view class="footer-dot" />
            </view>
            <text class="footer-text-muted">正在加载</text>
          </view>
          <view v-else-if="!hasMore" class="footer-state footer-done">
            <view class="footer-rule" />
            <text class="footer-muted">已显示全部</text>
            <view class="footer-rule" />
          </view>
          <view v-else class="footer-state footer-hint">
            <text class="footer-text-muted">上拉加载更多</text>
          </view>
        </view>
      </view>
    </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { whenAppReady } from '@/utils/appReady';
import { onLoad, onReady, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { getProductList } from '@/api/product/index';
import { getPackageList } from '@/api/package/index';
import { userInfo, companyInfo } from '@/store/userStore';
import { safeNavigateBack } from '@/utils/navigation';
import PageNavBar from '@/components/PageNavBar.vue';
import SkeletonScreen from '@/components/SkeletonScreen.vue';
import ProductImageBadges from '@/components/ProductImageBadges.vue';

const searchType = ref<'product' | 'package'>('product');
const keyword = ref('');
const inputFocused = ref(false);
const categoryId = ref<number | null>(null);
const categoryName = ref('');
const products = ref<any[]>([]);
const packages = ref<any[]>([]);
const loading = ref(false);
const hasMore = ref(true);
const page = ref(1);
const pageSize = 12;

const refresherTriggered = ref(false);

const pageTitle = computed(() => {
  if (searchType.value === 'package') return '搜索套餐';
  if (categoryName.value) return `搜索商品-${categoryName.value}`;
  return '搜索商品';
});
const searchPlaceholder = computed(() =>
  searchType.value === 'product' ? '请输入商品名称' : '请输入套餐名称'
);

const isProductOutOfStock = (product: any) => {
  const total = product?.product_skus_aggregate?.aggregate?.sum?.stock ?? 0;
  return Number(total) <= 0;
};

const loadData = async (refresh = false) => {
  if (loading.value) return;
  if (refresh) {
    page.value = 1;
    hasMore.value = true;
  }

  const companyId = userInfo.value?.manager?.company?.id || companyInfo.value?.id;
  if (!companyId) {
    loading.value = false;
    return;
  }

  loading.value = true;

  try {
    if (searchType.value === 'product') {
      const res = await getProductList({
        companyId,
        categoryId: categoryId.value || undefined,
        keyword: keyword.value.trim() || undefined,
        limit: pageSize,
        offset: (page.value - 1) * pageSize,
      });
      if (refresh) products.value = res.products;
      else products.value = [...products.value, ...res.products];
      hasMore.value = res.products.length >= pageSize;
    } else {
      const res = await getPackageList({
        companyId,
        keyword: keyword.value.trim() || undefined,
        limit: pageSize,
        offset: (page.value - 1) * pageSize,
      });
      if (refresh) packages.value = res.packages;
      else packages.value = [...packages.value, ...res.packages];
      hasMore.value = (res.packages?.length || 0) >= pageSize;
    }
    page.value++;
  } catch (error) {
    console.error('搜索失败', error);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const onSearch = () => {
  loadData(true);
};

let inputTimer: ReturnType<typeof setTimeout> | null = null;
const onInput = () => {
  if (inputTimer) clearTimeout(inputTimer);
  inputTimer = setTimeout(() => {
    loadData(true);
  }, 400);
};

const clearSearch = () => {
  keyword.value = '';
  loadData(true);
};

const loadMore = () => {
  if (hasMore.value && !loading.value) void loadData();
};

function onScrollToLower() {
  loadMore();
}

async function onRefresherRefresh() {
  refresherTriggered.value = true;
  try {
    await loadData(true);
  } finally {
    refresherTriggered.value = false;
  }
}

const goProductDetail = (product: any) => {
  uni.navigateTo({ url: `/pages/product-detail/index?id=${product.id}` });
};

const goPackageDetail = (id: number) => {
  uni.navigateTo({ url: `/pages/package-detail/index?id=${id}` });
};

const goBack = () => {
  safeNavigateBack();
};

onLoad(async (options?) => {
  await whenAppReady();
  if (options?.type === 'package' || options?.type === 'product') {
    searchType.value = options.type;
  }
  if (options?.keyword) {
    keyword.value = decodeURIComponent(options.keyword);
  }
  if (options?.categoryId) {
    categoryId.value = Number(options.categoryId);
  }
  if (options?.categoryName) {
    categoryName.value = decodeURIComponent(options.categoryName);
  }
  loadData(true);
});

onReady(() => {
  inputFocused.value = true;
});

function getSharePath() {
  const cid = companyInfo.value?.id ?? uni.getStorageSync('companyId') ?? '';
  const parts = ['/pages/search/index'];
  const params = new URLSearchParams();
  if (cid) params.set('companyId', String(cid));
  if (searchType.value) params.set('type', searchType.value);
  if (keyword.value) params.set('keyword', keyword.value);
  if (categoryId.value != null) params.set('categoryId', String(categoryId.value));
  if (categoryName.value) params.set('categoryName', categoryName.value);
  const q = params.toString();
  return q ? `${parts[0]}?${q}` : parts[0];
}

function getShareQuery() {
  const cid = companyInfo.value?.id ?? uni.getStorageSync('companyId') ?? '';
  const params = new URLSearchParams();
  if (cid) params.set('companyId', String(cid));
  if (searchType.value) params.set('type', searchType.value);
  if (keyword.value) params.set('keyword', keyword.value);
  if (categoryId.value != null) params.set('categoryId', String(categoryId.value));
  if (categoryName.value) params.set('categoryName', categoryName.value);
  return params.toString();
}

onShareAppMessage(() => {
  return {
    title: pageTitle.value || (companyInfo.value?.name ? `${companyInfo.value.name} - 搜索` : '搜索'),
    path: getSharePath(),
  };
});

onShareTimeline(() => {
  return {
    title: pageTitle.value || (companyInfo.value?.name ? `${companyInfo.value.name} - 搜索` : '搜索'),
    query: getShareQuery(),
  };
});
</script>

<style scoped>
.search-page {
  height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.search-header-fixed {
  flex-shrink: 0;
  background: #f5f5f5;
}

.search-list-region {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.search-bar {
  background: #fff;
  padding: 20rpx 30rpx;
  border-bottom: 1rpx solid #eee;
}

.search-input-box {
  background: #f5f5f5;
  border-radius: 40rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
}

.search-icon-img {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
  margin-right: 10rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
}

.clear-icon {
  font-size: 32rpx;
  color: #999;
  padding: 10rpx;
}

.category-desc-bar {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 20rpx 30rpx;
  border-bottom: 1rpx solid #eee;
  gap: 16rpx;
}

.category-desc-line {
  width: 6rpx;
  height: 32rpx;
  background: #007aff;
  border-radius: 3rpx;
  flex-shrink: 0;
}

.category-desc-text {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.skeleton-area {
  flex: 1;
  height: 0;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 16rpx;
  overflow: hidden;
}

/* 与 .product-grid / .package-list：3 列、gap 12rpx；去掉组件默认 24rpx 内边距避免与列表错位 */
.skeleton-area :deep(.skeleton-wrap.search-skel) {
  padding: 0;
}

.skeleton-area :deep(.skeleton-wrap.search-skel.list-grid-3) {
  gap: 12rpx;
}

.list-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  background: #f5f5f5;
}

.list-inner {
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom, 0px));
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  padding: 16rpx;
}

.product-card {
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.product-card-image-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: #f5f5f5;
  border-radius: 20rpx 20rpx 0 0;
  overflow: hidden;
}

.product-card-image {
  width: 100%;
  height: 100%;
  display: block;
}

.product-card-info {
  padding: 20rpx 16rpx;
}

.product-card-name {
  font-size: 26rpx;
  font-weight: 600;
  color: #333;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.package-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  padding: 16rpx;
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
  padding: 100rpx 0;
  text-align: center;
}

.empty-text {
  color: #999;
  font-size: 28rpx;
}

.list-footer {
  min-height: 88rpx;
}

.footer-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28rpx 24rpx 16rpx;
  gap: 14rpx;
}

.footer-loading .footer-text-muted {
  font-size: 24rpx;
  color: #9ca3af;
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
  animation: search-dot-pulse 1s ease-in-out infinite;
}

.footer-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.footer-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes search-dot-pulse {
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

.footer-hint .footer-text-muted {
  font-size: 24rpx;
  color: #9ca3af;
}

.footer-done {
  flex-direction: row;
  gap: 20rpx;
  padding: 32rpx 16rpx 8rpx;
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
</style>
