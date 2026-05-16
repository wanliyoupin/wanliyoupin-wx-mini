<template>
  <view class="skeleton-wrap" :class="[type, customClass]">
    <!-- 列表网格 2 列（商品列表） -->
    <template v-if="type === 'list-grid-2'">
      <view v-for="i in (count || 6)" :key="i" class="skeleton-card s2">
        <view class="skeleton-img"></view>
        <view class="skeleton-line w100"></view>
        <view class="skeleton-line w60"></view>
      </view>
    </template>
    <!-- 列表网格 3 列（套餐列表） -->
    <template v-else-if="type === 'list-grid-3'">
      <view v-for="i in (count || 6)" :key="i" class="skeleton-card s3">
        <view class="skeleton-img"></view>
        <view class="skeleton-line w100"></view>
      </view>
    </template>
    <!-- 列表行（购物车、订单列表） -->
    <template v-else-if="type === 'list-row'">
      <view v-for="i in (count || 4)" :key="i" class="skeleton-row">
        <view class="skeleton-img square"></view>
        <view class="skeleton-body">
          <view class="skeleton-line w100"></view>
          <view class="skeleton-line w80"></view>
          <view class="skeleton-line w40"></view>
        </view>
      </view>
    </template>
    <!-- 详情页（商品/套餐/订单详情） -->
    <template v-else-if="type === 'detail'">
      <view class="skeleton-detail-img"></view>
      <view class="skeleton-detail-body">
        <view class="skeleton-line w100 long"></view>
        <view class="skeleton-line w70"></view>
        <view class="skeleton-line w90"></view>
        <view class="skeleton-line w50"></view>
      </view>
    </template>
    <!-- 资源/简单列表 -->
    <template v-else-if="type === 'simple'">
      <view v-for="i in (count || 3)" :key="i" class="skeleton-line w100"></view>
    </template>
  </view>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    type: 'list-grid-2' | 'list-grid-3' | 'list-row' | 'detail' | 'simple';
    count?: number;
    customClass?: string;
  }>(),
  { count: undefined, customClass: '' }
);
</script>

<style scoped>
.skeleton-wrap {
  padding: 24rpx;
}

/* 通用骨架块 */
.skeleton-img {
  width: 100%;
  aspect-ratio: 1;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 12rpx;
}

.skeleton-img.square {
  width: 160rpx;
  height: 160rpx;
  flex-shrink: 0;
  aspect-ratio: auto;
}

.skeleton-line {
  height: 28rpx;
  margin-top: 16rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 8rpx;
}

.skeleton-line.w60 {
  width: 60%;
}

.skeleton-line.w70 {
  width: 70%;
}

.skeleton-line.w80 {
  width: 80%;
}

.skeleton-line.w90 {
  width: 90%;
}

.skeleton-line.w100 {
  width: 100%;
}

.skeleton-line.long {
  height: 36rpx;
}

/* list-grid-2：2 列 */
.skeleton-wrap.list-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.skeleton-card.s2 .skeleton-img {
  border-radius: 16rpx 16rpx 0 0;
}

.skeleton-card.s2 {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  padding-bottom: 20rpx;
}

.skeleton-card.s2 .skeleton-line {
  margin-left: 20rpx;
  margin-right: 20rpx;
}

/* list-grid-3：3 列 */
.skeleton-wrap.list-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24rpx;
}

.skeleton-card.s3 .skeleton-img {
  border-radius: 20rpx 20rpx 0 0;
}

.skeleton-card.s3 {
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  padding-bottom: 16rpx;
}

.skeleton-card.s3 .skeleton-line {
  margin-left: 16rpx;
  margin-right: 16rpx;
}

/* list-row */
.skeleton-row {
  display: flex;
  gap: 24rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
}

.skeleton-body {
  flex: 1;
  min-width: 0;
}

.skeleton-row .skeleton-line {
  margin-top: 12rpx;
}

.skeleton-row .skeleton-line:first-child {
  margin-top: 0;
}

/* detail */
.skeleton-detail-img {
  width: 100%;
  height: 400rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 0;
}

.skeleton-detail-body {
  padding: 30rpx;
}

.skeleton-detail-body .skeleton-line {
  margin-top: 24rpx;
}

.skeleton-detail-body .skeleton-line:first-child {
  margin-top: 0;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
