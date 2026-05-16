<template>
  <view class="category-filter-page">
    <!-- 导航栏：展示分类时为 [分类名称]-分类，展示商品时为 [分类名称]-商品，不显示公司名 -->
    <PageNavBar :title="navTitle" :show-back="true" @back="goBack" />

    <!-- 搜索：确认后跳转全域商品搜索（不带当前分类条件） -->
    <view class="search-bar">
      <view class="search-input-box">
        <text class="search-icon">🔍</text>
        <input :adjust-position="false"
          class="search-input"
          v-model="searchKeyword"
          placeholder="请输入商品名称"
          confirm-type="search"
          @confirm="onSearchConfirm"
        />
        <text v-if="searchKeyword" class="clear-icon" @click="clearSearchKeyword">×</text>
      </view>
    </view>

    <view class="content-container">
      <!-- route_ui_style=categories 且有子分类时：三列分类网格；否则展示商品 -->
      <scroll-view
        v-if="showSubCategories"
        scroll-y
        class="main-content category-grid-wrap"
        refresher-enabled
        :refresher-triggered="isRefreshing"
        @refresherrefresh="onRefresh"
      >
        <view class="category-grid">
          <view
            v-for="item in subCategories"
            :key="item.id"
            class="category-card"
            @click="onCategoryTap(item)"
          >
            <view class="category-card-image-wrap">
              <image
                class="category-card-image"
                :src="item.icon_url || item.icon || item.image || '/static/default.png'"
                mode="aspectFill"
              />
            </view>
            <text class="category-card-name">{{ item.name }}</text>
          </view>
        </view>
        <view v-if="subCategories.length === 0 && !loading" class="empty-state">
          <text class="empty-text">暂无分类</text>
        </view>
        <view class="footer-placeholder"></view>
      </scroll-view>

      <!-- 无子分类时：当前分类下的商品列表 -->
      <scroll-view
        v-else
        scroll-y
        class="main-content"
        @scrolltolower="loadMore"
        refresher-enabled
        :refresher-triggered="isRefreshing"
        @refresherrefresh="onRefresh"
      >
        <view class="category-header">
          <text class="category-title">{{ currentCategory ? currentCategory.name : pageTitle }}</text>
        </view>

        <view class="product-grid" v-if="products.length > 0">
          <view
            v-for="product in products"
            :key="product.id"
            class="product-card"
            @click="goDetail(product)"
          >
            <view class="product-card-image-wrap">
              <image
                class="product-card-image"
                :src="product.cover_image_url"
                mode="aspectFill"
                lazy-load
              />
              <ProductImageBadges :tags="product.tags" :out-of-stock="isProductOutOfStock(product)" />
            </view>
            <view class="product-card-info">
              <view class="product-card-name">{{ product.name }}</view>
            </view>
          </view>
        </view>

        <view v-else-if="!loading" class="empty-state">
          <view class="empty-icon-wrap">
            <text class="empty-icon-emoji">📦</text>
          </view>
          <text class="empty-text">该分类暂无商品</text>
        </view>

        <view v-if="loading" class="loading-more">
          <view class="loading-spinner"></view>
          <text>加载中...</text>
        </view>
        <view v-else-if="products.length > 0 && !hasMore" class="no-more">
          <text>没有更多了</text>
        </view>
        <view class="footer-placeholder"></view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { whenAppReady } from '@/utils/appReady';
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { getCategoryChildren } from '@/api/category/index';
import { getProductList } from '@/api/product/index';
import { userInfo, companyInfo } from '@/store/userStore';
import PageNavBar from '@/components/PageNavBar.vue';
import ProductImageBadges from '@/components/ProductImageBadges.vue';
import { safeNavigateBack } from '@/utils/navigation';

/** 分享/扫码进入时 categoryName 可能为百分号编码或已解码；+ 在 query 中常表示空格 */
function decodeIncomingCategoryName(raw: unknown): string {
  if (raw == null) return '';
  let s = Array.isArray(raw) ? String(raw[0]) : String(raw);
  s = s.trim();
  if (!s) return '';
  try {
    const normalized = s.replace(/\+/g, '%20');
    if (/%[0-9A-Fa-f]{2}/.test(normalized)) {
      return decodeURIComponent(normalized);
    }
    return s;
  } catch {
    return s.replace(/\+/g, ' ');
  }
}

/** 小程序分享 path/query 勿用 URLSearchParams拼中文，部分环境会乱码；应用 encodeURIComponent */
function buildCategoryFilterShareQuery(): string {
  const cid = companyInfo.value?.id ?? uni.getStorageSync('companyId') ?? '';
  const parts: string[] = [];
  if (cid !== '' && cid != null) parts.push(`companyId=${encodeURIComponent(String(cid))}`);
  if (parentId.value != null) parts.push(`categoryId=${String(parentId.value)}`);
  if (pageTitle.value && pageTitle.value !== '分类筛选') {
    parts.push(`categoryName=${encodeURIComponent(pageTitle.value)}`);
  }
  return parts.join('&');
}

const parentId = ref<number | null>(null);
const pageTitle = ref('分类筛选');
const subCategories = ref<any[]>([]);
/** 当前分类的 route_ui_style：products=展示商品，categories=展示子分类（或本分类商品） */
const parentRouteUiStyle = ref<'products' | 'categories' | ''>('');
const currentCategoryId = ref<number | null>(null);
const products = ref<any[]>([]);
const loading = ref(false);
const isRefreshing = ref(false);
const hasMore = ref(true);
const page = ref(1);
const pageSize = 12;

const currentCategory = computed(() => {
  return subCategories.value.find(c => c.id === currentCategoryId.value);
});

/** 是否展示子分类网格：route_ui_style 为 categories 且有子分类时展示，否则展示商品 */
const showSubCategories = computed(() => {
  if (parentRouteUiStyle.value === 'products') return false;
  return subCategories.value.length > 0;
});

const searchKeyword = ref('');

/** 跳转全域商品搜索，不带当前分类（与列表页分类条件无关） */
const onSearchConfirm = () => {
  const kw = (searchKeyword.value || '').trim();
  let url = `/pages/search/index?type=product`;
  if (kw) url += `&keyword=${encodeURIComponent(kw)}`;
  uni.navigateTo({ url });
};

const clearSearchKeyword = () => {
  searchKeyword.value = '';
};

// 导航栏标题：展示分类时 [分类名称]-分类，展示商品时 [分类名称]-商品，不显示公司名
const navTitle = computed(() => {
  const name = pageTitle.value && pageTitle.value !== '分类筛选' ? pageTitle.value : '分类筛选';
  const suffix = showSubCategories.value ? '分类' : '商品';
  return `${name}-${suffix}`;
});

const isProductOutOfStock = (product: any) => {
  const total = product?.product_skus_aggregate?.aggregate?.sum?.stock ?? 0;
  return Number(total) <= 0;
};

// 加载子分类（按父级 ID 拉取）；按 route_ui_style 决定展示子分类或商品
const loadSubCategories = async () => {
  if (!parentId.value) return;

  try {
    const res = await getCategoryChildren(parentId.value, companyInfo.value?.id ?? undefined);
    if (res.code === 0) {
      subCategories.value = Array.isArray(res.data) ? res.data : [];
      const routeStyle = res.parentCategory?.route_ui_style;
      parentRouteUiStyle.value = routeStyle === 'products' ? 'products' : 'categories';
      // route_ui_style=products 时始终展示商品；否则有子分类则展示子分类，无则展示商品
      const showSubs = parentRouteUiStyle.value !== 'products' && subCategories.value.length > 0;
      if (showSubs) {
        // 子分类网格页不请求商品，避免误用第一个子分类 id
        currentCategoryId.value = null;
      } else {
        currentCategoryId.value = parentId.value;
        loadProducts(true);
      }
    }
  } catch (error) {
    console.error('加载子分类失败', error);
  } finally {
    isRefreshing.value = false;
  }
};

// 加载商品（仅当前分类直接挂载的商品，不包含子分类下的商品）
const loadProducts = async (refresh = false) => {
  if (loading.value) return;
  if (!currentCategoryId.value) return;

  loading.value = true;
  if (refresh) {
    page.value = 1;
    hasMore.value = true;
    products.value = [];
  }

  try {
    const companyId = userInfo.value?.manager?.company?.id || companyInfo.value?.id;
    const res = await getProductList({
      companyId,
      categoryId: currentCategoryId.value,
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
    });

    if (refresh) {
      products.value = res.products;
    } else {
      products.value = [...products.value, ...res.products];
    }

    if (res.products.length < pageSize) {
      hasMore.value = false;
    } else {
      page.value++;
    }
  } catch (error) {
    console.error('加载商品失败:', error);
    uni.showToast({
      title: '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
    isRefreshing.value = false;
  }
};

// 点击分类卡片：进入该分类（继续看子分类或商品列表）
const onCategoryTap = (category: any) => {
  uni.navigateTo({
    url: `/pages/category-filter/index?categoryId=${category.id}&categoryName=${encodeURIComponent(category.name || '')}`,
  });
};

// 切换分类（无子分类时内部使用）
const switchCategory = (category: any) => {
  if (currentCategoryId.value === category.id) return;
  currentCategoryId.value = category.id;
  loadProducts(true);
};

const onRefresh = () => {
  isRefreshing.value = true;
  if (parentId.value) {
    loadSubCategories();
  } else {
    loadProducts(true);
  }
};

const loadMore = () => {
  if (hasMore.value && !loading.value) {
    loadProducts();
  }
};

const goDetail = (product: any) => {
  uni.navigateTo({
    url: `/pages/product-detail/index?id=${product.id}`,
  });
};

const goBack = () => {
  safeNavigateBack();
};

onLoad(async (options?) => {
  await whenAppReady();
  if (options?.categoryId) {
    parentId.value = Number(options.categoryId);
  }
  const name = decodeIncomingCategoryName(options?.categoryName);
  if (name) {
    pageTitle.value = name;
  }

  loadSubCategories();
});

function getSharePath() {
  const q = buildCategoryFilterShareQuery();
  return q ? `/pages/category-filter/index?${q}` : '/pages/category-filter/index';
}

function getShareQuery() {
  return buildCategoryFilterShareQuery();
}

onShareAppMessage(() => {
  return {
    title: navTitle.value || (companyInfo.value?.name ? `${companyInfo.value.name} - 分类` : '分类'),
    path: getSharePath(),
  };
});

onShareTimeline(() => {
  return {
    title: navTitle.value || (companyInfo.value?.name ? `${companyInfo.value.name} - 分类` : '分类'),
    query: getShareQuery(),
  };
});
</script>

<style scoped>
.category-filter-page {
  height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.content-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #f5f5f5;
}

.search-bar {
  padding: 20rpx 30rpx;
  background: #fff;
  border-bottom: 1rpx solid #e0e0e0;
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
  font-size: 32rpx;
  color: #999;
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

.main-content {
  height: 100%;
  min-height: 0;
  background: #f5f5f5;
  padding: 16rpx;
  box-sizing: border-box;
}

.category-grid-wrap {
  padding: 16rpx;
}

/* 双列分类网格（图片绿框 + 名称） */
.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
}

.category-card {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.category-card-image-wrap {
  width: 100%;
  aspect-ratio: 1;
  padding: 8rpx;
  box-sizing: border-box;
  border: 4rpx solid #22c55e;
  border-radius: 12rpx 12rpx 0 0;
  background: #fff;
}

.category-card-image {
  width: 100%;
  height: 100%;
  border-radius: 8rpx;
  display: block;
  background: #f0f0f0;
}

.category-card-name {
  display: block;
  padding: 20rpx 16rpx;
  font-size: 26rpx;
  color: #333;
  text-align: center;
  line-height: 1.4;
  min-height: 72rpx;
}

/* 无子分类时的右侧内容 */
.main-content .category-header {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.category-header {
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
}

.category-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  padding-left: 16rpx;
  border-left: 6rpx solid #667eea;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
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
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty-state {
  padding: 100rpx 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-icon-wrap {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 24rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon-emoji {
  font-size: 72rpx;
  line-height: 1;
}

.empty-text {
  color: #999;
  font-size: 26rpx;
}

.loading-more,
.no-more {
  padding: 30rpx 0;
  text-align: center;
  color: #999;
  font-size: 24rpx;
}

.loading-spinner {
  display: inline-block;
  width: 30rpx;
  height: 30rpx;
  border: 3rpx solid #e0e0e0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 10rpx;
  vertical-align: middle;
}

.footer-placeholder {
  height: 40rpx;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
