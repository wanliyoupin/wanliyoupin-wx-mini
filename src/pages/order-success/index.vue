<template>
  <view class="order-success-page">
    <view class="success-icon-wrap">
      <view class="success-icon">✓</view>
    </view>
    <view class="success-title">订单提交成功</view>
    <view class="success-desc">请联系公司完成付款</view>

    <view v-if="orderId" class="order-info-card">
      <view class="info-row">
        <text class="info-label">订单号</text>
        <text class="info-value">{{ orderId }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">订单金额</text>
        <text v-if="loadingAmount" class="info-value amount placeholder">加载中...</text>
        <text v-else-if="canViewPrice" class="info-value amount">¥{{ orderAmount }}</text>
        <text v-else class="info-value amount amount-hidden">--</text>
      </view>
    </view>

    <!-- 公司联系微信（存在时展示） -->
    <view v-if="companyWechatCode" class="wechat-card">
      <view class="wechat-title">联系公司付款</view>
      <view class="wechat-desc">添加公司微信沟通付款事宜</view>
      <image :src="companyWechatCode" class="wechat-qr" mode="aspectFit" />
    </view>

    <view class="share-hint" v-if="orderId">分享订单给管理员，对方打开后可直接查看订单详情</view>

    <view class="action-btns">
      <button class="btn primary" @click="goToOrderDetail">查看订单</button>
      <button class="btn share" open-type="share">分享订单给管理员</button>
      <button class="btn secondary" @click="goHome">返回首页</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { getOrderDetailById } from '@/api/order/index';
import { getCompanyUserRoleCached } from '@/utils/auth';

const orderId = ref<number | null>(null);
const orderAmount = ref<string>('');
const loadingAmount = ref(true);
const companyWechatCode = ref<string | null>(null);
const companyName = ref<string>('');
const canViewPrice = ref(false);

onLoad((options: any) => {
  if (options?.orderId) {
    orderId.value = Number(options.orderId);
  }
});

onMounted(async () => {
  getCompanyUserRoleCached().then((r) => {
    canViewPrice.value = r?.canViewPrice ?? false;
  });
  if (orderId.value) {
    loadingAmount.value = true;
    try {
      const order = await getOrderDetailById(orderId.value);
      if (order?.total_amount != null) {
        orderAmount.value = Number(order.total_amount).toFixed(2);
      } else {
        orderAmount.value = '0.00';
      }
      companyWechatCode.value = order?.company?.wechat_code || null;
      companyName.value = order?.company?.name || '';
    } catch (_) {
      orderAmount.value = '--';
    } finally {
      loadingAmount.value = false;
    }
  } else {
    loadingAmount.value = false;
  }
});

// 分享带 companyId，别人点开可进入对应公司（订单所属公司从订单详情取，此处用 storage 当前公司）
onShareAppMessage(() => {
  const cid = uni.getStorageSync('companyId') || '';
  const path = cid
    ? `/pages/order-detail/index?id=${orderId.value}&companyId=${cid}`
    : `/pages/order-detail/index?id=${orderId.value}`;
  return {
    title: orderId.value && companyName.value
      ? `订单 ${orderId.value} - ${companyName.value}（请处理）`
      : `订单 ${orderId.value} - 订单详情`,
    path,
  };
});

onShareTimeline(() => {
  const cid = uni.getStorageSync('companyId') || '';
  const query = cid ? `id=${orderId.value}&companyId=${cid}` : `id=${orderId.value}`;
  return {
    title: orderId.value && companyName.value
      ? `订单 ${orderId.value} - ${companyName.value}（请处理）`
      : `订单 ${orderId.value} - 订单详情`,
    query,
  };
});

function goToOrderDetail() {
  if (orderId.value) {
    uni.navigateTo({
      url: `/pages/order-detail/index?id=${orderId.value}`,
    });
  } else {
    uni.switchTab({ url: '/pages/mine/index' });
  }
}

function goHome() {
  uni.switchTab({ url: '/pages/index/index' });
}
</script>

<style scoped>
.order-success-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 80rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.success-icon-wrap {
  margin-bottom: 32rpx;
}

.success-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
  color: #fff;
  font-size: 72rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.success-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #333;
  margin-bottom: 16rpx;
}

.success-desc {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 48rpx;
}

.order-info-card {
  width: 100%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 48rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 28rpx;
  color: #666;
}

.info-value {
  font-size: 28rpx;
  color: #333;
}

.info-value.amount {
  font-size: 32rpx;
  font-weight: 600;
  color: #ff6b6b;
}

.info-value.amount.placeholder {
  color: #999;
  font-weight: normal;
}

.info-value.amount.amount-hidden {
  color: #999;
  font-weight: normal;
}

.wechat-card {
  width: 100%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
  text-align: center;
}

.wechat-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
}

.wechat-desc {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 24rpx;
}

.wechat-qr {
  width: 320rpx;
  height: 320rpx;
  display: block;
  margin: 0 auto;
}

.share-hint {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 24rpx;
  text-align: center;
  padding: 0 20rpx;
}

.action-btns {
  width: 100%;
  max-width: 600rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  border: none;
}

.btn.primary {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.btn.share {
  background: #fff;
  color: #667eea;
  border: 2rpx solid #667eea;
}

.btn.secondary {
  background: #fff;
  color: #666;
  border: 2rpx solid #e0e0e0;
}
</style>
