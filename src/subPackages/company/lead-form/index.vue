<template>
  <view class="lead-form-page">
    <PageNavBar :title="isEdit ? '编辑线索' : '录入线索'" :show-back="true" @back="goBack" />

    <view v-if="loading" class="center-tip">加载中…</view>
    <view v-else-if="loadErr" class="center-tip">{{ loadErr }}</view>

    <view v-else class="form-content">
      <view class="section">
        <text class="section-title">基本信息</text>
        <view class="field">
          <text class="field-label required">公司名称</text>
          <input v-model="form.companyName" class="field-input" placeholder="必填" />
        </view>
        <view class="field">
          <text class="field-label">负责人</text>
          <input v-model="form.contactPerson" class="field-input" placeholder="法人代表/材料主管/设计师/财务" />
        </view>
        <view class="field">
          <text class="field-label required">联系电话</text>
          <input v-model="phone" class="field-input" type="number" maxlength="11" placeholder="手机号" />
        </view>
        <view class="field">
          <text class="field-label">微信号</text>
          <input v-model="form.wechat" class="field-input" placeholder="选填" />
        </view>
        <view class="field">
          <text class="field-label">地区</text>
          <input v-model="form.region" class="field-input" placeholder="同步到县级，可地图选点后自动填充" />
        </view>
      </view>

      <view class="section">
        <text class="section-title">定位与门头</text>
        <view class="location-row">
          <view class="location-picker" @click="pickLocation">
            <text class="location-label">IP 定位（地图选点）</text>
            <text class="location-value" :class="{ placeholder: !location }">
              {{ location ? formatLeadLocationText(location) : '点击在地图上选点' }}
            </text>
          </view>
          <text v-if="location" class="location-clear" @click.stop="location = null">清除</text>
        </view>
        <view class="field storefront-field">
          <text class="field-label">公司门头</text>
          <view class="storefront-row">
            <image
              v-if="form.storefrontImageUrl"
              :src="form.storefrontImageUrl"
              class="storefront-img"
              mode="aspectFill"
              @click="previewStorefront"
            />
            <view v-else class="storefront-placeholder">未上传</view>
            <button class="upload-btn" :disabled="uploading" @click="uploadStorefront">
              {{ uploading ? `上传 ${uploadProgress}%` : form.storefrontImageUrl ? '更换' : '上传图片' }}
            </button>
          </view>
        </view>
      </view>

      <view class="section">
        <text class="section-title">客户分类</text>
        <view class="field">
          <text class="field-label">企业类型</text>
          <picker :range="businessTypeOptions" :value="businessTypeIndex" @change="onBusinessTypePick">
            <view class="picker-box">{{ form.businessType || '请选择' }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="field-label">开发/拜访时间</text>
          <picker mode="date" :value="form.visitDate" @change="onVisitDatePick">
            <view class="picker-box">{{ form.visitDate || '选择日期' }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="field-label">客户类别</text>
          <picker :range="customerLevelOptions" :value="customerLevelIndex" @change="onCustomerLevelPick">
            <view class="picker-box">{{ form.customerLevel || '请选择' }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="field-label">首次沟通评价</text>
          <picker :range="firstEvaluationOptions" :value="firstEvaluationIndex" @change="onFirstEvaluationPick">
            <view class="picker-box">{{ form.firstEvaluation || '请选择' }}</view>
          </picker>
        </view>
      </view>

      <view class="section">
        <text class="section-title">拜访与开单</text>
        <view class="field">
          <text class="field-label">图册发放</text>
          <input
            v-model="form.catalogDelivery"
            class="field-input"
            placeholder="如：灯具图册/1本；现场发放"
          />
        </view>
        <view class="field">
          <text class="field-label">首次拜访描述</text>
          <textarea
            v-model="form.firstVisitDesc"
            class="field-textarea"
            placeholder="实际拜访情况介绍"
            maxlength="1000"
          />
        </view>
        <view class="field">
          <text class="field-label">开单时间</text>
          <picker mode="date" :value="form.firstOrderAt" @change="onFirstOrderPick">
            <view class="picker-box">{{ form.firstOrderAt || '选填' }}</view>
          </picker>
        </view>
        <view class="field-row">
          <view class="field half">
            <text class="field-label">累计开单数</text>
            <input v-model="form.orderCount" class="field-input" type="digit" placeholder="0" />
          </view>
          <view class="field half">
            <text class="field-label">累计金额</text>
            <input v-model="form.orderAmount" class="field-input" type="digit" placeholder="0" />
          </view>
        </view>
        <view class="field">
          <text class="field-label">备注</text>
          <textarea v-model="form.remark" class="field-textarea" placeholder="选填" maxlength="500" />
        </view>
      </view>

      <text v-if="submitErr" class="submit-err">{{ submitErr }}</text>
      <button class="submit-btn" :disabled="submitting" @click="submit">
        {{ submitting ? '保存中…' : isEdit ? '保存修改' : '提交录入' }}
      </button>
      <view class="bottom-space" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import PageNavBar from '@/components/PageNavBar.vue';
import { companyInfo, userInfo } from '@/store/userStore';
import { getCompanyUserRoleCached, isPlatformAdmin } from '@/utils/auth';
import { safeNavigateBack } from '@/utils/navigation';
import {
  createLead,
  fetchLeadDetail,
  updateLeadProfile,
  type LeadDetail,
} from '@/subPackages/company/api/lead';
import {
  chooseLeadLocation,
  formatLeadLocationText,
  parseLeadLocationFromMoreInfo,
  type LeadLocation,
} from '@/utils/leadLocation';
import {
  BUSINESS_TYPE_OPTIONS,
  CUSTOMER_LEVEL_OPTIONS,
  FIRST_EVALUATION_OPTIONS,
  buildMoreInfoPayload,
  buildMoreInfoUpdatePayload,
  emptyLeadMoreInfoForm,
  guessRegionFromLocation,
  parseLeadMoreInfoForm,
  pickerIndex,
  todayDateString,
  type LeadMoreInfoForm,
} from '@/utils/leadMoreInfo';
import { useImageUploadWithProgress } from '@/subPackages/company/utils/useImageUploadWithProgress';

const leadId = ref(0);
const isEdit = computed(() => leadId.value > 0);
const loading = ref(false);
const loadErr = ref('');
const submitting = ref(false);
const submitErr = ref('');

const phone = ref('');
const form = ref<LeadMoreInfoForm>(emptyLeadMoreInfoForm());
const location = ref<LeadLocation | null>(null);

const businessTypeOptions = [...BUSINESS_TYPE_OPTIONS];
const customerLevelOptions = [...CUSTOMER_LEVEL_OPTIONS];
const firstEvaluationOptions = [...FIRST_EVALUATION_OPTIONS];

const businessTypeIndex = computed(() => pickerIndex(businessTypeOptions, form.value.businessType));
const customerLevelIndex = computed(() => pickerIndex(customerLevelOptions, form.value.customerLevel));
const firstEvaluationIndex = computed(() =>
  pickerIndex(firstEvaluationOptions, form.value.firstEvaluation)
);

const { uploading, progress: uploadProgress, chooseAndUploadImage } = useImageUploadWithProgress();

async function ensurePerm() {
  const companyId = companyInfo.value?.id;
  if (!companyId) {
    loadErr.value = '请先选择公司';
    return false;
  }
  const platformAdmin = await isPlatformAdmin();
  const role = await getCompanyUserRoleCached(Number(companyId), true);
  if (!platformAdmin && !role?.canAccessLeads) {
    loadErr.value = '无权限';
    return false;
  }
  return true;
}

async function loadLead() {
  loading.value = true;
  loadErr.value = '';
  try {
    const row = await fetchLeadDetail(leadId.value);
    if (!(await canEditLead(row))) {
      loadErr.value = '无权限编辑该线索';
      return;
    }
    phone.value = row.phone || '';
    form.value = parseLeadMoreInfoForm(row.more_info, row.name);
    location.value = parseLeadLocationFromMoreInfo(row.more_info);
  } catch (e: any) {
    loadErr.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

async function canEditLead(row: LeadDetail) {
  if (row.status === 'converted') return false;
  const companyId = companyInfo.value?.id;
  if (!companyId) return false;
  const platformAdmin = await isPlatformAdmin();
  if (platformAdmin) return true;
  const role = await getCompanyUserRoleCached(Number(companyId), true);
  const myId = role?.companyUserId;
  if (myId == null) return false;
  return row.created_by_company_users === myId;
}

function onBusinessTypePick(e: { detail: { value: string } }) {
  form.value.businessType = businessTypeOptions[Number(e.detail.value)] || '';
}

function onCustomerLevelPick(e: { detail: { value: string } }) {
  form.value.customerLevel = customerLevelOptions[Number(e.detail.value)] || '';
}

function onFirstEvaluationPick(e: { detail: { value: string } }) {
  form.value.firstEvaluation = firstEvaluationOptions[Number(e.detail.value)] || '';
}

function onVisitDatePick(e: { detail: { value: string } }) {
  form.value.visitDate = e.detail.value || todayDateString();
}

function onFirstOrderPick(e: { detail: { value: string } }) {
  form.value.firstOrderAt = e.detail.value || '';
}

async function pickLocation() {
  try {
    const loc = await chooseLeadLocation();
    if (!loc) return;
    location.value = loc;
    if (!form.value.region.trim()) {
      form.value.region = guessRegionFromLocation(loc);
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '选点失败', icon: 'none' });
  }
}

async function uploadStorefront() {
  try {
    const url = await chooseAndUploadImage({ ext: '.jpg' });
    form.value.storefrontImageUrl = url;
  } catch (e: any) {
    if (e.message?.includes('取消')) return;
    uni.showToast({ title: e.message || '上传失败', icon: 'none' });
  }
}

function previewStorefront() {
  if (form.value.storefrontImageUrl) {
    uni.previewImage({ urls: [form.value.storefrontImageUrl] });
  }
}

function validate(): boolean {
  submitErr.value = '';
  const companyName = form.value.companyName.trim();
  const p = phone.value.trim();
  if (!companyName) {
    submitErr.value = '请填写公司名称';
    return false;
  }
  if (!p || p.length < 7) {
    submitErr.value = '请填写有效手机号';
    return false;
  }
  return true;
}

async function submit() {
  if (!validate() || submitting.value) return;
  const companyId = companyInfo.value?.id;
  if (!companyId) return;

  const companyName = form.value.companyName.trim();
  const moreInfo = isEdit.value
    ? buildMoreInfoUpdatePayload(form.value)
    : buildMoreInfoPayload(form.value);
  moreInfo.companyName = companyName;

  submitting.value = true;
  submitErr.value = '';
  try {
    if (isEdit.value) {
      await updateLeadProfile(leadId.value, {
        name: companyName,
        phone: phone.value.trim(),
        location: location.value,
        moreInfo,
      });
      uni.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => safeNavigateBack(), 500);
    } else {
      await createLead({
        companyId: Number(companyId),
        name: companyName,
        phone: phone.value.trim(),
        location: location.value,
        moreInfo,
      });
      uni.showToast({ title: '录入成功', icon: 'success' });
      setTimeout(() => safeNavigateBack(), 500);
    }
  } catch (e: any) {
    submitErr.value = e.message || '保存失败';
  } finally {
    submitting.value = false;
  }
}

function goBack() {
  safeNavigateBack();
}

onLoad(async (options?: { id?: string }) => {
  if (!userInfo.value?.id) {
    loadErr.value = '请先登录';
    return;
  }
  const ok = await ensurePerm();
  if (!ok) return;

  const id = Number(options?.id);
  if (Number.isInteger(id) && id > 0) {
    leadId.value = id;
    await loadLead();
  } else {
    form.value = emptyLeadMoreInfoForm();
    phone.value = '';
    location.value = null;
  }
});
</script>

<style scoped>
.lead-form-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.form-content {
  padding-bottom: 48rpx;
}

.center-tip {
  padding: 120rpx 40rpx;
  text-align: center;
  color: #666;
  font-size: 28rpx;
}

.section {
  margin: 20rpx 24rpx 0;
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #0d9488;
  margin-bottom: 20rpx;
}

.field {
  margin-bottom: 20rpx;
}

.field:last-child {
  margin-bottom: 0;
}

.field-row {
  display: flex;
  gap: 16rpx;
}

.field.half {
  flex: 1;
  min-width: 0;
}

.field-label {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin-bottom: 10rpx;
}

.field-label.required::after {
  content: ' *';
  color: #ef4444;
}

.field-input {
  width: 100%;
  height: 76rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.field-textarea {
  width: 100%;
  min-height: 160rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.picker-box {
  height: 76rpx;
  line-height: 76rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: #111;
}

.location-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.location-picker {
  flex: 1;
  min-width: 0;
  padding: 20rpx;
  background: #f0fdfa;
  border-radius: 12rpx;
  border: 1rpx solid #99f6e4;
}

.location-label {
  display: block;
  font-size: 22rpx;
  color: #0d9488;
  margin-bottom: 8rpx;
}

.location-value {
  display: block;
  font-size: 26rpx;
  color: #134e4a;
  line-height: 1.45;
  word-break: break-word;
}

.location-value.placeholder {
  color: #94a3b8;
}

.location-clear {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #ef4444;
  padding: 20rpx 8rpx;
}

.storefront-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.storefront-img {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background: #f3f4f6;
}

.storefront-placeholder {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #9ca3af;
}

.upload-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  font-size: 26rpx;
  background: #667eea;
  color: #fff;
  border-radius: 12rpx;
  margin: 0;
}

.upload-btn::after {
  border: none;
}

.submit-err {
  display: block;
  margin: 16rpx 24rpx 0;
  color: #ef4444;
  font-size: 24rpx;
  text-align: center;
}

.submit-btn {
  margin: 24rpx 24rpx 0;
  height: 88rpx;
  line-height: 88rpx;
  background: #0d9488;
  color: #fff;
  font-size: 30rpx;
  border-radius: 16rpx;
}

.submit-btn::after {
  border: none;
}

.bottom-space {
  height: 48rpx;
}
</style>
