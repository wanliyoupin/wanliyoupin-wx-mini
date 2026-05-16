<template>
  <view class="detail-footer-bar">
    <view class="detail-footer-inner">
      <view class="detail-footer-nav">
        <view class="detail-footer-nav-item" @click="emit('home')">
          <image class="detail-footer-nav-icon" src="/static/navbar/shouye.png" mode="aspectFit" />
          <text class="detail-footer-nav-label">首页</text>
        </view>
        <view class="detail-footer-nav-item" @click="emit('cart')">
          <view class="detail-footer-nav-icon-wrap">
            <image class="detail-footer-nav-icon" src="/static/navbar/gouwuche.png" mode="aspectFit" />
            <view v-if="(cartCount ?? 0) > 0" class="detail-footer-nav-badge">{{ (cartCount ?? 0) > 99 ? '99+' : (cartCount ?? 0) }}</view>
          </view>
          <text class="detail-footer-nav-label">购物车</text>
        </view>
      </view>
      <view class="detail-footer-action">
        <slot />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  cartCount?: number;
}>();

const emit = defineEmits<{
  home: [];
  cart: [];
}>();
</script>

<style scoped>
.detail-footer-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: env(safe-area-inset-bottom);
  background: #ffffff;
  border-top: 1rpx solid #e8e8e8;
  z-index: 1000;
}

.detail-footer-inner {
  height: 100rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  box-sizing: border-box;
}

.detail-footer-nav {
  display: flex;
  align-items: center;
  gap: 48rpx;
  flex-shrink: 0;
}

.detail-footer-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.detail-footer-nav-icon-wrap {
  position: relative;
}

.detail-footer-nav-icon {
  width: 44rpx;
  height: 44rpx;
  display: block;
}

.detail-footer-nav-label {
  font-size: 24rpx;
  color: #666666;
}

.detail-footer-nav-badge {
  position: absolute;
  top: -6rpx;
  right: -10rpx;
  min-width: 28rpx;
  height: 28rpx;
  padding: 0 6rpx;
  background: #e53935;
  color: #fff;
  font-size: 18rpx;
  font-weight: 600;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.detail-footer-action {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-left: 64rpx;
}
</style>
