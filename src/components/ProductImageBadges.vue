<template>
  <view v-if="tagList.length > 0 || outOfStock" class="product-image-badges">
    <view class="badge-col badge-col--left">
      <text v-for="(tag, i) in tagList" :key="i" class="product-tag-pill">{{ tag }}</text>
    </view>
    <view class="badge-col badge-col--right">
      <view v-if="outOfStock" class="product-out-of-stock">缺货</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** products.tags 原始字符串，逗号/顿号等分隔 */
    tags?: string | null;
    outOfStock?: boolean;
  }>(),
  { tags: null, outOfStock: false }
);

const tagList = computed(() => {
  const raw = props.tags;
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(/[,，、|｜]/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);
});
</script>

<style scoped>
.product-image-badges {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-end;
  pointer-events: none;
}

.badge-col {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 6rpx;
  max-width: 55%;
}

.badge-col--left {
  justify-content: flex-start;
}

.badge-col--right {
  justify-content: flex-end;
  max-width: 45%;
  flex-shrink: 0;
}

.product-tag-pill {
  font-size: 22rpx;
  color: #ffffff;
  background: rgba(34, 197, 94, 0.92);
  padding: 6rpx 12rpx;
  line-height: 1.2;
  border-radius: 0 10rpx 0 0;
}

.product-out-of-stock {
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  padding: 6rpx 12rpx;
  border-radius: 10rpx 0 0 0;
  font-size: 22rpx;
  line-height: 1.2;
}
</style>
