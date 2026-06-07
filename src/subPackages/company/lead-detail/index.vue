<template>
  <view class="lead-detail-page">
    <PageNavBar title="线索详情" :show-back="true" @back="goBack" />

    <view v-if="loading" class="center-tip">加载中…</view>
    <view v-else-if="err" class="center-tip">{{ err }}</view>

    <view v-else-if="lead" class="detail-content">
      <view class="card">
        <view class="card-head">
          <text class="card-title inline">基本信息</text>
          <button v-if="canEditProfile" class="edit-link" @click="goEdit">编辑资料</button>
        </view>
        <view class="row">
          <text class="label">公司名称</text>
          <text class="value">{{ profile.companyName || lead.name }}</text>
        </view>
        <view class="row">
          <text class="label">负责人</text>
          <text class="value" :class="{ muted: !profile.contactPerson }">{{ displayText(profile.contactPerson) }}</text>
        </view>
        <view class="row">
          <text class="label">联系电话</text>
          <text class="value phone" @click="callPhone">{{ lead.phone }}</text>
        </view>
        <view class="row">
          <text class="label">微信号</text>
          <text class="value" :class="{ muted: !profile.wechat }">{{ displayText(profile.wechat) }}</text>
        </view>
        <view class="row">
          <text class="label">地区</text>
          <text class="value" :class="{ muted: !profile.region }">{{ displayText(profile.region) }}</text>
        </view>
        <view class="row">
          <text class="label">状态</text>
          <text class="value status">{{ statusLabel(lead.status) }}</text>
        </view>
        <view class="row">
          <text class="label">录入人</text>
          <text class="value" :class="{ muted: !creatorName }">{{ creatorName || '—' }}</text>
        </view>
        <view class="row">
          <text class="label">更新时间</text>
          <text class="value muted">{{ formatTime(lead.updated_at) }}</text>
        </view>
      </view>

      <view class="card">
        <text class="card-title">定位与门头</text>
        <view v-if="leadLocation" class="row location-row-detail">
          <text class="label">IP 定位</text>
          <view class="location-detail-value">
            <text class="value location-text">{{ formatLeadLocationText(leadLocation) }}</text>
            <view class="location-btns">
              <button class="loc-btn" @click="openLocationOnMap">打开地图</button>
              <button v-if="canEditProfile" class="loc-btn secondary" @click="updateLocation">重新选点</button>
            </view>
          </view>
        </view>
        <view v-else class="row">
          <text class="label">IP 定位</text>
          <view class="value-col">
            <text class="value muted">未选点</text>
            <button v-if="canEditProfile" class="loc-btn inline" @click="updateLocation">地图选点</button>
          </view>
        </view>
        <view class="row block-row">
          <text class="label">公司门头</text>
          <view v-if="profile.storefrontImageUrl" class="storefront-preview">
            <image
              :src="profile.storefrontImageUrl"
              class="storefront-img"
              mode="aspectFill"
              @click="previewStorefront"
            />
          </view>
          <text v-else class="value muted block">未上传</text>
        </view>
      </view>

      <view class="card">
        <text class="card-title">客户分类</text>
        <view class="row">
          <text class="label">企业类型</text>
          <text class="value" :class="{ muted: !profile.businessType }">{{ displayText(profile.businessType) }}</text>
        </view>
        <view class="row">
          <text class="label">拜访时间</text>
          <text class="value" :class="{ muted: !profile.visitDate }">{{ displayText(profile.visitDate) }}</text>
        </view>
        <view class="row">
          <text class="label">客户类别</text>
          <text class="value" :class="{ muted: !profile.customerLevel }">{{ displayText(profile.customerLevel) }}</text>
        </view>
        <view class="row">
          <text class="label">首次评价</text>
          <text class="value" :class="{ muted: !profile.firstEvaluation }">{{ displayText(profile.firstEvaluation) }}</text>
        </view>
      </view>

      <view class="card">
        <text class="card-title">拜访与开单</text>
        <view class="row">
          <text class="label">图册发放</text>
          <text class="value" :class="{ muted: !profile.catalogDelivery }">{{ displayText(profile.catalogDelivery) }}</text>
        </view>
        <view class="row block-row">
          <text class="label">首次拜访</text>
          <text class="value block" :class="{ muted: !profile.firstVisitDesc }">{{ displayText(profile.firstVisitDesc) }}</text>
        </view>
        <view class="row">
          <text class="label">开单时间</text>
          <text class="value" :class="{ muted: !profile.firstOrderAt }">{{ displayText(profile.firstOrderAt) }}</text>
        </view>
        <view class="row">
          <text class="label">累计开单</text>
          <text class="value" :class="{ muted: !profile.orderCount && !profile.orderAmount }">
            {{ orderSummary }}
          </text>
        </view>
        <view class="row block-row">
          <text class="label">备注</text>
          <text class="value block" :class="{ muted: !profile.remark }">{{ displayText(profile.remark) }}</text>
        </view>
      </view>

      <view v-if="canManage && lead.status !== 'converted'" class="card">
        <text class="card-title">更新状态</text>
        <picker :range="statusLabels" :value="statusPickerIndex" @change="onStatusPick">
          <view class="picker-box">{{ statusLabels[statusPickerIndex] }}</view>
        </picker>
        <button class="action-btn" @click="saveStatus">保存状态</button>
        <button class="action-btn convert" @click="convertLead">转为客户</button>
      </view>

      <view class="card">
        <text class="card-title">跟进记录</text>
        <view v-if="tracks.length === 0" class="muted-tip">暂无跟进</view>
        <view v-for="t in tracks" :key="t.id" class="track-item">
          <view class="track-head">
            <text class="track-user">{{ trackUser(t) }}</text>
            <text class="track-time">{{ formatTime(t.created_at) }}</text>
          </view>
          <text class="track-content">{{ t.content }}</text>
        </view>
        <view v-if="canAddTrack" class="track-form">
          <textarea
            v-model="trackContent"
            class="track-input"
            placeholder="填写跟进内容"
            maxlength="500"
          />
          <button class="action-btn" :disabled="addingTrack" @click="submitTrack">
            {{ addingTrack ? '提交中…' : '添加跟进' }}
          </button>
        </view>
      </view>

      <view v-if="actionMsg" class="action-msg">{{ actionMsg }}</view>
      <view class="bottom-space" />
    </view>

    <view v-if="lead && canEditProfile" class="edit-bar">
      <button class="edit-bar-btn" @click="goEdit">编辑线索资料</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import PageNavBar from '@/components/PageNavBar.vue';
import { companyInfo, userInfo } from '@/store/userStore';
import { getCompanyUserRoleCached, isPlatformAdmin as checkPlatformAdmin } from '@/utils/auth';
import { safeNavigateBack } from '@/utils/navigation';
import {
  fetchLeadDetail,
  patchLead,
  addLeadTrack,
  LEAD_STATUS_LABEL,
  type LeadDetail,
  type LeadTrack,
} from '@/subPackages/company/api/lead';
import {
  chooseLeadLocation,
  formatLeadLocationText,
  openLeadLocation,
  parseLeadLocationFromMoreInfo,
} from '@/utils/leadLocation';
import { parseLeadMoreInfoForm, type LeadMoreInfoForm } from '@/utils/leadMoreInfo';

const leadId = ref(0);
const lead = ref<LeadDetail | null>(null);
const loading = ref(true);
const err = ref('');
const actionMsg = ref('');

const platformAdmin = ref(false);
const myCompanyUserId = ref<number | null>(null);

const statusPickerIndex = ref(0);
const statusValue = ref('new');

const trackContent = ref('');
const addingTrack = ref(false);
const skipShowRefresh = ref(true);

const STATUS_OPTIONS = ['new', 'lost'];

const statusLabels = computed(() =>
  STATUS_OPTIONS.map((s) => LEAD_STATUS_LABEL[s] ?? s)
);

const tracks = computed(() => lead.value?.company_lead_tracks ?? []);

const creatorName = computed(() => {
  const u = lead.value?.companyUserByCreatedByCompanyUsers?.user;
  return u?.nickname || u?.mobile || '';
});

const canManage = computed(() => {
  if (!lead.value) return false;
  if (platformAdmin.value) return true;
  const myId = myCompanyUserId.value;
  if (myId == null) return false;
  return lead.value.created_by_company_users === myId;
});

const canAddTrack = computed(() => {
  if (!lead.value || lead.value.status === 'converted') return false;
  return canManage.value;
});

const leadLocation = computed(() =>
  lead.value ? parseLeadLocationFromMoreInfo(lead.value.more_info) : null
);

const profile = computed((): LeadMoreInfoForm => {
  if (!lead.value) return parseLeadMoreInfoForm(null);
  return parseLeadMoreInfoForm(lead.value.more_info, lead.value.name);
});

const orderSummary = computed(() => {
  const p = profile.value;
  const parts: string[] = [];
  if (p.orderCount) parts.push(`数量 ${p.orderCount}`);
  if (p.orderAmount) parts.push(`金额 ${p.orderAmount}`);
  return parts.length ? parts.join(' · ') : '未填写';
});

const canEditProfile = computed(() => {
  if (!lead.value || lead.value.status === 'converted') return false;
  return canManage.value;
});

function displayText(val?: string) {
  const v = val?.trim();
  return v || '未填写';
}

function statusLabel(s: string) {
  return LEAD_STATUS_LABEL[s] ?? s;
}

function formatTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ');
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function trackUser(t: LeadTrack) {
  return t.company_user?.user?.nickname || t.company_user?.user?.mobile || '成员';
}

async function loadPerm() {
  const companyId = companyInfo.value?.id;
  if (!companyId) return;
  const isAdmin = await checkPlatformAdmin();
  platformAdmin.value = isAdmin;
  const role = await getCompanyUserRoleCached(Number(companyId), true);
  myCompanyUserId.value = role?.companyUserId ?? null;
  if (!isAdmin && !role?.canAccessLeads) {
    err.value = '无权限查看该线索';
  }
}

function syncStatusPicker() {
  const st = lead.value?.status ?? 'new';
  const val = st === 'lost' ? 'lost' : 'new';
  statusValue.value = val;
  const idx = STATUS_OPTIONS.indexOf(val);
  statusPickerIndex.value = idx >= 0 ? idx : 0;
}

async function loadDetail() {
  loading.value = true;
  err.value = '';
  try {
    lead.value = await fetchLeadDetail(leadId.value);
    syncStatusPicker();
  } catch (e: any) {
    err.value = e.message || '加载失败';
    lead.value = null;
  } finally {
    loading.value = false;
  }
}

function onStatusPick(e: { detail: { value: string } }) {
  statusPickerIndex.value = Number(e.detail.value);
  statusValue.value = STATUS_OPTIONS[statusPickerIndex.value];
}

async function saveStatus() {
  if (!lead.value || statusValue.value === lead.value.status) return;
  actionMsg.value = '';
  try {
    await patchLead(leadId.value, { status: statusValue.value });
    actionMsg.value = '状态已更新';
    await loadDetail();
  } catch (e: any) {
    actionMsg.value = e.message || '更新失败';
  }
}

async function convertLead() {
  uni.showModal({
    title: '转为客户',
    content: '将按线索手机号创建或关联用户，并写入公司客户，确认继续？',
    success: (res) => {
      if (!res.confirm) return;
      void (async () => {
        actionMsg.value = '';
        try {
          await patchLead(leadId.value, { action: 'convert' });
          actionMsg.value = '已转客户';
          await loadDetail();
        } catch (e: any) {
          actionMsg.value = e.message || '转化失败';
        }
      })();
    },
  });
}

async function submitTrack() {
  const content = trackContent.value.trim();
  if (!content) {
    uni.showToast({ title: '请填写跟进内容', icon: 'none' });
    return;
  }
  addingTrack.value = true;
  actionMsg.value = '';
  try {
    await addLeadTrack(leadId.value, content);
    trackContent.value = '';
    actionMsg.value = '跟进已添加';
    await loadDetail();
  } catch (e: any) {
    actionMsg.value = e.message || '添加失败';
  } finally {
    addingTrack.value = false;
  }
}

function callPhone() {
  if (lead.value?.phone) uni.makePhoneCall({ phoneNumber: lead.value.phone });
}

function openLocationOnMap() {
  const loc = leadLocation.value;
  if (!loc) return;
  openLeadLocation(loc);
}

async function updateLocation() {
  actionMsg.value = '';
  try {
    const loc = await chooseLeadLocation();
    if (!loc) return;
    await patchLead(leadId.value, { location: loc });
    actionMsg.value = '位置已更新';
    await loadDetail();
  } catch (e: any) {
    actionMsg.value = e.message || '更新位置失败';
  }
}

function goBack() {
  safeNavigateBack();
}

function goEdit() {
  uni.navigateTo({ url: `/subPackages/company/lead-form/index?id=${leadId.value}` });
}

function previewStorefront() {
  if (profile.value.storefrontImageUrl) {
    uni.previewImage({ urls: [profile.value.storefrontImageUrl] });
  }
}

onLoad(async (options?: { id?: string }) => {
  const id = Number(options?.id);
  if (!Number.isInteger(id) || id <= 0) {
    err.value = '无效的线索';
    loading.value = false;
    return;
  }
  leadId.value = id;
  if (!userInfo.value?.id) {
    err.value = '请先登录';
    loading.value = false;
    return;
  }
  await loadPerm();
  if (err.value) {
    loading.value = false;
    return;
  }
  await loadDetail();
});

onShow(async () => {
  if (skipShowRefresh.value) {
    skipShowRefresh.value = false;
    return;
  }
  if (leadId.value > 0 && !loading.value && !err.value) {
    await loadDetail();
  }
});
</script>

<style scoped>
.lead-detail-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.detail-content {
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.center-tip {
  padding: 120rpx 40rpx;
  text-align: center;
  color: #666;
  font-size: 28rpx;
}

.card {
  margin: 20rpx 24rpx 0;
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
}

.card-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #0d9488;
  margin-bottom: 16rpx;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.card-title.inline {
  margin-bottom: 0;
}

.edit-link {
  height: 52rpx;
  line-height: 52rpx;
  padding: 0 20rpx;
  font-size: 24rpx;
  background: #f0fdfa;
  color: #0d9488;
  border-radius: 26rpx;
  margin: 0;
}

.edit-link::after {
  border: none;
}

.block-row {
  flex-direction: column;
  align-items: flex-start;
  gap: 8rpx;
}

.value.block {
  text-align: left;
  line-height: 1.6;
  white-space: pre-wrap;
}

.storefront-preview {
  width: 100%;
  margin-top: 8rpx;
}

.storefront-img {
  width: 100%;
  height: 280rpx;
  border-radius: 12rpx;
  background: #f3f4f6;
}

.value-col {
  flex: 1;
  min-width: 0;
  text-align: right;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.row:last-child {
  border-bottom: none;
}

.label {
  font-size: 26rpx;
  color: #666;
  flex-shrink: 0;
}

.value {
  font-size: 28rpx;
  color: #111;
  text-align: right;
}

.value.phone {
  color: #0d9488;
}

.value.status {
  font-weight: 600;
}

.value.muted,
.muted-tip {
  color: #999;
  font-size: 26rpx;
}

.picker-box {
  padding: 20rpx 24rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  font-size: 28rpx;
  margin-bottom: 16rpx;
}

.action-btn {
  width: 100%;
  height: 76rpx;
  line-height: 76rpx;
  background: #0d9488;
  color: #fff;
  font-size: 28rpx;
  border-radius: 12rpx;
}

.action-btn::after {
  border: none;
}

.action-btn.convert {
  background: #667eea;
}

.track-item {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.track-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.track-user {
  font-size: 26rpx;
  color: #374151;
  font-weight: 500;
}

.track-time {
  font-size: 22rpx;
  color: #9ca3af;
}

.track-content {
  font-size: 28rpx;
  color: #111;
  line-height: 1.6;
  white-space: pre-wrap;
}

.track-form {
  margin-top: 20rpx;
}

.track-input {
  width: 100%;
  min-height: 160rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  margin-bottom: 16rpx;
}

.action-msg {
  margin: 16rpx 24rpx;
  text-align: center;
  color: #0d9488;
  font-size: 26rpx;
}

.bottom-space {
  height: 40rpx;
}

.edit-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1rpx solid #eee;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
  z-index: 100;
}

.edit-bar-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  background: #0d9488;
  color: #fff;
  font-size: 30rpx;
  border-radius: 16rpx;
  margin: 0;
}

.edit-bar-btn::after {
  border: none;
}

.location-row-detail {
  align-items: flex-start;
}

.location-detail-value {
  flex: 1;
  min-width: 0;
  text-align: right;
}

.location-text {
  display: block;
  text-align: right;
  line-height: 1.5;
  margin-bottom: 12rpx;
}

.location-btns {
  display: flex;
  justify-content: flex-end;
  gap: 12rpx;
  flex-wrap: wrap;
}

.loc-btn {
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 24rpx;
  font-size: 24rpx;
  background: #0d9488;
  color: #fff;
  border-radius: 28rpx;
  margin: 0;
}

.loc-btn::after {
  border: none;
}

.loc-btn.secondary {
  background: #f0fdfa;
  color: #0d9488;
  border: 1rpx solid #99f6e4;
}

.loc-btn.inline {
  margin-left: auto;
}
</style>
