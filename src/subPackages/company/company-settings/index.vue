<template>
  <view class="company-settings-page">
    <view v-if="isAuditMode" class="audit-tip">仅查看，不可操作</view>
    <view class="page-content">
      <view class="form-section">
        <view class="form-item">
          <view class="form-label">公司名称 <text class="required">*</text></view>
          <input
            class="form-input" 
            v-model="form.name" 
            placeholder="请输入公司名称"
            maxlength="50"
            :disabled="isAuditMode"
          />
        </view>

        <view class="form-item">
          <view class="form-label">公司Logo</view>
          <view class="form-upload square" :class="{ disabled: isAuditMode }" @click="!isAuditMode && uploadLogo()">
            <image 
              v-if="form.logo_url" 
              :src="form.logo_url" 
              class="uploaded-image"
              mode="aspectFill"
            />
            <view v-else class="upload-placeholder">
              <text class="upload-icon">📷</text>
              <text class="upload-text">点击上传Logo</text>
            </view>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">顶部轮播图</view>
          <view class="banner-section">
            <view 
              v-for="(banner, index) in topBanners" 
              :key="index" 
              class="banner-item"
            >
              <image 
                :src="getBannerImage(banner)" 
                class="banner-image"
                mode="aspectFill"
              />
              <view class="banner-actions">
                <text class="banner-action-btn" @click="editTopBanner(index)">编辑</text>
                <text class="banner-action-btn delete" @click="removeTopBanner(index)">删除</text>
              </view>
            </view>
            <view class="add-banner-btn" @click="addTopBanner">
              <text class="add-icon">+</text>
              <text class="add-text">添加轮播图</text>
            </view>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">底部轮播图</view>
          <view class="banner-section">
            <view 
              v-for="(banner, index) in bottomBanners" 
              :key="index" 
              class="banner-item"
            >
              <image 
                :src="getBannerImage(banner)" 
                class="banner-image"
                mode="aspectFill"
              />
              <view v-if="!isAuditMode" class="banner-actions">
                <text class="banner-action-btn" @click="editBottomBanner(index)">编辑</text>
                <text class="banner-action-btn delete" @click="removeBottomBanner(index)">删除</text>
              </view>
            </view>
            <view v-if="!isAuditMode" class="add-banner-btn" @click="addBottomBanner">
              <text class="add-icon">+</text>
              <text class="add-text">添加轮播图</text>
            </view>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">公司介绍</view>
          <textarea class="form-textarea" v-model="form.description" placeholder="用于关于我们、联系我们展示" maxlength="500" :disabled="isAuditMode" />
        </view>
        <view class="form-item">
          <view class="form-label">联系我们二维码</view>
          <view class="form-upload square" :class="{ disabled: isAuditMode }" @click="!isAuditMode && uploadContactCode()">
            <image v-if="form.contact_code" :src="form.contact_code" class="uploaded-image" mode="aspectFill" />
            <view v-else class="upload-placeholder">
              <text class="upload-icon">📷</text>
              <text class="upload-text">点击上传</text>
            </view>
          </view>
        </view>
        <view class="form-item">
          <view class="form-label">微信二维码</view>
          <view class="form-upload square" :class="{ disabled: isAuditMode }" @click="!isAuditMode && uploadWechatCode()">
            <image v-if="form.wechat_code" :src="form.wechat_code" class="uploaded-image" mode="aspectFill" />
            <view v-else class="upload-placeholder">
              <text class="upload-icon">📷</text>
              <text class="upload-text">点击上传（订单详情等展示）</text>
            </view>
          </view>
        </view>
        <view class="form-item">
          <view class="form-label">资源库文件</view>
          <view class="resource-file-upload" @click="uploadResourceFile">
            <view v-if="form.resource_file_url" class="resource-file-has">
              <text class="resource-file-icon">📄</text>
              <text class="resource-file-name">{{ resourceFileName }}</text>
              <text class="resource-file-remove" @click.stop="clearResourceFile">删除</text>
            </view>
            <view v-else class="resource-file-placeholder">
              <text class="upload-icon">📤</text>
              <text class="upload-text">点击上传资料文件（PDF、Word等）</text>
            </view>
          </view>
        </view>

        <view class="form-item section-label">价格系数与看价</view>
        <view class="form-item">
          <view class="form-label">价格模式</view>
          <view class="mode-row">
            <view
              class="mode-option"
              :class="{ active: form.mode_for_price === 'company' }"
              @click="!isAuditMode && (form.mode_for_price = 'company')"
            >
              <text class="mode-title">公司统一</text>
              <text class="mode-desc">价格系数全员与访客统一用下方默认值；能否看价仅约束微信访客，正式成员均可看价</text>
            </view>
            <view
              class="mode-option"
              :class="{ active: form.mode_for_price === 'user' }"
              @click="!isAuditMode && (form.mode_for_price = 'user')"
            >
              <text class="mode-title">按用户单独</text>
              <text class="mode-desc">在成员列表为每人设置系数与可看价；未入库成员沿用下方默认</text>
            </view>
          </view>
        </view>
        <view class="form-item switch-row">
          <view class="switch-label-wrap">
            <view class="form-label">
              {{ form.mode_for_price === 'company' ? '微信访客默认可查看价格' : '默认能否查看价格' }}
            </view>
            <view v-if="form.mode_for_price === 'company'" class="form-hint">
              「公司统一」：仅对微信访客（wx_guest_user）是否可看价生效；正式成员均可看价
            </view>
            <view v-else class="form-hint">
              「按用户」：已在成员表中的用户以列表为准；尚无成员行的用户（含微信访客）使用下方默认可看价与系数
            </view>
          </view>
          <switch
            :checked="form.default_for_can_view_price"
            :disabled="isAuditMode"
            color="#667eea"
            @change="(e: any) => form.default_for_can_view_price = e.detail.value"
          />
        </view>
        <view class="form-item">
          <view class="form-label">默认价格系数</view>
          <input
            class="form-input"
            v-model="form.default_for_price_factor"
            type="digit"
            placeholder="如 1 表示原价，0.9 表示 9 折"
            :disabled="isAuditMode"
            @input="onDefaultPriceFactorInput"
          />
          <view v-if="form.mode_for_price === 'company'" class="form-hint">
            「公司统一」：全员与微信访客展示价均乘以该系数；1 为原价，0.9 约九折
          </view>
          <view v-else class="form-hint">
            「按用户」：新成员默认系数；已在列表中的成员请在成员里单独修改；1 为原价
          </view>
        </view>
      </view>

      <view v-if="!isAuditMode" class="footer-actions">
        <button class="save-btn" @click="handleSave" :loading="loading">
          {{ loading ? '保存中...' : '保存' }}
        </button>
        <button class="cancel-btn" @click="handleCancel">取消</button>
      </view>
    </view>

    <!-- 轮播图编辑弹窗 -->
    <view v-if="showBannerModal" class="modal-overlay" @click="closeBannerModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editingBannerType === 'top' ? '编辑顶部轮播图' : '编辑底部轮播图' }}</text>
          <text class="modal-close" @click="closeBannerModal">×</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <view class="form-label">轮播图</view>
            <view class="form-upload banner" @click="uploadBannerImage">
              <image 
                v-if="editingBanner.file_url" 
                :src="editingBanner.file_url" 
                class="uploaded-image"
                mode="aspectFill"
              />
              <view v-else class="upload-placeholder">
                <text class="upload-icon">📷</text>
                <text class="upload-text">点击上传图片</text>
              </view>
            </view>
          </view>

          <view class="form-item">
            <view class="form-label">标题</view>
            <input
              class="form-input" 
              v-model="editingBanner.title" 
              placeholder="请输入标题（可选）"
              maxlength="50"
            />
          </view>

          <view class="form-item">
            <view class="form-label">跳转链接</view>
            <input
              class="form-input" 
              v-model="editingBanner.link" 
              placeholder="请输入跳转链接（可选）"
              maxlength="200"
            />
          </view>

          <view class="form-item">
            <view class="form-label">排序</view>
            <input
              class="form-input" 
              v-model.number="editingBanner.sort" 
              placeholder="数字越小越靠前"
              type="number"
            />
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn" @click="saveBanner">保存</button>
          <button class="modal-btn cancel" @click="closeBannerModal">取消</button>
        </view>
      </view>
    </view>
  </view>

  <UploadProgressOverlay :show="uploading" :progress="progress" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { syncCompanyInfo } from '@/api/company/index';
import { invalidateCompanyDetailCache } from '@/store/userStore';
import { clearCompanyUserRoleCache } from '@/utils/auth';
import { getCompanyDetailCached, updateCompany } from '@/subPackages/company/api/platform';
import { getBanners } from '@/api/banner/index';
import { useImageUploadWithProgress } from '../utils/useImageUploadWithProgress';
import UploadProgressOverlay from '@/components/UploadProgressOverlay.vue';
import type { BannerItem } from '@/types/companies';

const { uploading, progress, chooseAndUploadImage, uploadWithProgress } = useImageUploadWithProgress();
const companyId = ref<number | null>(null);
/** 核查入口只读：不可编辑、保存 */
const isAuditMode = ref(false);
const form = ref({
  name: '',
  logo_url: '',
  description: '',
  contact_code: '',
  wechat_code: '',
  resource_file_url: '',
  default_for_can_view_price: false,
  default_for_price_factor: '1',
  mode_for_price: 'user' as 'company' | 'user',
});
const topBanners = ref<BannerItem[]>([]);
const bottomBanners = ref<BannerItem[]>([]);
const loading = ref(false);

// 轮播图编辑相关
const showBannerModal = ref(false);
const editingBannerType = ref<'top' | 'bottom'>('top');
const editingBannerIndex = ref<number>(-1);
const editingBanner = ref<BannerItem>({
  file_url: '',
  title: '',
  link: '',
  sort: 0,
});

// 获取轮播图图片URL
const getBannerImage = (banner: BannerItem | string): string => {
  if (typeof banner === 'string') {
    return banner;
  }
  return banner.file_url || '/static/default-banner.png';
};

// 上传Logo（带进度）
const uploadLogo = async () => {
  try {
    const url = await chooseAndUploadImage({ ext: '.jpg' });
    form.value.logo_url = url;
  } catch (error: any) {
    if (error?.message && !error.message.includes('取消')) {
      uni.showToast({ title: error.message || '上传失败', icon: 'none' });
    }
  }
};

const uploadContactCode = async () => {
  try {
    const url = await chooseAndUploadImage({ ext: '.jpg' });
    form.value.contact_code = url;
  } catch (error: any) {
    if (error?.message && !error.message.includes('取消')) {
      uni.showToast({ title: error.message || '上传失败', icon: 'none' });
    }
  }
};

const uploadWechatCode = async () => {
  try {
    const url = await chooseAndUploadImage({ ext: '.jpg' });
    form.value.wechat_code = url;
  } catch (error: any) {
    if (error?.message && !error.message.includes('取消')) {
      uni.showToast({ title: error.message || '上传失败', icon: 'none' });
    }
  }
};

// 资源库文件名展示（从 URL 取最后一段或显示“已上传文件”）
const resourceFileName = computed(() => {
  const url = form.value.resource_file_url;
  if (!url) return '';
  try {
    const path = url.split('?')[0];
    const name = path.split('/').pop() || '';
    return decodeURIComponent(name) || '已上传文件';
  } catch {
    return '已上传文件';
  }
});

// 上传资源库文件（PDF、Word 等，带进度）
const uploadResourceFile = () => {
  // #ifdef MP-WEIXIN
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
    success: async (res) => {
      const file = res.tempFiles[0];
      if (!file?.path) return;
      const ext = file.name ? (file.name.includes('.') ? '.' + file.name.split('.').pop() : '') : '';
      try {
        const url = await uploadWithProgress(file.path, ext || '.pdf');
        form.value.resource_file_url = url;
        uni.showToast({ title: '上传成功', icon: 'success' });
      } catch (error: any) {
        uni.showToast({ title: (error as any)?.message || '上传失败', icon: 'none' });
      }
    },
  });
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '请在微信小程序中上传资料文件', icon: 'none' });
  // #endif
};

const clearResourceFile = () => {
  form.value.resource_file_url = '';
};

const onDefaultPriceFactorInput = (e: any) => {
  const raw = (e?.detail?.value ?? e?.target?.value ?? '') as string;
  let s = raw.replace(/[^\d.]/g, '');
  const idx = s.indexOf('.');
  if (idx >= 0) {
    s = s.slice(0, idx + 1) + s.slice(idx + 1).replace(/\./g, '');
  }
  form.value.default_for_price_factor = s;
};

// 上传轮播图（带进度）
const uploadBannerImage = async () => {
  try {
    const url = await chooseAndUploadImage({ ext: '.jpg' });
    editingBanner.value.file_url = url;
  } catch (error: any) {
    if (error?.message && !error.message.includes('取消')) {
      uni.showToast({ title: error.message || '上传失败', icon: 'none' });
    }
  }
};

// 添加顶部轮播图
const addTopBanner = () => {
  editingBannerType.value = 'top';
  editingBannerIndex.value = -1;
  editingBanner.value = {
    file_url: '',
    title: '',
    link: '',
    sort: topBanners.value.length,
  };
  showBannerModal.value = true;
};

// 编辑顶部轮播图
const editTopBanner = (index: number) => {
  editingBannerType.value = 'top';
  editingBannerIndex.value = index;
  editingBanner.value = { ...topBanners.value[index] };
  showBannerModal.value = true;
};

// 删除顶部轮播图
const removeTopBanner = (index: number) => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这个轮播图吗？',
    success: (res) => {
      if (res.confirm) {
        topBanners.value.splice(index, 1);
      }
    },
  });
};

// 添加底部轮播图
const addBottomBanner = () => {
  editingBannerType.value = 'bottom';
  editingBannerIndex.value = -1;
  editingBanner.value = {
    file_url: '',
    title: '',
    link: '',
    sort: bottomBanners.value.length,
  };
  showBannerModal.value = true;
};

// 编辑底部轮播图
const editBottomBanner = (index: number) => {
  editingBannerType.value = 'bottom';
  editingBannerIndex.value = index;
  editingBanner.value = { ...bottomBanners.value[index] };
  showBannerModal.value = true;
};

// 删除底部轮播图
const removeBottomBanner = (index: number) => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这个轮播图吗？',
    success: (res) => {
      if (res.confirm) {
        bottomBanners.value.splice(index, 1);
      }
    },
  });
};

// 保存轮播图
const saveBanner = () => {
  if (!editingBanner.value.file_url) {
    uni.showToast({
      title: '请先上传图片',
      icon: 'none',
    });
    return;
  }

  const banner: BannerItem = {
    file_type: 'image',
    file_url: editingBanner.value.file_url,
    title: editingBanner.value.title || undefined,
    link: editingBanner.value.link || undefined,
    sort: editingBanner.value.sort || 0,
  };

  if (editingBannerType.value === 'top') {
    if (editingBannerIndex.value === -1) {
      topBanners.value.push(banner);
    } else {
      topBanners.value[editingBannerIndex.value] = banner;
    }
  } else {
    if (editingBannerIndex.value === -1) {
      bottomBanners.value.push(banner);
    } else {
      bottomBanners.value[editingBannerIndex.value] = banner;
    }
  }

  closeBannerModal();
};

// 关闭轮播图弹窗
const closeBannerModal = () => {
  showBannerModal.value = false;
  editingBanner.value = {
    file_url: '',
    title: '',
    link: '',
    sort: 0,
  };
};

// 加载公司详情
const loadCompanyDetail = async () => {
  if (!companyId.value) return;
  loading.value = true;
  try {
    const company = await getCompanyDetailCached(companyId.value!);
    if (company) {
      const c = company as any;
      form.value = {
        name: company.name,
        logo_url: company.logo_url || '',
        description: c.description || '',
        contact_code: c.contact_code || '',
        wechat_code: c.wechat_code || '',
        resource_file_url: c.resource_file_url || '',
        default_for_can_view_price: c.default_for_can_view_price ?? false,
        default_for_price_factor: c.default_for_price_factor != null ? String(c.default_for_price_factor) : '1',
        mode_for_price:
          c.mode_for_price === 'company' || c.mode_for_price === 'user' ? c.mode_for_price : 'user',
      };
    }

    // 一次请求加载顶部+底部轮播图
    const bannerRes = await getBanners(companyId.value);
    const mapBanner = (banner: any) =>
      typeof banner === 'string' ? { file_url: banner, file_type: 'image', sort: 0 } : banner;
    if (bannerRes?.code === 0 && bannerRes.data) {
      topBanners.value = bannerRes.data.top.map(mapBanner);
      bottomBanners.value = bannerRes.data.bottom.map(mapBanner);
    }
  } catch (error: any) {
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
};

// 保存公司设置
const handleSave = async () => {
  if (!form.value.name) {
    uni.showToast({
      title: '请填写公司名称',
      icon: 'none',
    });
    return;
  }

  if (!companyId.value) {
    uni.showToast({
      title: '公司ID不存在',
      icon: 'none',
    });
    return;
  }

  loading.value = true;

  const defaultFactor = Number(form.value.default_for_price_factor);
  if (Number.isNaN(defaultFactor) || defaultFactor <= 0) {
    uni.showToast({ title: '默认价格系数需大于 0', icon: 'none' });
    loading.value = false;
    return;
  }

  try {
    await updateCompany(companyId.value, {
      name: form.value.name,
      logo_url: form.value.logo_url,
      banner_top: topBanners.value,
      banner_bottom: bottomBanners.value,
      description: form.value.description || undefined,
      contact_code: form.value.contact_code || undefined,
      wechat_code: form.value.wechat_code || undefined,
      resource_file_url: form.value.resource_file_url || undefined,
      default_for_can_view_price: form.value.default_for_can_view_price,
      default_for_price_factor: defaultFactor,
      mode_for_price: form.value.mode_for_price,
    });

    clearCompanyUserRoleCache();
    invalidateCompanyDetailCache(companyId.value);
    await syncCompanyInfo(companyId.value, true);

    uni.showToast({
      title: '保存成功',
      icon: 'success',
    });
    setTimeout(() => {
      uni.navigateBack();
    }, 1500);
  } catch (error: any) {
    uni.showToast({
      title: error.message || '保存失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
};

// 取消
const handleCancel = () => {
  uni.navigateBack();
};

onLoad((options?: { id?: string; companyId?: string; audit?: string }) => {
  const id = options?.id ?? options?.companyId;
  if (id) {
    companyId.value = Number(id);
    loadCompanyDetail();
  }
  if (options?.audit === '1') {
    isAuditMode.value = true;
  }
});
</script>

<style scoped>
@import '@/styles/form-inputs.css';

.company-settings-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.audit-tip {
  padding: 16rpx 30rpx;
  font-size: 26rpx;
  color: #999;
  background: #f8f8f8;
}

.form-upload.disabled,
.resource-file-upload.disabled {
  pointer-events: none;
  opacity: 0.8;
}

.page-content {
  padding-bottom: 60rpx;
}

.form-section {
  background: #ffffff;
  margin: 20rpx;
  padding: 30rpx;
  border-radius: 16rpx;
}

.form-item {
  margin-bottom: 30rpx;
}

.form-item.section-label {
  margin-top: 24rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.mode-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.mode-option {
  flex: 1;
  min-width: 280rpx;
  padding: 24rpx;
  border: 2rpx solid #e2e8f0;
  border-radius: 12rpx;
  background: #fff;
  box-sizing: border-box;
}

.mode-option.active {
  border-color: #667eea;
  background: #f5f3ff;
}

.mode-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  display: block;
}

.mode-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #64748b;
  line-height: 1.4;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}

.switch-row .switch-label-wrap {
  flex: 1;
  min-width: 0;
}

.switch-row .form-hint {
  margin-top: 8rpx;
  margin-bottom: 0;
}

.uploaded-image {
  width: 100%;
  height: 100%;
  border-radius: 8rpx;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 100%;
}

.upload-icon {
  font-size: 48rpx;
}

.upload-text {
  font-size: 24rpx;
  color: #999999;
}

.resource-file-upload {
  min-height: 120rpx;
  padding: 24rpx;
  background: #f8fafc;
  border: 2rpx dashed #e2e8f0;
  border-radius: 12rpx;
}

.resource-file-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  min-height: 80rpx;
}

.resource-file-has {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.resource-file-icon {
  font-size: 40rpx;
}

.resource-file-name {
  flex: 1;
  font-size: 28rpx;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-file-remove {
  font-size: 26rpx;
  color: #ef4444;
  padding: 8rpx 16rpx;
}

.banner-section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.banner-item {
  position: relative;
  border-radius: 12rpx;
  overflow: hidden;
  border: 2rpx solid #e0e0e0;
}

.banner-image {
  width: 100%;
  height: 300rpx;
}

.banner-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
  padding: 20rpx;
  display: flex;
  gap: 20rpx;
  justify-content: flex-end;
}

.banner-action-btn {
  padding: 8rpx 20rpx;
  background: rgba(255, 255, 255, 0.9);
  color: #333333;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.banner-action-btn.delete {
  background: rgba(255, 77, 79, 0.9);
  color: #ffffff;
}

.add-banner-btn {
  border: 2rpx dashed #d0d0d0;
  border-radius: 12rpx;
  padding: 60rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  background: #fafafa;
}

.add-icon {
  font-size: 64rpx;
  color: #999999;
}

.add-text {
  font-size: 28rpx;
  color: #999999;
}

.footer-actions {
  padding: 30rpx;
  background: #ffffff;
  display: flex;
  gap: 20rpx;
}

.save-btn,
.cancel-btn {
  flex: 1;
  padding: 24rpx;
  border-radius: 8rpx;
  font-size: 32rpx;
  border: none;
}

.save-btn {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
}

.cancel-btn {
  background: #f0f0f0;
  color: #666666;
}

.form-hint {
  margin-top: 8rpx;
  font-size: 24rpx;
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
  padding: 30rpx;
  overflow-y: auto;
  flex: 1;
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
