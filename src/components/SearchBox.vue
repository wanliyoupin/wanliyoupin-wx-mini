<template>
  <view class="search-box" @click="goSearch">
    <view class="search-input">
      <image
        v-if="searchIcon"
        class="search-icon img"
        :src="searchIcon"
        mode="aspectFit"
      />
      <text v-else class="search-icon text">🔍</text>
      <text class="search-placeholder">{{ placeholderText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
/**
 * 搜索框占位组件：点击后跳转到搜索页并自动聚焦
 * type: product | package
 * 从分类页跳转时可传 categoryId/categoryName，搜索页会按该分类筛选商品
 */
interface Props {
  /** 搜索类型：商品 / 套餐 */
  type: 'product' | 'package';
  /** 占位文案 */
  placeholder?: string;
  /** 自定义搜索图标路径，不传则用默认 emoji */
  searchIcon?: string;
  /** 分类筛选（仅 type=product 时有效，如从分类页跳转则传入当前分类 id） */
  categoryId?: number | null;
  /** 分类名称，用于搜索页展示 */
  categoryName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: () => '',
  searchIcon: '',
  categoryId: undefined,
  categoryName: '',
});

const placeholders: Record<string, string> = {
  product: '请输入商品名称',
  package: '请输入套餐名称',
};

const placeholderText = computed(() => props.placeholder || placeholders[props.type] || '搜索');

function goSearch() {
  let url = `/pages/search/index?type=${props.type}`;
  if (props.type === 'product' && props.categoryId != null) {
    url += `&categoryId=${props.categoryId}`;
    if (props.categoryName) {
      url += `&categoryName=${encodeURIComponent(props.categoryName)}`;
    }
  }
  uni.navigateTo({ url });
}
</script>

<script lang="ts">
export default { name: 'SearchBox' };
</script>

<style scoped>
.search-box {
  padding: 20rpx 30rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #e0e0e0;
}

.search-input {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 50rpx;
  padding: 16rpx 24rpx;
  gap: 16rpx;
}

.search-icon.img {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
}

.search-icon.text {
  font-size: 32rpx;
  flex-shrink: 0;
}

.search-placeholder {
  flex: 1;
  font-size: 28rpx;
  color: #999;
}
</style>
