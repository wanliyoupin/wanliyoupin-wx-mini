<template>
  <view class="cart-page">
    <!-- 统一导航栏（含状态栏高度） -->
    <PageNavBar title="购物车" />

    <!-- 当前公司与管理按钮同一行（避免被小程序关闭按钮遮挡） -->
    <view v-if="companyInfo?.name || cartItems.length > 0" class="company-bar">
      <view class="company-left">
        <text v-if="companyInfo?.name" class="company-label">当前公司：</text>
        <text class="company-name">{{ companyInfo?.name || '' }}</text>
      </view>
      <text v-if="cartItems.length > 0" class="manage-btn" @click="toggleManageMode">
        {{ isManageMode ? '完成' : '管理' }}
      </text>
    </view>

    <!-- 骨架屏（首屏加载） -->
    <view v-if="loading && userInfo?.id" class="skeleton-area">
      <SkeletonScreen type="list-row" :count="4" />
    </view>

    <!-- 静默登录未完成 -->
    <view v-else-if="!loading && !userInfo?.id" class="empty-state">
      <text class="empty-text">正在初始化…</text>
    </view>

    <!-- 购物车列表：与底部结算栏同属 flex 列，scroll-view 占满剩余高度，避免固定高度算错被遮挡 -->
    <view v-else-if="userInfo?.id && cartItems.length > 0" class="cart-content">
      <scroll-view scroll-y class="cart-list" :show-scrollbar="false">
        <view
          v-for="(item, index) in cartItems"
          :key="item.id"
          class="cart-item"
        >
          <!-- 选中框 -->
          <view class="checkbox-wrapper" @click="toggleSelect(index)">
            <view class="checkbox" :class="{ checked: item.selected }">
              <text v-if="item.selected">✓</text>
            </view>
          </view>

          <!-- 商品信息 -->
          <image
            class="item-image"
            :src="item.product_sku?.product?.cover_image_url || item.product_sku?.image_url || '/static/default.png'"
            mode="aspectFill"
            @click="goToProductDetail(item.product_sku?.product?.id)"
          ></image>

          <view class="item-info">
            <view class="item-title-row">
              <view class="item-name" @click="goToProductDetail(item.product_sku?.product?.id)">
                {{ item.product_sku?.product?.name || '商品' }}
              </view>
              <view v-if="isOutOfStock(item)" class="stock-short-tag">缺货</view>
            </view>
            <view class="item-spec">{{ item.product_sku?.name || '规格' }}</view>
            <view class="item-price-row">
              <text v-if="canViewPrice" class="item-price">¥{{ formatPrice((item.product_sku?.price || 0) * priceFactor) }}</text>
              <text v-else class="item-price item-price-hidden">--</text>
              <view class="quantity-control">
                <view
                  class="quantity-btn"
                  @click.stop="decreaseQuantity(index)"
                  :class="{ disabled: item.quantity <= 1 }"
                >
                  -
                </view>
                <text class="quantity-text">{{ item.quantity }}</text>
                <view
                  class="quantity-btn"
                  @click.stop="increaseQuantity(index)"
                  :class="{ disabled: isOutOfStock(item) }"
                >
                  +
                </view>
              </view>
            </view>
          </view>

        </view>
      </scroll-view>

      <!-- 底部栏：管理模式显示「删除选中」，否则显示「生成清单」；内层固定高度保证垂直居中 -->
      <view class="cart-footer">
        <view class="cart-footer-inner">
          <view class="footer-left">
            <view class="checkbox-wrapper" @click="toggleSelectAll">
              <view class="checkbox" :class="{ checked: isAllSelected }">
                <text v-if="isAllSelected">✓</text>
              </view>
              <text class="select-all-text">全选</text>
            </view>
            <template v-if="!isManageMode">
              <view class="total-info">
                <text class="total-label">合计：</text>
                <text v-if="canViewPrice" class="total-price">¥{{ formatPrice(totalPrice) }}</text>
                <text v-else class="total-price total-price-hidden">--</text>
              </view>
            </template>
          </view>
          <template v-if="isManageMode">
            <button
              class="delete-selected-btn"
              :class="{ disabled: selectedCount === 0 }"
              @click="deleteSelectedItems"
            >
              删除选中({{ selectedCount }})
            </button>
          </template>
          <button
            v-else
            type="primary"
            class="checkout-btn"
            :class="{ disabled: selectedCount === 0 }"
            hover-class="checkout-btn-hover"
            @click="handleCheckout"
          >
            <view class="checkout-btn-inner">
              <view class="checkout-line-top">
                <text>生成清单</text>
                <text v-if="selectedCount > 0" class="checkout-count">{{ selectedCount }}</text>
              </view>
              <text class="checkout-line-sub">（无需支付）</text>
            </view>
          </button>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty-state">
      <text class="empty-icon">🛒</text>
      <text class="empty-text">购物车是空的</text>
      <button class="go-shopping-btn" @click="goShopping">去逛逛</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { whenAppReady } from '@/utils/appReady';
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { userInfo, companyInfo } from '@/store/userStore';
import { getCompanyUserRoleCached } from '@/utils/auth';
import PageNavBar from '@/components/PageNavBar.vue';
import SkeletonScreen from '@/components/SkeletonScreen.vue';
import {
  getCartList,
  updateCartQuantity,
  toggleCartSelected,
  deleteCartItem,
} from '@/api/cart/index';

const cartItems = ref<any[]>([]);
const loading = ref(false);
const isManageMode = ref(false);
const priceFactor = ref(1);
const canViewPrice = ref(false);

const CART_CACHE_TTL = 30 * 1000;
const cartListCache = ref<{ items: any[]; timestamp: number } | null>(null);

// 计算属性
const selectedCount = computed(() => {
  return cartItems.value.filter(item => item.selected).length;
});

const isAllSelected = computed(() => {
  return cartItems.value.length > 0 && cartItems.value.every(item => item.selected);
});

// 计算总价（应用价格系数）
const totalPrice = computed(() => {
  return cartItems.value
    .filter(item => item.selected)
    .reduce((sum, item) => {
      const basePrice = item.product_sku?.price || 0;
      return sum + basePrice * priceFactor.value * item.quantity;
    }, 0);
});

// 加载价格系数
const loadPriceFactor = async (forceRefresh?: boolean) => {
  if (!userInfo.value?.id) {
    priceFactor.value = 1;
    return;
  }

  try {
    const roleInfo = await getCompanyUserRoleCached(companyInfo.value?.id, forceRefresh);
    if (roleInfo) {
      priceFactor.value = roleInfo.priceFactor || 1;
      canViewPrice.value = roleInfo.canViewPrice;
    } else {
      priceFactor.value = 1;
      canViewPrice.value = false;
    }
  } catch (error) {
    console.error('加载价格系数失败:', error);
    priceFactor.value = 1;
    canViewPrice.value = false;
  }
};

// 加载购物车，forceRefresh 时跳过 30 秒缓存（下拉刷新、从结算返回等）
const loadCart = async (forceRefresh = false) => {
  if (!userInfo.value?.id) {
    cartItems.value = [];
    return;
  }

  const cache = cartListCache.value;
  if (!forceRefresh && cache && Date.now() - cache.timestamp < CART_CACHE_TTL) {
    cartItems.value = cache.items.map((item: any) => ({
      ...item,
      selected: item.selected || false,
    }));
    await loadPriceFactor();
    if (typeof uni !== 'undefined' && uni.stopPullDownRefresh) uni.stopPullDownRefresh();
    return;
  }

  loading.value = true;
  try {
    await loadPriceFactor();
    const items = await getCartList();
    const list = items.map((item: any) => ({
      ...item,
      selected: item.selected || false,
    }));
    cartItems.value = list;
    cartListCache.value = { items: list, timestamp: Date.now() };
  } catch (error: any) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
    if (typeof uni !== 'undefined' && uni.stopPullDownRefresh) uni.stopPullDownRefresh();
  }
};

// 切换管理模式
const toggleManageMode = () => {
  isManageMode.value = !isManageMode.value;
  if (!isManageMode.value) {
    // 退出管理模式时，重置选中状态
    cartItems.value.forEach(item => {
      item.selected = false;
    });
  }
};

/** SKU 展示库存小于 1 视为无货；大于等于 1 一律视为有货（不与购物车数量比较） */
function isOutOfStock(item: any): boolean {
  return Number(item.product_sku?.stock ?? 0) < 1;
}

// 切换选中状态（勾选缺货商品时校验并提示）
const toggleSelect = async (index: number) => {
  const item = cartItems.value[index];
  const newSelected = !item.selected;

  if (newSelected && isOutOfStock(item)) {
    uni.showToast({
      title: '该商品缺货，无法勾选',
      icon: 'none',
    });
    return;
  }

  try {
    await toggleCartSelected(item.id, newSelected);
    item.selected = newSelected;
  } catch (error: any) {
    uni.showToast({
      title: error.message || '操作失败',
      icon: 'none',
    });
  }
};

// 全选/取消全选（全选时跳过缺货商品并提示）
const toggleSelectAll = async () => {
  const newSelected = !isAllSelected.value;

  if (newSelected) {
    const outOfStockItems = cartItems.value.filter((item: any) => isOutOfStock(item));
    if (outOfStockItems.length > 0) {
      const toSelect = cartItems.value.filter((item: any) => !isOutOfStock(item));
      try {
        await Promise.all(toSelect.map((item: any) => toggleCartSelected(item.id, true)));
        toSelect.forEach((item: any) => { item.selected = true; });
        outOfStockItems.forEach((item: any) => { item.selected = false; });
        uni.showToast({
          title: `${outOfStockItems.length} 件商品缺货已跳过`,
          icon: 'none',
        });
      } catch (error: any) {
        uni.showToast({ title: error.message || '操作失败', icon: 'none' });
      }
      return;
    }
  }

  try {
    await Promise.all(
      cartItems.value.map((item: any) => toggleCartSelected(item.id, newSelected))
    );
    cartItems.value.forEach((item: any) => {
      item.selected = newSelected;
    });
  } catch (error: any) {
    uni.showToast({
      title: error.message || '操作失败',
      icon: 'none',
    });
  }
};

// 增加数量：仅展示库存小于 1 时不可加；不再按「数量大于库存」拦截
const increaseQuantity = async (index: number) => {
  const item = cartItems.value[index];
  if (isOutOfStock(item)) {
    uni.showToast({
      title: '该规格暂无库存',
      icon: 'none',
    });
    return;
  }

  try {
    await updateCartQuantity(item.id, item.quantity + 1);
    item.quantity++;
  } catch (error: any) {
    uni.showToast({
      title: error.message || '操作失败',
      icon: 'none',
    });
  }
};

// 减少数量
const decreaseQuantity = async (index: number) => {
  const item = cartItems.value[index];
  
  if (item.quantity <= 1) {
    return;
  }

  try {
    await updateCartQuantity(item.id, item.quantity - 1);
    item.quantity--;
  } catch (error: any) {
    uni.showToast({
      title: error.message || '操作失败',
      icon: 'none',
    });
  }
};

// 管理模式：批量删除选中的商品
const deleteSelectedItems = async () => {
  const selected = cartItems.value.filter(item => item.selected);
  if (selected.length === 0) {
    uni.showToast({ title: '请先勾选要删除的商品', icon: 'none' });
    return;
  }
  uni.showModal({
    title: '确认删除',
    content: `确定要删除选中的 ${selected.length} 件商品吗？`,
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await Promise.all(selected.map(item => deleteCartItem(item.id)));
        const ids = new Set(selected.map(item => item.id));
        cartItems.value = cartItems.value.filter(item => !ids.has(item.id));
        isManageMode.value = false;
        uni.showToast({ title: '删除成功', icon: 'success' });
      } catch (error: any) {
        uni.showToast({ title: error.message || '删除失败', icon: 'none' });
      }
    },
  });
};

// 生成清单（跳转确认页，无需支付）
const handleCheckout = () => {
  if (selectedCount.value === 0) {
    uni.showToast({
      title: '请选择商品',
      icon: 'none',
    });
    return;
  }

  const selectedItems = cartItems.value.filter(item => item.selected);
  const itemIds = selectedItems.map(item => item.id);
  
  uni.navigateTo({
    url: `/pages/order/index?cartIds=${itemIds.join(',')}`,
  });
};

// 跳转到商品详情
const goToProductDetail = (productId?: number) => {
  if (productId) {
    uni.navigateTo({
      url: `/pages/product-detail/index?id=${productId}`,
    });
  }
};

// 去逛逛
const goShopping = () => {
  uni.switchTab({
    url: '/pages/index/index',
  });
};

// 格式化价格
// 注意：根据schema，price字段是numeric类型，存储的是实际价格（不是分）
const formatPrice = (price: number) => {
  return Number(price).toFixed(2);
};

onShow(async () => {
  await whenAppReady();
  await loadPriceFactor(true);
  // 每次进入页面强制拉取，避免加购后仍命中 30s 本地缓存看不到新数据
  loadCart(true);
});

onPullDownRefresh(() => {
  loadCart(true);
});
</script>

<style scoped>
.cart-page {
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  box-sizing: border-box;
}

.company-bar {
  background: #f0f2f5;
  padding: 16rpx 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  border-bottom: 1rpx solid #e8e8e8;
}

.company-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex: 1;
  min-width: 0;
}

.company-label {
  font-size: 24rpx;
  color: #999;
  flex-shrink: 0;
}

.company-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.manage-btn {
  font-size: 28rpx;
  color: #0d9488;
  flex-shrink: 0;
  padding: 8rpx 0;
}

.skeleton-area {
  padding: 24rpx;
  min-height: 400rpx;
}

.loading-container {
  padding: 200rpx 0;
  text-align: center;
  color: #999999;
  font-size: 28rpx;
}

.loading-spinner {
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid #e0e0e0;
  border-top-color: #0d9488;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20rpx;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.cart-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* flex:1 + height:0 让 scroll-view 在小程序里获得稳定剩余高度，避免与底部结算栏重叠 */
.cart-list {
  flex: 1;
  min-height: 0;
  height: 0;
  width: 100%;
  overflow-anchor: auto;
}

.cart-item {
  background: #ffffff;
  margin: 20rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.checkbox {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid #d0d0d0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  transition: all 0.3s;
}

.checkbox.checked {
  background: #0d9488;
  border-color: #0d9488;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: bold;
}

.item-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background: #f0f0f0;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.item-name {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 500;
  color: #333333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stock-short-tag {
  flex-shrink: 0;
  padding: 4rpx 12rpx;
  font-size: 22rpx;
  font-weight: 500;
  color: #c2410c;
  background: #ffedd5;
  border-radius: 8rpx;
  line-height: 1.2;
}

.item-spec {
  font-size: 24rpx;
  color: #999999;
}

.item-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8rpx;
}

.item-price {
  font-size: 32rpx;
  font-weight: bold;
  color: #ff6b6b;
}

.quantity-control {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  padding: 8rpx;
}

.quantity-btn {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border-radius: 8rpx;
  font-size: 32rpx;
  color: #333333;
  font-weight: bold;
}

.quantity-btn.disabled {
  color: #cccccc;
  background: #f5f5f5;
}

.quantity-text {
  min-width: 60rpx;
  text-align: center;
  font-size: 28rpx;
  color: #333333;
}

.delete-selected-btn {
  height: 64rpx;
  padding: 0 32rpx;
  background: #ef4444;
  color: #ffffff;
  border-radius: 32rpx;
  font-size: 26rpx;
  font-weight: 500;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.delete-selected-btn.disabled {
  background: #e5e7eb;
  color: #9ca3af;
}

.cart-footer {
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom);
  background: #ffffff;
  border-top: 1rpx solid #e8e8e8;
}

.cart-footer-inner {
  min-height: 100rpx;
  padding: 12rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.select-all-text {
  font-size: 26rpx;
  color: #333333;
}

.total-info {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
}

.total-label {
  font-size: 26rpx;
  color: #666666;
}

.total-price {
  font-size: 30rpx;
  font-weight: 600;
  color: #f97316;
}

/* 生成清单：需 type="primary"，否则小程序 button 默认 default 为灰底；内层 text 需单独设白色 */
.checkout-btn {
  min-height: 72rpx;
  padding: 8rpx 32rpx;
  background: #22c55e !important;
  color: #ffffff !important;
  border-radius: 36rpx;
  border: none !important;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkout-btn::after {
  border: none !important;
}

.checkout-btn-hover:not(.disabled) {
  background: #16a34a !important;
  opacity: 0.98;
}

.checkout-btn-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
}

.checkout-line-top {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.2;
  color: #ffffff;
}

.checkout-count {
  font-size: 22rpx;
  font-weight: 500;
  opacity: 0.95;
  color: #ffffff;
}

.checkout-line-sub {
  font-size: 20rpx;
  font-weight: 400;
  line-height: 1.2;
  opacity: 0.92;
  color: #ffffff;
}

.checkout-btn.disabled {
  background: #e5e7eb !important;
  color: #9ca3af !important;
}

.checkout-btn.disabled .checkout-line-top,
.checkout-btn.disabled .checkout-count,
.checkout-btn.disabled .checkout-line-sub {
  color: #9ca3af !important;
  opacity: 1;
}

.empty-state {
  padding: 200rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30rpx;
}

.empty-icon {
  font-size: 120rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999999;
}

.login-btn,
.go-shopping-btn {
  padding: 16rpx 48rpx;
  background: #0d9488;
  color: #ffffff;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: 500;
  border: none;
}
</style>
