<template>
  <view class="resource-page">
    <view v-if="loading" class="skeleton-area">
      <SkeletonScreen type="simple" :count="3" />
    </view>
    <view v-else-if="!companyId" class="empty-state">
      <text class="empty-text">请先选择公司</text>
    </view>
    <view v-else-if="!info?.resource_file_url" class="empty-state">
      <text class="empty-text">暂无资料</text>
      <text class="empty-hint">该公司未上传资源文件</text>
    </view>
    <view v-else class="resource-card" @click="openResource">
      <view class="resource-icon">📁</view>
      <text class="resource-title">公司资料</text>
      <text class="resource-desc">点击查看</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { whenAppReady } from '@/utils/appReady';
import { onShow } from '@dcloudio/uni-app';
import { companyInfo } from '@/store/userStore';
import { getCompanyPublicInfo } from '@/api/company/index';
import type { CompanyPublicInfo } from '@/api/company/index';
import SkeletonScreen from '@/components/SkeletonScreen.vue';

const loading = ref(true);
const info = ref<CompanyPublicInfo | null>(null);
const companyId = ref<number | null>(null);

// 仅 onShow 拉数，避免首次进入时与 onMounted 重复请求；等全局就绪后再读 companyId
onShow(async () => {
  await whenAppReady();
  companyId.value = companyInfo.value?.id ?? null;
  load();
});

async function load() {
  const id = companyInfo.value?.id;
  if (!id) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    info.value = await getCompanyPublicInfo(id);
  } catch (e) {
    console.error(e);
    info.value = null;
  } finally {
    loading.value = false;
  }
}

function openResource() {
  const url = info.value?.resource_file_url;
  if (!url) return;
  uni.showLoading({ title: '打开中...' });
  uni.downloadFile({
    url,
    success: (res) => {
      uni.hideLoading();
      if (res.statusCode === 200) {
        uni.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          fail: (err) => {
            uni.showToast({
              title: err.errMsg || '无法打开文件',
              icon: 'none',
            });
          },
        });
      } else {
        uni.showToast({ title: '下载失败', icon: 'none' });
      }
    },
    fail: () => {
      uni.hideLoading();
      uni.showToast({ title: '下载失败', icon: 'none' });
    },
  });
}
</script>

<style scoped>
.resource-page {
  min-height: 100vh;
  padding: 40rpx;
  background: #f5f5f5;
}

.skeleton-area {
  min-height: 200rpx;
  padding: 24rpx 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  color: #999;
  font-size: 28rpx;
}

.empty-hint {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #bbb;
}

.resource-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 48rpx;
  text-align: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.resource-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.resource-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
}

.resource-desc {
  font-size: 26rpx;
  color: #667eea;
}
</style>
