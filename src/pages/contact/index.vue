<template>
  <view class="contact-page">
    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>
    <view v-else-if="!info" class="empty-wrap">
      <text class="empty-text">暂无客服信息</text>
      <text class="empty-hint">请确保已选择公司或稍后再试</text>
    </view>
    <scroll-view v-else scroll-y class="content-scroll">
      <view v-if="info.name" class="company-name">{{ info.name }}</view>

      <!-- 联系二维码/图片：点击预览 -->
      <view v-if="info.contact_code" class="qrcode-section">
        <text class="section-label">扫码联系</text>
        <image
          class="contact-qr"
          :src="info.contact_code"
          mode="aspectFit"
          @click="previewImage(info.contact_code)"
        />
        <text class="qrcode-hint">点击图片可放大预览</text>
      </view>

      <!-- 公司介绍：标题与内容分行显示 -->
      <view v-if="info.description" class="desc-section">
        <text class="desc-section-label">公司介绍</text>
        <text class="desc-text">{{ info.description }}</text>
      </view>

      <view v-if="!info.contact_code && !info.description" class="no-content">
        <text>暂无联系方式与介绍</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { whenAppReady } from '@/utils/appReady';
import { onLoad } from '@dcloudio/uni-app';
import { companyInfo } from '@/store/userStore';
import { getCompanyPublicInfo } from '@/api/company/index';
import type { CompanyPublicInfo } from '@/api/company/index';

const loading = ref(true);
const info = ref<CompanyPublicInfo | null>(null);
const companyIdParam = ref<number | null>(null);

onLoad((options?: { companyId?: string }) => {
  if (options?.companyId) {
    companyIdParam.value = Number(options.companyId);
  }
});

onMounted(async () => {
  await whenAppReady();
  const companyId = companyIdParam.value ?? companyInfo.value?.id ?? null;
  if (!companyId) {
    loading.value = false;
    return;
  }
  try {
    const data = await getCompanyPublicInfo(Number(companyId));
    info.value = data;
  } catch {
    info.value = null;
  } finally {
    loading.value = false;
  }
});

function previewImage(url: string) {
  if (!url) return;
  uni.previewImage({
    current: url,
    urls: [url],
  });
}
</script>

<style scoped>
.contact-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.loading-wrap,
.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16rpx;
}

.loading-text {
  font-size: 28rpx;
  color: #999;
}

.empty-text {
  font-size: 30rpx;
  color: #666;
}

.empty-hint {
  font-size: 26rpx;
  color: #999;
}

.content-scroll {
  height: 100vh;
  padding: 32rpx;
  box-sizing: border-box;
}

.company-name {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f2937;
  text-align: center;
  margin-bottom: 32rpx;
}

.qrcode-section {
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.section-label {
  font-size: 26rpx;
  color: #6b7280;
  margin-bottom: 20rpx;
}

.contact-qr {
  width: 400rpx;
  height: 400rpx;
  border-radius: 16rpx;
}

.qrcode-hint {
  font-size: 24rpx;
  color: #9ca3af;
  margin-top: 16rpx;
}

.desc-section {
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.desc-section-label {
  font-size: 26rpx;
  color: #6b7280;
  font-weight: 500;
  display: block;
}

.desc-text {
  font-size: 28rpx;
  color: #374151;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  display: block;
}

.no-content {
  text-align: center;
  padding: 60rpx;
  font-size: 28rpx;
  color: #9ca3af;
}
</style>
