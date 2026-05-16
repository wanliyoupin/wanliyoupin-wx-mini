<template>
  <view class="order-list-page">
    <!-- 统一导航栏（带返回） -->
    <PageNavBar title="我的订单" :show-back="true" @back="goBack" />

    <!-- 静默登录未完成 -->
    <view v-if="!userInfo?.id" class="need-login">
      <text class="need-login-text">正在初始化…</text>
    </view>

    <!-- 已登录（含微信访客 wx_guest_user）：可查看本人订单；正式用户可结合公司权限看价 -->
    <template v-else>
      <!-- 订单状态 + 支付状态筛选 -->
      <view class="header-bar">
        <view class="filter-row">
          <text class="filter-label">订单状态</text>
          <view class="filter-tabs">
            <view
              class="tab-item"
              :class="{ active: orderStatusFilter === '' }"
              @click="orderStatusFilter = ''"
            >
              全部
            </view>
            <view
              class="tab-item"
              :class="{ active: orderStatusFilter === 'pending' }"
              @click="orderStatusFilter = 'pending'"
            >
              待确认
            </view>
            <view
              class="tab-item"
              :class="{ active: orderStatusFilter === 'confirmed' }"
              @click="orderStatusFilter = 'confirmed'"
            >
              已确认
            </view>
            <view
              class="tab-item"
              :class="{ active: orderStatusFilter === 'completed' }"
              @click="orderStatusFilter = 'completed'"
            >
              已完成
            </view>
          </view>
        </view>
        <!-- 已完成时不展示支付状态筛选（已完成即已支付） -->
        <view v-if="orderStatusFilter !== 'completed'" class="filter-row">
          <text class="filter-label">支付状态</text>
          <view class="filter-tabs">
            <view
              class="tab-item"
              :class="{ active: paymentStatusFilter === '' }"
              @click="paymentStatusFilter = ''"
            >
              全部
            </view>
            <view
              class="tab-item"
              :class="{ active: paymentStatusFilter === 'pending' }"
              @click="paymentStatusFilter = 'pending'"
            >
              待支付
            </view>
            <view
              class="tab-item"
              :class="{ active: paymentStatusFilter === 'approved' }"
              @click="paymentStatusFilter = 'approved'"
            >
              已支付
            </view>
          </view>
        </view>
      </view>

      <!-- 骨架屏（首屏加载） -->
      <view v-if="loading && orders.length === 0" class="skeleton-area">
        <SkeletonScreen type="list-row" :count="4" />
      </view>

      <!-- 订单列表 -->
      <scroll-view
        v-else
        scroll-y
        class="order-scroll"
        @scrolltolower="loadMore"
        refresher-enabled
        :refresher-triggered="isRefreshing"
        @refresherrefresh="onRefresh"
      >
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

          <view class="order-company" v-if="order.company">
            <text class="company-label">公司:</text>
            <text class="company-name">{{ order.company.name }}</text>
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
              <view v-else class="item-image item-image-placeholder"></view>
              <view class="item-info">
                <text class="item-name">{{ item.product_name || '商品' }}</text>
                <text class="item-quantity">×{{ item.quantity }}</text>
                <text v-if="item.remark" class="item-remark">备注: {{ item.remark }}</text>
              </view>
              <text v-if="orderCanViewPrice(order)" class="item-price">¥{{ itemUnitPrice(order, item) }}</text>
              <text v-else class="item-price item-price-hidden">--</text>
            </view>
          </view>

          <view class="order-footer">
            <view class="order-totals">
              <view class="order-total-row">
                <text class="total-label">总金额:</text>
                <text v-if="orderCanViewPrice(order)" class="total-price">¥{{ formatMoney(order.total_amount) }}</text>
                <text v-else class="total-price total-price-hidden">--</text>
              </view>
              <view class="order-total-row">
                <text class="total-label">实付金额:</text>
                <text v-if="orderCanViewPrice(order)" class="total-price">¥{{ order.actual_amount != null ? formatMoney(order.actual_amount) : '--' }}</text>
                <text v-else class="total-price total-price-hidden">--</text>
              </view>
            </view>
            <view class="order-footer-right">
              <text class="order-delete" @click.stop="confirmDeleteOrder(order)">删除</text>
              <text class="order-arrow">›</text>
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <view v-if="orders.length === 0 && !loading" class="empty-state">
          <text class="empty-text">暂无订单</text>
        </view>

        <!-- 加载更多中 -->
        <view v-if="loading && orders.length > 0" class="loading-state">
          <text>加载中...</text>
        </view>
        <view v-else-if="orders.length > 0 && !hasMore" class="no-more">
          <text>没有更多了</text>
        </view>
      </scroll-view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { whenAppReady } from '@/utils/appReady';
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { userInfo, companyInfo } from '@/store/userStore';
import { getMyOrderList, softDeleteMyOrder } from '@/api/order/index';
import { getCompanyUserRoleCached } from '@/utils/auth';
import { safeNavigateBack } from '@/utils/navigation';
import PageNavBar from '@/components/PageNavBar.vue';
import SkeletonScreen from '@/components/SkeletonScreen.vue';

const orders = ref<any[]>([]);
/** 按订单所属公司解析能否看价（多公司时不能用单一全局标记） */
const canViewPriceByCompanyId = ref<Record<number, boolean>>({});
const loading = ref(false);
const isRefreshing = ref(false);
const searchKeyword = ref('');
const orderStatusFilter = ref('');
const paymentStatusFilter = ref('');
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
/** 全量刷新并发时只采纳最后一次结果，避免先返回的旧列表覆盖新数据 */
let listRefreshSerial = 0;

function parsePositiveCompanyId(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

/** 订单所属公司：优先接口字段；仅当订单上完全未带回公司信息时用当前上下文（避免嵌套 company 被权限裁掉时整页无看价） */
function getOrderCompanyId(order: any): number | null {
  const fromOrder = parsePositiveCompanyId(order?.company?.id ?? order?.company_companies);
  if (fromOrder != null) return fromOrder;
  const noCompanyOnRow =
    order?.company == null &&
    (order?.company_companies === undefined ||
      order?.company_companies === null ||
      order?.company_companies === '');
  if (noCompanyOnRow) {
    return parsePositiveCompanyId(companyInfo.value?.id);
  }
  return null;
}

function orderCanViewPrice(order: any): boolean {
  const cid = getOrderCompanyId(order);
  if (cid == null) return false;
  return canViewPriceByCompanyId.value[cid] ?? false;
}

function formatMoney(v: unknown): string {
  return Number(v ?? 0).toFixed(2);
}

/** 订单行单价：库内 product_price 为 SKU 原价，展示需乘订单 price_factor（与下单页一致） */
function itemUnitPrice(order: any, item: any): string {
  const pf = Number(order?.price_factor ?? 1);
  const base = Number(item?.product_price ?? 0);
  return formatMoney(base * (Number.isFinite(pf) && pf > 0 ? pf : 1));
}

function extractCompanyIdsFromOrders(list: any[]): number[] {
  const ids = new Set<number>();
  for (const o of list) {
    const cid = getOrderCompanyId(o);
    if (cid != null) ids.add(cid);
  }
  return [...ids];
}

async function hydrateCanViewPriceMapForCompanies(companyIds: number[]) {
  const uniq = [...new Set(companyIds.filter((id) => id > 0))];
  if (uniq.length === 0) return;
  const next = { ...canViewPriceByCompanyId.value };
  for (const cid of uniq) {
    if (next[cid] !== undefined) continue;
    let can = false;
    try {
      const r = await getCompanyUserRoleCached(cid, false);
      can = r?.canViewPrice ?? false;
    } catch {
      try {
        const r = await getCompanyUserRoleCached(cid, true);
        can = r?.canViewPrice ?? false;
      } catch {
        can = false;
      }
    }
    next[cid] = can;
  }
  canViewPriceByCompanyId.value = next;
}

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

function formatTime(time: string) {
  if (!time) return '';
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

async function loadOrders(reset = false) {
  // 全量刷新（onShow / 筛选 / 下拉）必须与进行中的分页请求解耦，否则 loading为 true 时会直接 return，刚下单进来看不到新单
  if (!reset) {
    if (loading.value || !hasMore.value) return;
  }

  const userId = userInfo.value?.id;
  if (!userId) {
    if (reset) orders.value = [];
    return;
  }

  if (reset) {
    page.value = 1;
    hasMore.value = true;
    canViewPriceByCompanyId.value = {};
  }

  const refreshToken = reset ? ++listRefreshSerial : 0;

  loading.value = true;
  if (reset) isRefreshing.value = true;

  try {
    const result = await getMyOrderList({
      userId: Number(userId),
      orderStatus: orderStatusFilter.value || undefined,
      paymentStatus: paymentStatusFilter.value || undefined,
      keyword: searchKeyword.value.trim() || undefined,
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
    });

    const chunk = result.orders || [];
    if (reset) {
      if (refreshToken !== listRefreshSerial) return;
      orders.value = [...chunk];
    } else {
      orders.value = [...orders.value, ...chunk];
    }

    await hydrateCanViewPriceMapForCompanies(extractCompanyIdsFromOrders(chunk));

    if (reset && refreshToken !== listRefreshSerial) return;
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
}

function goBack() {
  safeNavigateBack();
}

function goToOrderDetail(orderId: number) {
  uni.navigateTo({
    url: `/pages/order-detail/index?id=${orderId}`,
  });
}

function confirmDeleteOrder(order: any) {
  const uid = userInfo.value?.id;
  if (uid == null || order?.id == null) return;
  uni.showModal({
    title: '删除订单',
    content: '删除后仅在您的订单列表中隐藏，不影响商家处理',
    confirmColor: '#ee6666',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await softDeleteMyOrder(Number(order.id), Number(uid));
        uni.showToast({ title: '已删除', icon: 'success' });
        orders.value = orders.value.filter((o: any) => o.id !== order.id);
      } catch (e: any) {
        uni.showToast({ title: e?.message || '删除失败', icon: 'none' });
      }
    },
  });
}

function loadMore() {
  loadOrders();
}

function onRefresh() {
  loadOrders(true);
}

function onSearch() {
  loadOrders(true);
}

watch(orderStatusFilter, (v) => {
  if (v === 'completed') paymentStatusFilter.value = '';
  loadOrders(true);
});
watch(paymentStatusFilter, () => {
  loadOrders(true);
});

onShow(async () => {
  await whenAppReady();
  if (userInfo.value?.id) {
    await loadOrders(true);
  } else {
    canViewPriceByCompanyId.value = {};
    orders.value = [];
  }
});

onPullDownRefresh(() => {
  loadOrders(true);
});

onReachBottom(() => {
  loadMore();
});
</script>

<style scoped>
.order-list-page {
  height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.need-login {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
  gap: 32rpx;
}

.need-login-text {
  font-size: 30rpx;
  color: #999;
  text-align: center;
  line-height: 1.5;
}

.login-btn {
  width: 320rpx;
  height: 72rpx;
  line-height: 72rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 36rpx;
  font-size: 28rpx;
  border: none;
}

.login-btn::after {
  border: none;
}

.login-btn--secondary {
  background: #fff;
  color: #667eea;
  border: 2rpx solid #667eea;
}

.header-bar {
  background: #fff;
  padding: 20rpx 30rpx;
  border-bottom: 1rpx solid #e0e0e0;
  flex-shrink: 0;
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

.filter-tabs {
  flex-wrap: wrap;
}

.filter-tabs {
  display: flex;
  gap: 20rpx;
}

.tab-item {
  padding: 10rpx 20rpx;
  font-size: 28rpx;
  color: #666;
  border-radius: 8rpx;
}

.tab-item.active {
  background: #667eea;
  color: #fff;
}

.skeleton-area {
  flex: 1;
  min-height: 400rpx;
}

.order-scroll {
  flex: 1;
  min-height: 0;
}

.order-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 20rpx;
  margin-bottom: 0;
}

.order-item:last-of-type {
  margin-bottom: 20rpx;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #eee;
}

.order-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.order-id {
  font-size: 26rpx;
  color: #666;
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

.order-time {
  font-size: 24rpx;
  color: #999;
}

.order-company {
  margin-bottom: 16rpx;
  font-size: 26rpx;
  color: #666;
}

.company-label {
  color: #999;
}

.company-name {
  color: #333;
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

.item-image,
.item-image-placeholder {
  width: 80rpx;
  height: 80rpx;
  border-radius: 8rpx;
  background: #f0f0f0;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.item-name {
  font-size: 26rpx;
  color: #333;
}

.item-quantity {
  font-size: 24rpx;
  color: #666;
}

.item-remark {
  font-size: 22rpx;
  color: #999;
  display: block;
}

.item-price {
  font-size: 26rpx;
  color: #ff6b6b;
  font-weight: bold;
  flex-shrink: 0;
}

.item-price-hidden {
  color: #999;
  font-weight: normal;
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16rpx;
  border-top: 1rpx solid #eee;
}

.order-footer-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.order-delete {
  font-size: 26rpx;
  color: #999;
  padding: 8rpx 12rpx;
}

.order-totals {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.order-total-row {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.order-total {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.total-label {
  font-size: 26rpx;
  color: #666;
}

.total-price {
  font-size: 32rpx;
  color: #ff6b6b;
  font-weight: bold;
}

.total-price-hidden {
  color: #999;
  font-weight: normal;
}

.order-arrow {
  font-size: 36rpx;
  color: #999;
}

.empty-state {
  padding: 100rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.loading-state,
.no-more {
  padding: 40rpx 0;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}
</style>
