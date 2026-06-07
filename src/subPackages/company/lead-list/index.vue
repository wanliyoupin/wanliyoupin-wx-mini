<template>
  <view class="lead-list-page">
    <PageNavBar title="线索管理" :show-back="true" @back="goBack" />

    <view class="header-bar">
      <view class="search-row">
        <input
          :adjust-position="false"
          class="search-input"
          v-model="searchInput"
          placeholder="公司名 / 手机号"
          confirm-type="search"
          @confirm="onSearch"
        />
        <button class="search-btn" @click="onSearch">搜索</button>
      </view>
      <scroll-view scroll-x class="status-scroll" :show-scrollbar="false">
        <view class="status-tabs">
          <view
            v-for="opt in statusOptions"
            :key="opt.value"
            class="tab-item"
            :class="{ active: statusFilter === opt.value }"
            @click="setStatusFilter(opt.value)"
          >
            {{ opt.label }}
          </view>
        </view>
      </scroll-view>
      <view v-if="canCreate || canAccessLeads" class="toolbar">
        <button v-if="canCreate" class="create-btn" @click="goCreate">录入线索</button>
        <button v-if="canAccessLeads" class="export-btn" :disabled="exporting" @click="handleExport">
          {{ exporting ? '导出中…' : '导出表格' }}
        </button>
      </view>
    </view>

    <scroll-view
      scroll-y
      class="list-scroll"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMore"
    >
      <view v-for="item in leads" :key="item.id" class="lead-item" @click="goDetail(item.id)">
        <view class="lead-main">
          <text class="lead-name">{{ item.name }}</text>
          <text class="lead-status" :class="'st-' + item.status">{{ statusLabel(item.status) }}</text>
        </view>
        <view class="lead-sub">
          <text class="lead-phone">{{ item.phone }}</text>
          <text class="lead-time">{{ formatTime(item.updated_at || item.created_at) }}</text>
        </view>
        <view v-if="creatorText(item)" class="lead-assignee">
          录入人：{{ creatorText(item) }}
        </view>
        <view v-if="locationText(item)" class="lead-location">
          📍 {{ locationText(item) }}
        </view>
      </view>

      <view v-if="!loading && leads.length === 0" class="empty">
        <text>暂无线索</text>
      </view>
      <view v-if="loading" class="loading-tip">加载中…</view>
      <view v-else-if="leads.length > 0 && !hasMore" class="loading-tip">已显示全部</view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import PageNavBar from '@/components/PageNavBar.vue';
import { companyInfo, userInfo } from '@/store/userStore';
import { getCompanyUserRoleCached, isPlatformAdmin } from '@/utils/auth';
import { safeNavigateBack } from '@/utils/navigation';
import {
  fetchLeadList,
  fetchAllLeadsForExport,
  LEAD_STATUS_LABEL,
  type LeadRow,
} from '@/subPackages/company/api/lead';
import { exportLeadsToWanliExcel } from '@/subPackages/company/utils/exportLeadExcel';
import {
  formatLeadLocationText,
  parseLeadLocationFromMoreInfo,
} from '@/utils/leadLocation';

const leads = ref<LeadRow[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const hasMore = ref(true);
const refreshing = ref(false);

const statusFilter = ref('');
const searchInput = ref('');
const keyword = ref('');

const canAccessLeads = ref(false);
const canCreate = ref(false);
const exporting = ref(false);

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'new', label: '新建' },
  { value: 'lost', label: '失败' },
  { value: 'converted', label: '已转客户' },
];

function statusLabel(s: string) {
  return LEAD_STATUS_LABEL[s] ?? s;
}

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function creatorText(item: LeadRow) {
  const u = item.companyUserByCreatedByCompanyUsers?.user;
  return u?.nickname || u?.mobile || '';
}

function locationText(item: LeadRow) {
  return formatLeadLocationText(parseLeadLocationFromMoreInfo(item.more_info));
}

async function ensurePerm() {
  const companyId = companyInfo.value?.id;
  if (!companyId) {
    canAccessLeads.value = false;
    return false;
  }
  const platformAdmin = await isPlatformAdmin();
  const role = await getCompanyUserRoleCached(Number(companyId), true);
  const access = platformAdmin || !!role?.canAccessLeads;
  canAccessLeads.value = access;
  canCreate.value = access;
  if (!access) {
    uni.showToast({ title: '无权限访问线索管理', icon: 'none' });
    setTimeout(() => safeNavigateBack(), 800);
    return false;
  }
  return true;
}

async function loadList(reset = false) {
  const companyId = companyInfo.value?.id;
  if (!companyId || loading.value) return;
  if (reset) {
    page.value = 1;
    hasMore.value = true;
    leads.value = [];
  }
  if (!hasMore.value && !reset) return;

  loading.value = true;
  try {
    const res = await fetchLeadList({
      companyId: Number(companyId),
      status: statusFilter.value || undefined,
      keyword: keyword.value || undefined,
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
    });
    const rows = res.leads ?? [];
    total.value = res.total ?? 0;
    if (reset) leads.value = rows;
    else leads.value = [...leads.value, ...rows];
    hasMore.value = leads.value.length < total.value;
    if (rows.length >= pageSize) page.value++;
  } catch (e: any) {
    uni.showToast({ title: e.message || '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

function setStatusFilter(v: string) {
  statusFilter.value = v;
  void loadList(true);
}

function onSearch() {
  keyword.value = searchInput.value.trim();
  void loadList(true);
}

function onRefresh() {
  refreshing.value = true;
  void loadList(true);
}

function loadMore() {
  if (!loading.value && hasMore.value) void loadList(false);
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/subPackages/company/lead-detail/index?id=${id}` });
}

function goCreate() {
  uni.navigateTo({ url: '/subPackages/company/lead-form/index' });
}

function goBack() {
  safeNavigateBack();
}

async function handleExport() {
  const companyId = companyInfo.value?.id;
  if (!companyId) return;
  if (exporting.value) return;
  exporting.value = true;
  uni.showLoading({ title: '正在导出…', mask: true });
  try {
    const all = await fetchAllLeadsForExport({
      companyId: Number(companyId),
      status: statusFilter.value || undefined,
      keyword: keyword.value || undefined,
    });
    if (!all.length) {
      uni.showToast({ title: '当前没有可导出的线索', icon: 'none' });
      return;
    }
    await exportLeadsToWanliExcel(all, companyInfo.value?.name || '销售');
    uni.showToast({ title: '导出成功', icon: 'success' });
  } catch (e: any) {
    uni.showToast({ title: e.message || '导出失败', icon: 'none' });
  } finally {
    exporting.value = false;
    uni.hideLoading();
  }
}

onShow(async () => {
  if (!userInfo.value?.id) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  const ok = await ensurePerm();
  if (ok) await loadList(true);
});
</script>

<style scoped>
.lead-list-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  overflow: hidden;
}

.header-bar {
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.search-row {
  display: flex;
  gap: 16rpx;
  padding: 20rpx 24rpx 12rpx;
}

.search-input {
  flex: 1;
  height: 72rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}

.search-btn {
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 28rpx;
  font-size: 28rpx;
  background: #0d9488;
  color: #fff;
  border-radius: 12rpx;
}

.search-btn::after {
  border: none;
}

.status-scroll {
  white-space: nowrap;
  width: 100%;
}

.status-tabs {
  display: flex;
  gap: 16rpx;
  padding: 12rpx 24rpx 16rpx;
}

.tab-item {
  flex-shrink: 0;
  padding: 10rpx 22rpx;
  border-radius: 28rpx;
  background: #f3f4f6;
  font-size: 24rpx;
  color: #666;
}

.tab-item.active {
  background: #0d9488;
  color: #fff;
}

.toolbar {
  padding: 0 24rpx 16rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.create-btn {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  background: #667eea;
  color: #fff;
  font-size: 28rpx;
  border-radius: 12rpx;
}

.export-btn {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  background: #fff;
  color: #0d9488;
  font-size: 28rpx;
  border-radius: 12rpx;
  border: 1rpx solid #0d9488;
}

.create-btn::after,
.export-btn::after {
  border: none;
}

.list-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
}

.lead-item {
  margin: 20rpx 24rpx 0;
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.lead-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.lead-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #111;
}

.lead-status {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
  background: #e5e7eb;
  color: #374151;
  flex-shrink: 0;
}

.lead-status.st-following,
.lead-status.st-assigned {
  background: #dbeafe;
  color: #1d4ed8;
}

.lead-status.st-won {
  background: #dcfce7;
  color: #15803d;
}

.lead-status.st-lost {
  background: #fee2e2;
  color: #b91c1c;
}

.lead-status.st-converted {
  background: #f3e8ff;
  color: #7e22ce;
}

.lead-sub {
  display: flex;
  justify-content: space-between;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #666;
}

.lead-assignee {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #888;
}

.lead-location {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #0d9488;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty,
.loading-tip {
  text-align: center;
  padding: 80rpx 0;
  color: #999;
  font-size: 28rpx;
}
</style>
