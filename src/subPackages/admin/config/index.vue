<template>
  <view class="config-page">
    <view class="config-section">
      <view class="section-title">默认展示公司</view>
      <view class="config-item">
        <view class="config-label">当前默认展示公司</view>
        <view v-if="defaultCompany" class="company-display">
          <text class="company-name">{{ defaultCompany.name }}</text>
          <button class="change-btn" @click="showCompanyPicker = true">更改</button>
        </view>
        <view v-else class="no-company">
          <text class="no-company-text">未设置</text>
          <button class="change-btn" @click="showCompanyPicker = true">设置</button>
        </view>
      </view>
    </view>

    <!-- 公司选择弹窗 -->
    <view v-if="showCompanyPicker" class="modal-overlay" @click="showCompanyPicker = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">选择默认展示公司</text>
          <text class="modal-close" @click="showCompanyPicker = false">×</text>
        </view>
        <view class="modal-body">
          <scroll-view scroll-y class="company-list">
            <view 
              v-for="company in companies" 
              :key="company.id"
              class="company-item"
              :class="{ active: selectedCompanyId === company.id }"
              @click="selectCompany(company)"
            >
              <text class="company-name">{{ company.name }}</text>
              <text v-if="selectedCompanyId === company.id" class="check-icon">✓</text>
            </view>
            <view v-if="companies.length === 0" class="empty-companies">
              <text>暂无公司</text>
            </view>
          </scroll-view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn" @click="saveDefaultCompany">保存</button>
          <button class="modal-btn cancel" @click="showCompanyPicker = false">取消</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getCompanyList, getDefaultDisplayCompanyId, setDefaultDisplayCompanyId } from '@/subPackages/admin/api/platform';

const defaultCompany = ref<any>(null);
const companies = ref<any[]>([]);
const showCompanyPicker = ref(false);
const selectedCompanyId = ref<number | null>(null);

// 加载默认公司
const loadDefaultCompany = async () => {
  try {
    const companyId = await getDefaultDisplayCompanyId();
    if (companyId) {
      // 查询公司详情
      const result = await getCompanyList({ limit: 1000 });
      const company = result.companies.find((c: any) => c.id === companyId);
      if (company) {
        defaultCompany.value = company;
        selectedCompanyId.value = companyId;
      }
    }
  } catch (error) {
    console.error('加载默认公司失败:', error);
  }
};

// 加载公司列表
const loadCompanies = async () => {
  try {
    const result = await getCompanyList({ limit: 1000 });
    companies.value = result.companies;
  } catch (error: any) {
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none',
    });
  }
};

// 选择公司
const selectCompany = (company: any) => {
  selectedCompanyId.value = company.id;
};

// 保存默认公司
const saveDefaultCompany = async () => {
  if (!selectedCompanyId.value) {
    uni.showToast({
      title: '请选择公司',
      icon: 'none',
    });
    return;
  }

  try {
    await setDefaultDisplayCompanyId(selectedCompanyId.value);
    uni.showToast({
      title: '设置成功',
      icon: 'success',
    });
    
    // 更新显示的默认公司
    const company = companies.value.find((c: any) => c.id === selectedCompanyId.value);
    if (company) {
      defaultCompany.value = company;
    }
    
    showCompanyPicker.value = false;
  } catch (error: any) {
    uni.showToast({
      title: error.message || '设置失败',
      icon: 'none',
    });
  }
};

onMounted(() => {
  loadDefaultCompany();
  loadCompanies();
});
</script>

<style scoped>
.config-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
}

.config-section {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 30rpx;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.config-label {
  font-size: 28rpx;
  color: #666666;
}

.company-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
}

.company-name {
  font-size: 28rpx;
  color: #333333;
  font-weight: bold;
}

.change-btn {
  padding: 10rpx 20rpx;
  background: #667eea;
  color: #ffffff;
  border-radius: 8rpx;
  font-size: 26rpx;
  border: none;
}

.no-company {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
}

.no-company-text {
  font-size: 28rpx;
  color: #999999;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 90%;
  max-width: 600rpx;
  max-height: 80vh;
  background: #ffffff;
  border-radius: 16rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 30rpx;
  border-bottom: 1rpx solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
}

.modal-close {
  font-size: 48rpx;
  color: #999999;
  line-height: 1;
}

.modal-body {
  flex: 1;
  padding: 30rpx;
  overflow-y: auto;
}

.company-list {
  max-height: 400rpx;
}

.company-item {
  padding: 20rpx;
  border-bottom: 1rpx solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.company-item.active {
  background: #f0f7ff;
}

.company-item .company-name {
  font-size: 28rpx;
  color: #333333;
}

.check-icon {
  font-size: 32rpx;
  color: #667eea;
  font-weight: bold;
}

.empty-companies {
  padding: 40rpx;
  text-align: center;
  color: #999999;
  font-size: 28rpx;
}

.modal-footer {
  padding: 30rpx;
  border-top: 1rpx solid #e0e0e0;
  display: flex;
  gap: 20rpx;
}

.modal-btn {
  flex: 1;
  padding: 20rpx;
  background: #667eea;
  color: #ffffff;
  border-radius: 8rpx;
  font-size: 28rpx;
  border: none;
}

.modal-btn.cancel {
  background: #f0f0f0;
  color: #666666;
}
</style>
