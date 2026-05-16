<template>
  <view class="order-list-page">
    <!-- 筛选区固定顶部：搜索 + 订单/支付状态 -->
    <view class="header-bar header-bar-fixed">
      <view class="search-row">
        <input :adjust-position="false"
          class="search-input"
          v-model="searchKeyword"
          placeholder="订单号 / 收货人 / 用户手机号"
          placeholder-class="search-placeholder"
          confirm-type="search"
          @confirm="onSearch"
        />
        <button class="search-btn" type="button" @click="onSearch">搜索</button>
      </view>
      <view class="filter-row">
        <text class="filter-label">订单状态</text>
        <view class="filter-tabs">
          <view class="tab-item" :class="{ active: orderStatusFilter === '' }" @click="orderStatusFilter = ''">全部</view>
          <view class="tab-item" :class="{ active: orderStatusFilter === 'pending' }" @click="orderStatusFilter = 'pending'">待确认</view>
          <view class="tab-item" :class="{ active: orderStatusFilter === 'confirmed' }" @click="orderStatusFilter = 'confirmed'">已确认</view>
          <view class="tab-item" :class="{ active: orderStatusFilter === 'completed' }" @click="orderStatusFilter = 'completed'">已完成</view>
        </view>
      </view>
      <!-- 已完成时不展示支付状态筛选 -->
      <view v-if="orderStatusFilter !== 'completed'" class="filter-row">
        <text class="filter-label">支付状态</text>
        <view class="filter-tabs">
          <view class="tab-item" :class="{ active: paymentStatusFilter === '' }" @click="paymentStatusFilter = ''">全部</view>
          <view class="tab-item" :class="{ active: paymentStatusFilter === 'pending' }" @click="paymentStatusFilter = 'pending'">待支付</view>
          <view class="tab-item" :class="{ active: paymentStatusFilter === 'approved' }" @click="paymentStatusFilter = 'approved'">已支付</view>
        </view>
      </view>
    </view>
    <!-- 占位高度与固定筛选区一致：搜索行 + 单行(已完成)约 224rpx，双行约 324rpx -->
    <view
      class="header-bar-spacer"
      :style="{ height: orderStatusFilter === 'completed' ? '224rpx' : '324rpx' }"
    ></view>

    <!-- 订单列表（占满剩余空间并内部滚动） -->
    <scroll-view
      scroll-y
      class="order-list-scroll"
      @scrolltolower="loadMore"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="() => loadOrders(true)"
    >
      <view class="order-list">
      <view 
        v-for="order in orders" 
        :key="order.id"
        class="order-item"
        @click="goToOrderDetail(order.id)"
      >
        <view class="order-header">
          <view class="order-info">
            <text class="order-id">订单号: {{ order.id }}</text>
            <text class="order-status" :class="statusClass(order)">
              {{ orderStatusText(order.order_status) }} / {{ paymentStatusText(order.payment_status) }}
            </text>
          </view>
          <text class="order-time">{{ formatTime(order.created_at) }}</text>
        </view>

        <view class="order-user">
          <text class="user-label">用户:</text>
          <text class="user-name">{{ order.user?.nickname || order.user?.mobile || '--' }}</text>
        </view>

        <view class="order-items" v-if="order.order_items && order.order_items.length > 0">
          <view
            v-for="item in order.order_items"
            :key="item.id"
            class="order-item-row"
          >
            <image
              v-if="item.product_image_url"
              :src="item.product_image_url"
              class="item-image"
              mode="aspectFill"
            />
            <view class="item-info">
              <text class="item-name">{{ item.product_name || '商品' }}</text>
              <text class="item-quantity">x{{ item.quantity }}</text>
              <text v-if="item.remark" class="item-remark">备注: {{ item.remark }}</text>
            </view>
            <text class="item-price">¥{{ item.product_price }}</text>
          </view>
        </view>
        <view class="order-items-placeholder" v-else>
          <text>（暂无法显示商品详情）</text>
        </view>

        <view class="order-footer">
          <view class="order-total-wrap">
            <view class="order-total">
              <text class="total-label">总价:</text>
              <text class="total-price">¥{{ order.total_price }}</text>
            </view>
            <view class="order-total">
              <text class="total-label">总金额:</text>
              <text class="total-price">¥{{ order.total_amount }}</text>
            </view>
            <view v-if="order.actual_amount != null" class="order-actual">
              <text class="actual-label">实收:</text>
              <text class="actual-value">¥{{ order.actual_amount }}</text>
            </view>
          </view>
          <view class="order-actions">
            <button
              v-if="order.order_status !== 'completed' && !isViewOnly"
              class="action-btn edit-actual"
              @click.stop="openEditActualModal(order)"
            >
              修改实收
            </button>
            <button
              v-if="order.order_status === 'pending' && !isViewOnly"
              class="action-btn confirm"
              @click.stop="confirmOrder(order)"
            >
              确认订单
            </button>
            <button
              v-if="order.payment_status === 'pending' && !isViewOnly"
              class="action-btn approve"
              @click.stop="approvePayment(order)"
            >
              确认收款
            </button>
            <button
              v-if="order.payment_status === 'approved' && order.order_status === 'confirmed' && !isViewOnly"
              class="action-btn archive"
              @click.stop="archiveOrder(order)"
            >
              归档
            </button>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="orders.length === 0 && !loading" class="empty-state">
        <text class="empty-text">暂无订单</text>
      </view>

      <!-- 加载中 -->
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>
      </view>
    </scroll-view>

    <!-- 确认收款弹窗（填写实收金额） -->
    <view v-if="showApproveModal" class="edit-actual-mask" @click.stop="closeApproveModal">
      <view class="edit-actual-modal" @click.stop>
        <view class="edit-actual-title">确认收款</view>
        <view class="edit-actual-row">
          <text class="edit-actual-label">订单号</text>
          <text class="edit-actual-value">{{ approvingOrder?.id }}</text>
        </view>
        <view class="edit-actual-row">
          <text class="edit-actual-label">订单金额</text>
          <text class="edit-actual-value">¥{{ approvingOrder?.total_amount ?? '--' }}</text>
        </view>
        <view class="edit-actual-row">
          <text class="edit-actual-label">实际收款金额</text>
          <input :adjust-position="false"
            class="edit-actual-input"
            type="digit"
            placeholder="请输入实际收款金额"
            :value="approveActualAmount"
            @input="onApproveActualAmountInput"
          />
        </view>
        <view class="edit-actual-btns">
          <button class="edit-actual-btn cancel" @click="closeApproveModal">取消</button>
          <button class="edit-actual-btn confirm" :disabled="!approveAmountValid" @click="submitApprovePayment">确定</button>
        </view>
      </view>
    </view>

    <!-- 修改实际收款金额弹窗 -->
    <view v-if="showEditActualModal" class="edit-actual-mask" @click.stop="closeEditActualModal">
      <view class="edit-actual-modal" @click.stop>
        <view class="edit-actual-title">修改实际收款金额</view>
        <view class="edit-actual-row">
          <text class="edit-actual-label">订单号</text>
          <text class="edit-actual-value">{{ editingOrderForActual?.id }}</text>
        </view>
        <view class="edit-actual-row">
          <text class="edit-actual-label">订单金额</text>
          <text class="edit-actual-value">¥{{ editingOrderForActual?.total_amount ?? '--' }}</text>
        </view>
        <view class="edit-actual-row">
          <text class="edit-actual-label">实际收款金额</text>
          <input :adjust-position="false"
            class="edit-actual-input"
            type="digit"
            placeholder="请输入实际收款金额"
            :value="editActualAmount"
            @input="onEditActualAmountInput"
          />
        </view>
        <view class="edit-actual-btns">
          <button class="edit-actual-btn cancel" @click="closeEditActualModal">取消</button>
          <button class="edit-actual-btn confirm" :disabled="!editActualAmountValid" @click="submitEditActualAmount">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app';
import { companyInfo } from '@/store/userStore';
import { getOrderList, confirmOrder as apiConfirmOrder, approvePayment as apiApprovePayment, completeOrder as apiCompleteOrder, updateOrderActualAmount } from '@/subPackages/company/api/order';

const orders = ref<any[]>([]);
const loading = ref(false);
const isRefreshing = ref(false);
const searchKeyword = ref('');
const orderStatusFilter = ref('');
const paymentStatusFilter = ref('');
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);

// 当前查看的公司 ID（公司管理员用 companyInfo，超级管理员从 query 传入）
const viewCompanyId = ref<number | null>(null);

// 实际使用的公司 ID
const effectiveCompanyId = () => viewCompanyId.value ?? companyInfo.value?.id ?? null;

/** 核查入口只读：不显示确认订单等操作 */
const isViewOnly = computed(() => !!viewCompanyId.value);

const showEditActualModal = ref(false);
const editingOrderForActual = ref<any>(null);
const editActualAmount = ref('');
const editActualAmountValid = computed(() => {
  const v = parseFloat(editActualAmount.value);
  return !Number.isNaN(v) && v >= 0;
});

function orderStatusText(s: string) {
  if (s === 'pending') return '待确认';
  if (s === 'confirmed') return '已确认';
  if (s === 'completed') return '已完成';
  return s || '--';
}
function paymentStatusText(s: string) {
  if (s === 'pending') return '待支付';
  if (s === 'approved') return '已支付';
  return s || '--';
}
function statusClass(order: any) {
  const o = order?.order_status;
  const p = order?.payment_status;
  if (o === 'completed' || p === 'approved') return 'status-done';
  if (o === 'pending') return 'status-pending';
  return 'status-confirmed';
}

// 格式化时间
const formatTime = (time: string) => {
  if (!time) return '';
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
};

// 加载订单列表
const loadOrders = async (reset = false) => {
  if (loading.value || (!hasMore.value && !reset)) {
    return;
  }

  if (reset) {
    page.value = 1;
    hasMore.value = true;
  }

  const companyId = effectiveCompanyId();
  if (!companyId) {
    uni.showToast({
      title: '公司信息不存在',
      icon: 'none',
    });
    return;
  }

  loading.value = true;
  if (reset) isRefreshing.value = true;

  try {
    const result = await getOrderList({
      companyId,
      orderStatus: orderStatusFilter.value || undefined,
      paymentStatus: paymentStatusFilter.value || undefined,
      keyword: searchKeyword.value.trim() || undefined,
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
    });

    if (reset) {
      orders.value = [];
    }

    orders.value = [...orders.value, ...(result.orders || [])];

    if (result.total <= orders.value.length) {
      hasMore.value = false;
    } else {
      page.value++;
    }
  } catch (error: any) {
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
    isRefreshing.value = false;
    uni.stopPullDownRefresh();
  }
};

function loadMore() {
  if (!loading.value && hasMore.value) loadOrders(false);
}

function openEditActualModal(order: any) {
  editingOrderForActual.value = order;
  editActualAmount.value = order?.actual_amount != null ? String(order.actual_amount) : (order?.total_amount != null ? String(order.total_amount) : '');
  showEditActualModal.value = true;
}

function closeEditActualModal() {
  showEditActualModal.value = false;
  editingOrderForActual.value = null;
  editActualAmount.value = '';
}

function onEditActualAmountInput(e: any) {
  const val = (e.detail?.value ?? '') as string;
  const filtered = val.replace(/[^\d.]/g, '').replace(/^(\d*\.)(\d*)\./g, '$1$2');
  editActualAmount.value = filtered;
}

async function submitEditActualAmount() {
  const order = editingOrderForActual.value;
  if (!order?.id) return;
  const v = parseFloat(editActualAmount.value);
  if (Number.isNaN(v) || v < 0) {
    uni.showToast({ title: '请输入有效金额', icon: 'none' });
    return;
  }
  try {
    await updateOrderActualAmount(Number(order.id), v);
    uni.showToast({ title: '已更新', icon: 'success' });
    closeEditActualModal();
    loadOrders(true);
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' });
  }
}

function onSearch() {
  loadOrders(true);
}

// 确认订单
const confirmOrder = async (order: any) => {
  uni.showModal({
    title: '确认订单',
    content: '确定要确认该订单（可发货）吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const orderId = Number(order.id);
          if (!orderId || Number.isNaN(orderId)) {
            uni.showToast({ title: '订单 ID 无效', icon: 'none' });
            return;
          }
          await apiConfirmOrder(orderId);
          uni.showToast({ title: '订单已确认', icon: 'success' });
          loadOrders(true);
        } catch (error: any) {
          const msg = error?.message || error?.error || (error?.errors && error.errors[0]?.message) || '操作失败';
          uni.showToast({ title: String(msg), icon: 'none' });
        }
      }
    },
  });
};

const showApproveModal = ref(false);
const approvingOrder = ref<any>(null);
const approveActualAmount = ref('');
const approveAmountValid = computed(() => {
  const v = parseFloat(approveActualAmount.value);
  return !Number.isNaN(v) && v >= 0;
});

function openApproveModal(order: any) {
  approvingOrder.value = order;
  approveActualAmount.value = order?.total_amount != null ? String(order.total_amount) : '';
  showApproveModal.value = true;
}

function closeApproveModal() {
  showApproveModal.value = false;
  approvingOrder.value = null;
  approveActualAmount.value = '';
}

function onApproveActualAmountInput(e: any) {
  const val = (e.detail?.value ?? '') as string;
  const filtered = val.replace(/[^\d.]/g, '').replace(/^(\d*\.)(\d*)\./g, '$1$2');
  approveActualAmount.value = filtered;
}

async function submitApprovePayment() {
  const order = approvingOrder.value;
  if (!order?.id) return;
  const v = parseFloat(approveActualAmount.value);
  if (Number.isNaN(v) || v < 0) {
    uni.showToast({ title: '请输入有效金额', icon: 'none' });
    return;
  }
  try {
    await apiApprovePayment(Number(order.id), false, v);
    uni.showToast({ title: '已确认收款', icon: 'success' });
    closeApproveModal();
    loadOrders(true);
  } catch (error: any) {
    const msg = error?.message || error?.error || (error?.errors && error.errors[0]?.message) || '操作失败';
    uni.showToast({ title: String(msg), icon: 'none' });
  }
}

// 确认收款（打开弹窗填写实收金额后提交）
function approvePayment(order: any) {
  openApproveModal(order);
}

// 归档（订单状态 -> 已完成，仅已确认且已支付时显示）
const archiveOrder = async (order: any) => {
  uni.showModal({
    title: '归档订单',
    content: '确定将该订单归档为已完成吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const orderId = Number(order.id);
          if (!orderId || Number.isNaN(orderId)) {
            uni.showToast({ title: '订单 ID 无效', icon: 'none' });
            return;
          }
          await apiCompleteOrder(orderId);
          uni.showToast({ title: '已归档', icon: 'success' });
          loadOrders(true);
        } catch (error: any) {
          const msg = error?.message || error?.error || (error?.errors && error.errors[0]?.message) || '操作失败';
          uni.showToast({ title: String(msg), icon: 'none' });
        }
      }
    },
  });
};

// 跳转到订单详情（公司端无独立详情页，使用主包订单详情页）
const goToOrderDetail = (orderId: number) => {
  uni.navigateTo({
    url: `/pages/order-detail/index?id=${orderId}`,
  });
};

watch(orderStatusFilter, (v) => {
  if (v === 'completed') paymentStatusFilter.value = '';
  loadOrders(true);
});
watch(paymentStatusFilter, () => {
  loadOrders(true);
});

// 支持从 query 传入 companyId（超级管理员从公司管理点进来）
import { onLoad } from '@dcloudio/uni-app';
onLoad((options?: { companyId?: string }) => {
  if (options?.companyId) {
    viewCompanyId.value = Number(options.companyId);
  }
});

onShow(() => {
  loadOrders(true);
});

onPullDownRefresh(() => {
  loadOrders(true);
});

onReachBottom(() => {
  loadOrders();
});
</script>

<style scoped>
.order-list-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  overflow: hidden;
}

/* 仅列表区域滚动，占满剩余高度 */
.order-list-scroll {
  flex: 1;
  min-height: 0;
}

.header-bar {
  background: #ffffff;
  padding: 20rpx 30rpx;
  border-bottom: 1rpx solid #e0e0e0;
}
.header-bar-fixed {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.search-input {
  flex: 1;
  height: 64rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  background: #f5f5f5;
  border-radius: 32rpx;
}
.search-placeholder {
  color: #999;
}
.search-btn {
  flex-shrink: 0;
  height: 64rpx;
  padding: 0 28rpx;
  line-height: 64rpx;
  font-size: 28rpx;
  color: #fff;
  background: #667eea;
  border-radius: 32rpx;
  border: none;
}
.search-btn::after {
  border: none;
}

/* 与固定筛选区同高，避免列表被遮挡 */
.header-bar-spacer {
  flex-shrink: 0;
}

.view-only-tip {
  display: block;
  font-size: 26rpx;
  color: #999;
  margin-bottom: 12rpx;
}

.filter-row {
  margin-bottom: 16rpx;
}
.filter-row:last-child {
  margin-bottom: 0;
}
.filter-label {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 8rpx;
  display: block;
}
.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.tab-item {
  padding: 10rpx 20rpx;
  font-size: 28rpx;
  color: #666666;
  border-radius: 8rpx;
  transition: all 0.3s;
}

.tab-item.active {
  background: #667eea;
  color: #ffffff;
}

.order-list {
  padding: 20rpx;
  padding-bottom: 40rpx;
}

.order-item {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #e0e0e0;
}

.order-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.order-id {
  font-size: 26rpx;
  color: #666666;
}

.order-status {
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  font-size: 24rpx;
}

.status-pending {
  background: #fff7e6;
  color: #fa8c16;
}

.status-confirmed {
  background: #e6f7ff;
  color: #1890ff;
}
.status-done {
  background: #f6ffed;
  color: #52c41a;
}

.order-time {
  font-size: 24rpx;
  color: #999999;
}

.order-user {
  margin-bottom: 16rpx;
  font-size: 26rpx;
  color: #666666;
}

.user-label {
  color: #999999;
}

.user-name {
  color: #333333;
  margin-left: 8rpx;
}

.order-items {
  margin-bottom: 16rpx;
}

.order-item-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.order-item-row:last-child {
  border-bottom: none;
}

.item-image {
  width: 80rpx;
  height: 80rpx;
  border-radius: 8rpx;
  background: #f0f0f0;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.item-name {
  font-size: 26rpx;
  color: #333333;
}

.item-spec {
  font-size: 24rpx;
  color: #999999;
}

.item-quantity {
  font-size: 24rpx;
  color: #666666;
}

.item-price {
  font-size: 26rpx;
  color: #ff6b6b;
  font-weight: bold;
}

.order-items-placeholder {
  padding: 20rpx;
  text-align: center;
  color: #999;
  font-size: 24rpx;
  background: #f9f9f9;
  border-radius: 8rpx;
  margin-bottom: 16rpx;
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16rpx;
  border-top: 1rpx solid #e0e0e0;
  flex-wrap: wrap;
  gap: 12rpx;
}

.order-total-wrap {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.order-total {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.order-actual {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.actual-label {
  font-size: 24rpx;
  color: #999;
}

.actual-value {
  font-size: 26rpx;
  color: #52c41a;
  font-weight: 500;
}

.total-label {
  font-size: 26rpx;
  color: #666666;
}

.total-price {
  font-size: 32rpx;
  color: #ff6b6b;
  font-weight: bold;
}

.order-actions {
  display: flex;
  gap: 10rpx;
}

.action-btn {
  padding: 10rpx 20rpx;
  background: #667eea;
  color: #ffffff;
  border-radius: 8rpx;
  font-size: 24rpx;
  border: none;
}

.item-remark {
  font-size: 22rpx;
  color: #999;
  display: block;
}
.action-btn.confirm {
  background: #52c41a;
}
.action-btn.approve {
  background: #1890ff;
}
.action-btn.archive {
  background: #52c41a;
}

.action-btn.edit-actual {
  background: #8c8c8c;
}

.empty-state {
  padding: 100rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: #999999;
}

.loading-state {
  padding: 40rpx 0;
  text-align: center;
  color: #999999;
  font-size: 28rpx;
}

.edit-actual-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}

.edit-actual-modal {
  width: 100%;
  max-width: 560rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
}

.edit-actual-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 32rpx;
  text-align: center;
}

.edit-actual-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.edit-actual-label {
  font-size: 28rpx;
  color: #6b7280;
}

.edit-actual-value {
  font-size: 30rpx;
  font-weight: 500;
  color: #1f2937;
}

.edit-actual-input {
  flex: 1;
  margin-left: 24rpx;
  height: 72rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  text-align: right;
}

.edit-actual-btns {
  display: flex;
  gap: 24rpx;
  margin-top: 40rpx;
}

.edit-actual-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
  border-radius: 16rpx;
  border: none;
}

.edit-actual-btn::after {
  border: none;
}

.edit-actual-btn.cancel {
  background: #f3f4f6;
  color: #6b7280;
}

.edit-actual-btn.confirm {
  background: #1890ff;
  color: #fff;
}

.edit-actual-btn.confirm[disabled] {
  opacity: 0.6;
}
</style>
