<template>
  <view class="page-nav-bar">
    <!-- 固定导航栏：状态栏占位 + 标题栏 -->
    <view
      class="navbar-fixed"
      :style="{ paddingTop: statusBarHeight + 'px' }"
    >
      <view class="navbar-content">
        <view v-if="showBack" class="navbar-back" @click="onBack">
          <text class="navbar-back-icon">←</text>
        </view>
        <view v-else class="navbar-back-placeholder"></view>
        <view class="navbar-title">{{ title }}</view>
        <view class="navbar-right">
          <slot name="right"></slot>
        </view>
      </view>
    </view>
    <!-- 占位，保证页面内容不被固定栏遮挡 -->
    <view class="navbar-spacer" :style="{ height: totalHeight + 'px' }"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    showBack?: boolean;
  }>(),
  { showBack: false }
);

const emit = defineEmits<{ (e: 'back'): void }>();

// 小程序原生标题栏高度（px），与系统导航栏一致
const TITLE_BAR_HEIGHT_PX = 44;

const statusBarHeight = ref(20);
const totalHeight = computed(() => statusBarHeight.value + TITLE_BAR_HEIGHT_PX);

function onBack() {
  emit('back');
}

onMounted(() => {
  try {
    const sys = uni.getSystemInfoSync();
    statusBarHeight.value = sys.statusBarHeight ?? 20;
  } catch {
    statusBarHeight.value = 20;
  }
});

defineExpose({
  statusBarHeight,
  totalHeight: totalHeight,
});
</script>

<style scoped>
.page-nav-bar {
  width: 100%;
}

.navbar-fixed {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #ffffff;
  z-index: 1000;
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.05);
}

.navbar-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
}

.navbar-back,
.navbar-back-placeholder {
  width: 80rpx;
  height: 44px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.navbar-back-icon {
  font-size: 40rpx;
  color: #333;
  line-height: 1;
  font-weight: 300;
}

.navbar-back-placeholder {
  visibility: hidden;
}

.navbar-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navbar-right {
  width: 60rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.navbar-spacer {
  width: 100%;
  flex-shrink: 0;
}
</style>
