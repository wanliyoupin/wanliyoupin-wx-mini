<template>
  <view class="company-management-page">
    <view class="page-header">
      <view class="company-info-card">
        <image 
          v-if="companyInfo?.logo_url" 
          :src="companyInfo.logo_url" 
          class="company-logo"
          mode="aspectFill"
        />
        <view v-else class="company-logo-placeholder">
          <text>{{ companyInfo?.name?.[0] || 'C' }}</text>
        </view>
        <view class="company-name">{{ companyInfo?.name || '公司管理' }}</view>
      </view>
    </view>

    <view class="management-grid">
      <view class="management-item" @click="goToCompanySettings">
        <view class="management-icon-wrapper settings">
          <text class="management-icon">⚙️</text>
        </view>
        <text class="management-label">公司设置</text>
        <text class="management-desc">设置logo、轮播图、名称</text>
      </view>

      <view class="management-item" @click="goToCategoryManagement">
        <view class="management-icon-wrapper category">
          <text class="management-icon">📂</text>
        </view>
        <text class="management-label">分类管理</text>
        <text class="management-desc">管理本公司下的分类</text>
      </view>

      <view class="management-item" @click="goToProductManagement">
        <view class="management-icon-wrapper product">
          <text class="management-icon">📦</text>
        </view>
        <text class="management-label">商品管理</text>
        <text class="management-desc">管理本公司下的商品</text>
      </view>

      <view class="management-item" @click="goToPackageManagement">
        <view class="management-icon-wrapper package">
          <text class="management-icon">🎁</text>
        </view>
        <text class="management-label">套餐管理</text>
        <text class="management-desc">管理本公司下的套餐</text>
      </view>

      <view class="management-item" @click="goToUserManagement">
        <view class="management-icon-wrapper user">
          <text class="management-icon">👥</text>
        </view>
        <text class="management-label">用户管理</text>
        <text class="management-desc">管理本公司下的用户</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { companyInfo } from '@/store/userStore';
import { syncCompanyInfo } from '@/api/company/index';

// 跳转到公司设置
const goToCompanySettings = () => {
  if (!companyInfo.value?.id) {
    uni.showToast({
      title: '公司信息不存在',
      icon: 'none',
    });
    return;
  }
  uni.navigateTo({
    url: `/subPackages/company/company-settings/index?id=${companyInfo.value.id}`,
  });
};

// 跳转到分类管理
const goToCategoryManagement = () => {
  uni.navigateTo({
    url: '/subPackages/company/category-list/index',
  });
};

// 跳转到商品管理
const goToProductManagement = () => {
  uni.navigateTo({
    url: '/subPackages/company/product-list/index',
  });
};

// 跳转到套餐管理
const goToPackageManagement = () => {
  uni.navigateTo({
    url: '/subPackages/company/package-list/index',
  });
};

// 跳转到用户管理
const goToUserManagement = () => {
  uni.navigateTo({
    url: '/subPackages/company/company-user-list/index',
  });
};

onMounted(async () => {
  // 确保公司信息已同步
  if (companyInfo.value?.id) {
    try {
      await syncCompanyInfo(companyInfo.value.id);
    } catch (error) {
      console.error('同步公司信息失败:', error);
    }
  }
});
</script>

<style scoped>
.company-management-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx 30rpx;
}

.company-info-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: rgba(255, 255, 255, 0.95);
  padding: 30rpx;
  border-radius: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.1);
}

.company-logo,
.company-logo-placeholder {
  width: 120rpx;
  height: 120rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.company-logo {
  background: #f0f0f0;
}

.company-logo-placeholder text {
  color: #ffffff;
  font-size: 48rpx;
  font-weight: bold;
}

.company-name {
  flex: 1;
  font-size: 36rpx;
  font-weight: bold;
  color: #333333;
}

.management-grid {
  padding: 30rpx;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}

.management-item {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 40rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
  transition: all 0.3s;
}

.management-item:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.management-icon-wrapper {
  width: 120rpx;
  height: 120rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8rpx;
}

.management-icon-wrapper.settings {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.management-icon-wrapper.category {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.management-icon-wrapper.product {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.management-icon-wrapper.package {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.management-icon-wrapper.user {
  background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
}

.management-icon {
  font-size: 64rpx;
}

.management-label {
  font-size: 32rpx;
  font-weight: 600;
  color: #333333;
  text-align: center;
}

.management-desc {
  font-size: 24rpx;
  color: #999999;
  text-align: center;
  line-height: 1.4;
}
</style>
