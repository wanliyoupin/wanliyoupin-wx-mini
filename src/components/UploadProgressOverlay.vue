<template>
  <view v-if="show" class="upload-progress-overlay">
    <view class="upload-progress-box">
      <text class="upload-progress-text">上传中 {{ progress }}%</text>
      <view class="upload-progress-bar">
        <view class="upload-progress-fill" :style="{ width: progress + '%' }"></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean;
  progress: number;
}>();
</script>

<style scoped>
.upload-progress-overlay {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.upload-progress-box {
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx 48rpx;
  min-width: 400rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
}

.upload-progress-text {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 20rpx;
  text-align: center;
}

.upload-progress-bar {
  height: 12rpx;
  background: #eee;
  border-radius: 6rpx;
  overflow: hidden;
}

.upload-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 6rpx;
  transition: width 0.2s ease;
}
</style>
