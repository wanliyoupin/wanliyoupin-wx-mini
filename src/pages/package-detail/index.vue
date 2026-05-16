<template>
  <view class="package-detail-page">
    <!-- 统一导航栏（含状态栏高度） -->
    <PageNavBar :title="navTitle" :show-back="true" @back="goBack" />

    <view class="package-detail-body">
      <!-- 加载状态 -->
      <view v-if="loading" class="loading-container">
        <view class="loading-spinner"></view>
        <text>加载中...</text>
      </view>

      <view v-else-if="missingPackageId" class="load-fail-container">
        <text class="load-fail-text">无法识别套餐链接，请重新扫码或从首页进入</text>
        <button class="load-fail-btn" @click="goHome">去首页</button>
      </view>

      <view v-else-if="packageLoadFailed" class="load-fail-container">
        <text class="load-fail-text">套餐不存在、已下架或暂无权限查看</text>
        <button class="load-fail-btn" @click="goHome">去首页</button>
      </view>

      <!-- 套餐详情：单一滚动容器，外层 flex 占位避免页面级与 scroll-view 双滚动 -->
      <scroll-view v-else-if="packageDetail" scroll-y class="scroll-content">
      <!-- 套餐封面：与商品详情一致，宽度铺满、高度随比例；点击预览大图 -->
      <view class="cover-section">
        <image
          v-if="packageDetail?.cover_image_url"
          class="cover-image"
          :src="packageDetail.cover_image_url"
          mode="widthFix"
          @click="previewCover"
        />
        <view v-else class="cover-placeholder">暂无封面</view>
      </view>

      <!-- 套餐信息 -->
      <view class="package-info-section">
        <view class="package-name">{{ packageDetail?.name || '' }}</view>
        <view v-if="packageDetail?.description" class="package-description package-description--pre-wrap">
          {{ packageDetail.description }}
        </view>
      </view>

      <!-- 套餐总价（入口即见） -->
      <view v-if="packageDetail?.package_product_skus?.length" class="package-total-bar">
        <text class="total-label">套餐总价：</text>
        <text v-if="canViewPrice" class="total-amount">¥{{ formatPrice(totalPackagePrice) }}</text>
        <text v-else class="total-amount total-amount-hidden">--</text>
      </view>

      <!-- 包含商品 -->
      <view class="products-section">
        <view class="section-title">包含商品</view>
        <view
          v-for="(item, index) in packageDetail?.package_product_skus || []"
          :key="item.id || index"
          class="product-item"
          @click="goToProductDetail(item.product_sku?.product?.id)"
        >
          <image
            class="product-image"
            :src="item.product_sku?.image_url || item.product_sku?.product?.cover_image_url || '/static/default.png'"
            mode="aspectFill"
          ></image>
          <view class="product-info">
            <view class="product-name">{{ item.product_sku?.product?.name || '商品' }}</view>
            <view class="product-spec">{{ item.product_sku?.name || '规格' }}</view>
            <view class="product-price-row">
              <text v-if="canViewPrice" class="product-price">¥{{ formatPrice((item.product_sku?.price || 0) * priceFactor) }}</text>
              <text v-else class="product-price product-price-hidden">--</text>
              <text class="product-quantity">×{{ item.quantity }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 底部占位 -->
      <view class="footer-placeholder"></view>
    </scroll-view>
    </view>

    <!-- 底部操作栏（与产品详情页一致：首页、购物车、加入购物车） -->
    <DetailFooterBar
      v-if="packageDetail && !missingPackageId && !packageLoadFailed"
      :cart-count="cartCount"
      @home="goHome"
      @cart="goCart"
    >
      <button class="package-detail-footer-btn" @click="handleAddToCart">加入购物车</button>
    </DetailFooterBar>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { getPackageDetail } from '@/api/package/index';
import { syncCompanyInfo } from '@/api/company/index';
import { addToCart, getCartList } from '@/api/cart/index';
import { userInfo, companyInfo, user_token } from '@/store/userStore';
import { getCompanyUserRoleCached } from '@/utils/auth';
import { safeNavigateBack } from '@/utils/navigation';
import { mergeMiniProgramEntryQuery, parsePositiveIntParam } from '@/utils/sceneParams';
import { shouldAllowAutoSwitchCompanyFromEntry } from '@/utils/entryCompanyPolicy';
import { whenAppReady } from '@/utils/appReady';
import PageNavBar from '@/components/PageNavBar.vue';
import DetailFooterBar from '@/components/DetailFooterBar.vue';
import SkeletonScreen from '@/components/SkeletonScreen.vue';

const packageId = ref<number | null>(null);
const packageDetail = ref<any>(null);
const loading = ref(false);
const missingPackageId = ref(false);
const packageLoadFailed = ref(false);
const priceFactor = ref(1); // 价格系数，默认为1
const canViewPrice = ref(false);
const canAddToCart = ref(false);
const cartCount = ref(0);

// 计算套餐总价（应用价格系数）
const navTitle = computed(() => {
  const name = companyInfo.value?.name;
  return name ? `${name} - 套餐详情` : '套餐详情';
});

const totalPackagePrice = computed(() => {
  if (!packageDetail.value?.package_product_skus) {
    return 0;
  }
  return packageDetail.value.package_product_skus.reduce((sum: number, item: any) => {
    const basePrice = item.product_sku?.price || 0;
    return sum + basePrice * priceFactor.value * item.quantity;
  }, 0);
});

// 加载价格系数
const loadPriceFactor = async (forceRefresh?: boolean) => {
  if (!userInfo.value?.id) {
    priceFactor.value = 1;
    canViewPrice.value = false;
    canAddToCart.value = false;
    return;
  }

  try {
    const roleInfo = await getCompanyUserRoleCached(companyInfo.value?.id, forceRefresh);
    if (roleInfo) {
      priceFactor.value = roleInfo.priceFactor || 1;
      canViewPrice.value = roleInfo.canViewPrice ?? false;
      canAddToCart.value = true;
    } else {
      priceFactor.value = 1;
      canViewPrice.value = false;
      canAddToCart.value = false;
    }
  } catch (error) {
    console.error('加载价格系数失败:', error);
    priceFactor.value = 1;
    canViewPrice.value = false;
    canAddToCart.value = false;
  }
};

// 加载套餐详情
const loadPackageDetail = async () => {
  if (!packageId.value) return;

  loading.value = true;
  packageLoadFailed.value = false;

  try {
    // 先加载价格系数
    await loadPriceFactor();

    const detail = await getPackageDetail(packageId.value);
    if (!detail) {
      packageDetail.value = null;
      packageLoadFailed.value = true;
      uni.showToast({
        title: '套餐不存在或已下架',
        icon: 'none',
      });
      return;
    }
    packageDetail.value = detail;
  } catch (error: any) {
    packageDetail.value = null;
    packageLoadFailed.value = true;
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
};

// 加入购物车
const handleAddToCart = async () => {
  if (!userInfo.value?.id) {
    uni.showToast({ title: '请稍候…', icon: 'none' });
    return;
  }

  if (!canAddToCart.value) {
    uni.showToast({
      title: '请联系管理员授权',
      icon: 'none',
    });
    return;
  }

  if (!packageDetail.value?.package_product_skus || packageDetail.value.package_product_skus.length === 0) {
    uni.showToast({
      title: '套餐暂无商品',
      icon: 'none',
    });
    return;
  }

  try {
    // 将套餐中的所有SKU加入购物车
    const promises = packageDetail.value.package_product_skus.map((item: any) => {
      return addToCart({
        skuId: item.product_sku.id,
        quantity: item.quantity,
      });
    });

    await Promise.all(promises);

    uni.showToast({
      title: '已加入购物车',
      icon: 'success',
    });
    loadCartCount();
  } catch (error: any) {
    uni.showToast({
      title: error.message || '加入购物车失败',
      icon: 'none',
    });
  }
};

// 跳转到商品详情
const goToProductDetail = (productId?: number) => {
  if (productId) {
    uni.navigateTo({
      url: `/pages/product-detail/index?id=${productId}`,
    });
  }
};

// 返回（从分享进入时无上一页则回首页）
const goBack = () => {
  safeNavigateBack();
};

// 去首页
const goHome = () => {
  uni.switchTab({
    url: '/pages/index/index',
  });
};

// 去购物车
const goCart = () => {
  uni.switchTab({
    url: '/pages/cart/index',
  });
};

// 加载购物车数量（角标）
const loadCartCount = async () => {
  if (!userInfo.value?.id || !companyInfo.value?.id) {
    cartCount.value = 0;
    return;
  }
  try {
    const list = await getCartList();
    cartCount.value = Array.isArray(list) ? list.length : 0;
  } catch {
    cartCount.value = 0;
  }
};

// 格式化价格
// 注意：根据schema，price字段是numeric类型，存储的是实际价格（不是分）
const formatPrice = (price: number) => {
  return Number(price).toFixed(2);
};

const previewImages = (urls: string[], current: number) => {
  if (!urls || urls.length === 0) return;
  uni.previewImage({
    urls,
    current: current >= 0 ? current : 0,
    loop: true,
    indicator: 'number',
  });
};

const previewCover = () => {
  const url = packageDetail.value?.cover_image_url;
  if (!url) return;
  previewImages([url], 0);
};

onLoad((options?: Record<string, string | undefined>) => {
  void (async () => {
    await whenAppReady();
    const merged = mergeMiniProgramEntryQuery(options);
    const id = parsePositiveIntParam(merged.id);
    const sceneCompanyId = parsePositiveIntParam(merged.companyId);
    if (sceneCompanyId != null && (await shouldAllowAutoSwitchCompanyFromEntry())) {
      try {
        uni.setStorageSync('companyId', String(sceneCompanyId));
      } catch (_) {}
      const cur = companyInfo.value?.id != null ? Number(companyInfo.value.id) : NaN;
      if (!Number.isInteger(cur) || cur !== sceneCompanyId) {
        try {
          await syncCompanyInfo(sceneCompanyId, true);
          if (user_token.value) {
            await getCompanyUserRoleCached(undefined, true);
          }
        } catch (e) {
          console.error('扫码套餐：同步公司上下文失败', e);
        }
      }
    }
    if (id != null) {
      packageId.value = id;
      await loadPackageDetail();
    } else {
      missingPackageId.value = true;
    }
    await loadCartCount();
  })();
});

onShow(() => {
  void loadCartCount();
  if (packageId.value && userInfo.value?.id) {
    void loadPriceFactor(true);
  }
});

// 分享带 companyId，别人点开可进入对应公司
onShareAppMessage(() => {
  const cid = companyInfo?.value?.id ?? uni.getStorageSync('companyId') ?? '';
  const path = cid
    ? `/pages/package-detail/index?id=${packageId.value}&companyId=${cid}`
    : `/pages/package-detail/index?id=${packageId.value}`;
  return {
    title: packageDetail.value?.name || '套餐详情',
    path,
  };
});

onShareTimeline(() => {
  const cid = companyInfo?.value?.id ?? uni.getStorageSync('companyId') ?? '';
  const query = cid
    ? `id=${packageId.value}&companyId=${cid}`
    : `id=${packageId.value}`;
  return {
    title: packageDetail.value?.name || '套餐详情',
    query,
  };
});
</script>

<style scoped>
.package-detail-page {
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

/* 导航占位之下、底栏之上的区域：只占剩余高度，避免整页内容与 scroll-view 叠出双滚动 */
.package-detail-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 内容区高度：扣除底部栏与安全区 */
.skeleton-area {
  min-height: 60vh;
  padding: 0;
}

.scroll-content {
  flex: 1;
  height: 0;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
}

.loading-container {
  flex: 1;
  min-height: 0;
  padding: 200rpx 0;
  text-align: center;
  color: #999999;
  font-size: 28rpx;
}

.load-fail-container {
  flex: 1;
  min-height: 0;
  padding: 120rpx 48rpx 200rpx;
  text-align: center;
  color: #666666;
  font-size: 28rpx;
}

.load-fail-text {
  display: block;
  line-height: 1.6;
  margin-bottom: 40rpx;
}

.load-fail-btn {
  font-size: 28rpx;
  padding: 16rpx 48rpx;
  background: #667eea;
  color: #ffffff;
  border-radius: 8rpx;
  border: none;
}

.loading-spinner {
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid #e0e0e0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20rpx;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.cover-section {
  width: 100%;
  background: #ffffff;
  margin-bottom: 20rpx;
}

.cover-image {
  width: 100%;
  display: block;
  vertical-align: top;
}

.cover-placeholder {
  width: 100%;
  min-height: 400rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666666;
  font-size: 28rpx;
}

.package-info-section {
  background: #ffffff;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.package-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 16rpx;
}

.package-description {
  font-size: 28rpx;
  color: #666666;
  line-height: 1.6;
}

/* 保留富文本/纯文本中的换行 */
.package-description--pre-wrap {
  white-space: pre-wrap;
  word-break: break-word;
}

.products-section {
  background: #ffffff;
  padding: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 24rpx;
}

.product-item {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.product-item:last-child {
  border-bottom: none;
}

.product-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background: #f0f0f0;
  flex-shrink: 0;
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.product-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333333;
  margin-bottom: 8rpx;
}

.product-spec {
  font-size: 24rpx;
  color: #999999;
  margin-bottom: 12rpx;
}

.product-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.product-price {
  font-size: 32rpx;
  font-weight: bold;
  color: #ff6b6b;
}

.product-quantity {
  font-size: 24rpx;
  color: #999999;
}

/* 套餐总价条（在内容区底部） */
.package-total-bar {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  padding: 24rpx 30rpx;
  background: #ffffff;
  margin-bottom: 20rpx;
}

.package-total-bar .total-label {
  font-size: 28rpx;
  color: #666666;
}

.package-total-bar .total-amount {
  font-size: 40rpx;
  font-weight: bold;
  color: #ff6b6b;
}

.package-total-bar .total-amount-hidden {
  color: #999;
  font-weight: normal;
}

.product-price-hidden {
  color: #999;
  font-weight: normal;
}

.footer-placeholder {
  height: calc(100rpx + env(safe-area-inset-bottom));
}

/* 套餐详情页底部主按钮（与产品详情风格统一） */
.package-detail-footer-btn {
  height: 72rpx;
  padding: 0 48rpx;
  background: #0d9488;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 36rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
</style>
