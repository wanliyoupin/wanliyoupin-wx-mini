<template>
  <view class="package-edit-page">
    <view class="page-content">
      <!-- 基本信息 -->
      <view class="section">
        <view class="section-title">基本信息</view>
        
        <view class="form-item">
          <view class="form-label">套餐名称 <text class="required">*</text></view>
          <input 
            class="form-input" 
            v-model="form.name" 
            placeholder="请输入套餐名称"
            maxlength="50"
          />
        </view>

        <view class="form-item">
          <view class="form-label">封面图 <text class="required">*</text></view>
          <view class="form-upload square" @click="uploadCoverImage">
            <image 
              v-if="form.cover_image_url" 
              :src="form.cover_image_url" 
              class="uploaded-image"
              mode="aspectFill"
            />
            <view v-else class="upload-placeholder">
              <text class="upload-icon">📷</text>
              <text class="upload-text">点击上传封面图</text>
            </view>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">套餐介绍</view>
          <textarea 
            class="form-textarea" 
            v-model="form.description" 
            placeholder="请输入套餐介绍"
            maxlength="500"
          />
        </view>

        <view class="form-item">
          <view class="form-label">标签</view>
          <input 
            class="form-input" 
            v-model="form.tags" 
            placeholder="多个标签用｜分隔，如：新品｜热卖"
          />
        </view>

        <view class="form-item">
          <view class="form-label">套餐分类</view>
          <view class="category-selector" @click="showCategoryPicker = true">
            <text v-if="selectedCategory" class="selected-category">
              {{ selectedCategory.pathLabel || selectedCategory.name }}
            </text>
            <text v-else class="category-placeholder">请选择套餐分类（可选）</text>
            <text class="category-arrow">›</text>
          </view>
        </view>
        <view class="form-item">
          <view class="form-label">排序值</view>
          <input 
            class="form-input" 
            type="number" 
            v-model="form.sort_order" 
            placeholder="数值越小越靠前，默认0"
          />
        </view>
      </view>

      <!-- 套餐商品 -->
      <view class="section">
        <view class="section-title">
          套餐商品
          <button class="add-sku-btn" @click="showSkuModal = true">+ 添加商品规格</button>
        </view>
        <view class="sku-list">
          <view 
            v-for="(item, index) in packageSkus" 
            :key="item.id || index"
            class="sku-item"
          >
            <view class="sku-info">
              <text class="sku-name">{{ item.product_sku?.name || '未知商品' }}</text>
              <text class="sku-price">¥{{ item.product_sku?.price || 0 }}</text>
              <text class="sku-quantity">数量: {{ item.quantity }}</text>
            </view>
            <view class="sku-actions">
              <view class="sku-btn" @click="editSku(index)">编辑</view>
              <view class="sku-btn delete" @click="removeSku(index)">删除</view>
            </view>
          </view>
          <view v-if="packageSkus.length === 0" class="empty-skus">
            <text>暂无商品，请添加</text>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="footer-actions">
        <button class="save-btn" @click="handleSave">保存</button>
        <button class="cancel-btn" @click="handleCancel">取消</button>
      </view>
    </view>

    <CategoryPicker
      :show="showCategoryPicker"
      :selectedCategoryId="form.category_categories"
      categoryType="package"
      :allowClear="true"
      @update:show="showCategoryPicker = $event"
      @select="onCategorySelect"
    />

    <!-- SKU选择弹窗 -->
    <view v-if="showSkuModal" class="modal-overlay" @click="showSkuModal = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">选择商品规格</text>
          <text class="modal-close" @click="showSkuModal = false">×</text>
        </view>
        <view class="modal-body">
          <view class="sku-search">
            <input 
              class="search-input" 
              v-model="skuSearchKeyword" 
              placeholder="输入商品名称或规格搜索"
              @input="onSkuSearchInput"
            />
          </view>
          <scroll-view
            scroll-y
            class="sku-select-list"
            @scrolltolower="onSkuListScrollToLower"
          >
            <view v-if="skuSearchLoading && availableSkus.length === 0" class="sku-search-loading">
              <text>搜索中...</text>
            </view>
            <template v-else>
              <view 
                v-for="sku in availableSkus" 
                :key="sku.id"
                class="sku-select-item"
                @click="selectSku(sku)"
              >
                <text class="sku-select-name">{{ sku.name }}</text>
                <text class="sku-select-price">¥{{ sku.price }}</text>
              </view>
              <view v-if="availableSkus.length === 0" class="empty-skus">
                <text>{{ (skuSearchKeyword || '').trim() ? '未找到匹配的规格' : '暂无规格' }}</text>
              </view>
              <view v-else-if="skuSearchHasMore && skuSearchLoading" class="sku-search-loading">
                <text>加载中...</text>
              </view>
              <view v-else-if="skuSearchHasMore && !skuSearchLoading" class="sku-load-more-row">
                <button class="sku-load-more-btn" type="button" @click="runSkuSearch(false)">加载更多</button>
              </view>
              <view v-else-if="availableSkus.length > 0 && !skuSearchHasMore" class="sku-load-more-hint">
                <text>没有更多了</text>
              </view>
            </template>
          </scroll-view>
        </view>
      </view>
    </view>

    <!-- SKU数量编辑弹窗：单独样式避免数量输入框被遮挡 -->
    <view v-if="showQuantityModal" class="modal-overlay" @click="showQuantityModal = false">
      <view class="modal-content quantity-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">设置数量</text>
          <text class="modal-close" @click="showQuantityModal = false">×</text>
        </view>
        <view class="modal-body quantity-modal-body">
          <view class="form-item">
            <view class="label">商品规格</view>
            <text class="sku-name-display">{{ editingSkuItem?.product_sku?.name }}</text>
          </view>
          <view class="form-item quantity-input-wrap">
            <view class="label">数量 <text class="required">*</text></view>
            <input 
              class="input quantity-input" 
              type="number" 
              v-model="skuQuantity" 
              placeholder="请输入数量"
            />
          </view>
          <view class="form-item">
            <view class="label">排序值</view>
            <input 
              class="input quantity-input" 
              type="number" 
              v-model="skuSortOrder" 
              placeholder="数值越小越靠前"
            />
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn" @click="saveQuantity">保存</button>
          <button class="modal-btn cancel" @click="showQuantityModal = false">取消</button>
        </view>
      </view>
    </view>

    <UploadProgressOverlay :show="uploading" :progress="progress" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { companyInfo } from '@/store/userStore';
import { getPackageDetail, createPackage, updatePackage, addPackageSku, updatePackageSku, deletePackageSku } from '@/subPackages/company/api/package';
import { searchProductsWithSkus } from '@/subPackages/company/api/product';
import { getCompanyDetailCached } from '@/subPackages/company/api/platform';
import { getDefaultCompanyIdCached } from '@/api/config/index';
import CategoryPicker from '@/components/CategoryPicker.vue';
import { useImageUploadWithProgress } from '../utils/useImageUploadWithProgress';
import UploadProgressOverlay from '@/components/UploadProgressOverlay.vue';

const { uploading, progress, chooseAndUploadImage } = useImageUploadWithProgress();

const packageId = ref<number | null>(null);
const form = ref({
  name: '',
  cover_image_url: '',
  description: '',
  tags: '',
  category_categories: undefined as number | undefined,
  sort_order: undefined as number | undefined,
});
const packageSkus = ref<any[]>([]);
const loading = ref(false);
const showCategoryPicker = ref(false);
const selectedCategoryInfo = ref<{ id: number; name: string; pathLabel?: string } | null>(null);

// SKU 选择相关：先搜索再选择，分页加载
const showSkuModal = ref(false);
const skuSearchKeyword = ref('');
const availableSkus = ref<any[]>([]);
const skuSearchLoading = ref(false);
const skuSearchHasMore = ref(true);
const skuSearchOffset = ref(0);
const skuSearchPageSize = 20;
const defaultCompanyIdForSearch = ref<number | null>(null);
const hiddenProductIds = ref<number[]>([]);
const hiddenAndDefaultLoaded = ref(false);

// 数量编辑相关
const showQuantityModal = ref(false);
const editingSkuIndex = ref(-1);
const editingSkuItem = ref<any>(null);
const skuQuantity = ref('');
const skuSortOrder = ref('');

// 获取当前公司隐藏商品 id 与默认公司 id（用于搜索后过滤，只拉一次）
const ensureHiddenAndDefaultCompany = async () => {
  const currentCompanyId = companyInfo.value?.id;
  if (!currentCompanyId) return;
  if (hiddenAndDefaultLoaded.value) return;
  try {
    defaultCompanyIdForSearch.value = await getDefaultCompanyIdCached();
    const company = await getCompanyDetailCached(currentCompanyId);
    const raw = company?.hidden_product_ids;
    hiddenProductIds.value = Array.isArray(raw) ? raw.map((id: any) => Number(id)) : [];
  } catch (_) {}
  hiddenAndDefaultLoaded.value = true;
};

// 搜索规格（支持无关键词时加载首屏；分页；排除已隐藏商品与已加入套餐的规格）
const runSkuSearch = async (reset = true) => {
  const currentCompanyId = companyInfo.value?.id;
  if (!currentCompanyId) return;
  await ensureHiddenAndDefaultCompany();
  if (reset) {
    skuSearchOffset.value = 0;
    skuSearchHasMore.value = true;
    availableSkus.value = [];
  }
  if (!skuSearchHasMore.value && !reset) return;

  const keyword = (skuSearchKeyword.value || '').trim();
  skuSearchLoading.value = true;
  try {
    const res = await searchProductsWithSkus({
      keyword: keyword || undefined,
      companyId: currentCompanyId,
      defaultCompanyId: defaultCompanyIdForSearch.value ?? undefined,
      limit: skuSearchPageSize,
      offset: reset ? 0 : skuSearchOffset.value,
    });

    const addedIds = addedSkuIds.value;
    const hiddenIds = hiddenProductIds.value;
    const filtered = (res.skus || []).filter(
      (s: any) =>
        !addedIds.has(Number(s.id)) &&
        (hiddenIds.length === 0 || !s.product_id || !hiddenIds.includes(Number(s.product_id)))
    );

    if (reset) availableSkus.value = filtered;
    else availableSkus.value = [...availableSkus.value, ...filtered];

    const nextOffset = (reset ? 0 : skuSearchOffset.value) + (res.products?.length ?? 0);
    skuSearchOffset.value = nextOffset;
    skuSearchHasMore.value = (res.products?.length ?? 0) >= skuSearchPageSize && nextOffset < (res.total ?? 0);
  } catch (e) {
    console.error('搜索规格失败', e);
    uni.showToast({ title: '搜索失败', icon: 'none' });
  } finally {
    skuSearchLoading.value = false;
  }
};

let skuSearchTimer: ReturnType<typeof setTimeout> | null = null;
const onSkuSearchInput = () => {
  if (skuSearchTimer) clearTimeout(skuSearchTimer);
  skuSearchTimer = setTimeout(() => {
    skuSearchTimer = null;
    runSkuSearch(true);
  }, 300);
};

const onSkuListScrollToLower = () => {
  if (skuSearchLoading.value || !skuSearchHasMore.value) return;
  runSkuSearch(false);
};

// 从接口返回的 category 父子链拼出完整路径
function getCategoryPathFromApi(cat: any): string {
  if (!cat?.name) return '';
  const parts: string[] = [];
  let c: any = cat;
  while (c?.name) {
    parts.unshift(String(c.name).trim());
    c = c.category;
  }
  return parts.join(' / ');
}

// 计算选中的分类（用于展示名称或完整路径）
const selectedCategory = computed(() => {
  if (form.value.category_categories == null) return null;
  if (selectedCategoryInfo.value && selectedCategoryInfo.value.id === form.value.category_categories) {
    const pathLabel = selectedCategoryInfo.value.pathLabel || selectedCategoryInfo.value.name;
    return { name: selectedCategoryInfo.value.name, pathLabel };
  }
  return null;
});

// 选择分类（来自 CategoryPicker，含 pathLabel）
const onCategorySelect = (category: { id: number; name: string; pathLabel?: string } | null) => {
  if (category == null) {
    form.value.category_categories = undefined;
    selectedCategoryInfo.value = null;
  } else {
    form.value.category_categories = category.id;
    selectedCategoryInfo.value = {
      id: category.id,
      name: category.name || '',
      pathLabel: category.pathLabel,
    };
  }
  showCategoryPicker.value = false;
};

// 已加入套餐的规格 id 集合，用于选择时排除（避免重复添加）
const addedSkuIds = computed(() => {
  const ids = new Set<number>();
  packageSkus.value.forEach((item: any) => {
    const id = item.product_sku?.id;
    if (id != null) ids.add(Number(id));
  });
  return ids;
});

// 打开「添加商品规格」弹窗时：默认加载第一页数据
watch(showSkuModal, (visible) => {
  if (visible) {
    availableSkus.value = [];
    skuSearchOffset.value = 0;
    skuSearchHasMore.value = true;
    runSkuSearch(true);
  }
});

// 选择SKU
const selectSku = (sku: any) => {
  editingSkuItem.value = {
    product_sku: sku,
    quantity: 1,
  };
  skuQuantity.value = '1';
  // 新增时排序值默认为当前列表长度（接在最后）
  skuSortOrder.value = String(packageSkus.value.length);
  editingSkuIndex.value = -1;
  showSkuModal.value = false;
  showQuantityModal.value = true;
};

// 编辑SKU数量
const editSku = (index: number) => {
  editingSkuIndex.value = index;
  editingSkuItem.value = packageSkus.value[index];
  const item = packageSkus.value[index];
  skuQuantity.value = String(item.quantity);
  skuSortOrder.value = item.sort_order !== undefined && item.sort_order !== null ? String(item.sort_order) : '';
  showQuantityModal.value = true;
};

// 保存数量与排序
const saveQuantity = () => {
  if (!skuQuantity.value || Number(skuQuantity.value) <= 0) {
    uni.showToast({
      title: '请输入有效数量',
      icon: 'none',
    });
    return;
  }

  const quantity = Number(skuQuantity.value);
  const sortOrder = skuSortOrder.value !== '' && skuSortOrder.value !== undefined && skuSortOrder.value !== null
    ? Number(skuSortOrder.value)
    : undefined;

  if (editingSkuIndex.value >= 0) {
    // 编辑
    packageSkus.value[editingSkuIndex.value].quantity = quantity;
    if (sortOrder !== undefined) packageSkus.value[editingSkuIndex.value].sort_order = sortOrder;
  } else {
    // 新增
    packageSkus.value.push({
      ...editingSkuItem.value,
      quantity,
      ...(sortOrder !== undefined && { sort_order: sortOrder }),
    });
  }

  showQuantityModal.value = false;
  editingSkuIndex.value = -1;
  editingSkuItem.value = null;
  skuSortOrder.value = '';
};

// 删除SKU
const removeSku = async (index: number) => {
  const item = packageSkus.value[index];
  if (item.id) {
    // 已保存的，需要调用API删除
    try {
      await deletePackageSku(item.id);
      packageSkus.value.splice(index, 1);
      uni.showToast({
        title: '删除成功',
        icon: 'success',
      });
    } catch (error: any) {
      uni.showToast({
        title: error.message || '删除失败',
        icon: 'none',
      });
    }
  } else {
    // 未保存的，直接删除
    packageSkus.value.splice(index, 1);
  }
};

// 上传封面图（带进度）
const uploadCoverImage = async () => {
  try {
    const url = await chooseAndUploadImage({ ext: '.jpg' });
    form.value.cover_image_url = url;
  } catch (error: any) {
    if (error?.message && !error.message.includes('取消')) {
      uni.showToast({ title: error.message || '上传失败', icon: 'none' });
    }
  }
};

// 加载套餐详情
const loadPackageDetail = async () => {
  if (!packageId.value) return;
  loading.value = true;
  try {
    const pkg = await getPackageDetail(packageId.value);
    if (pkg) {
      form.value = {
        name: pkg.name,
        cover_image_url: pkg.cover_image_url,
        description: pkg.description || '',
        tags: pkg.tags || '',
        category_categories: pkg.category_categories || undefined,
        sort_order: pkg.sort_order != null ? Number(pkg.sort_order) : undefined,
      };
      // 用接口返回的 category 父子链回显，并拼出完整路径
      if (pkg.category && pkg.category_categories != null) {
        const pathLabel = getCategoryPathFromApi(pkg.category);
        selectedCategoryInfo.value = {
          id: pkg.category.id,
          name: pkg.category.name || '',
          pathLabel: pathLabel || undefined,
        };
      } else {
        selectedCategoryInfo.value = null;
      }
      packageSkus.value = pkg.package_product_skus || [];
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

// 保存套餐
const handleSave = async () => {
  if (!form.value.name || !form.value.cover_image_url) {
    uni.showToast({
      title: '请填写套餐名称和封面图',
      icon: 'none',
    });
    return;
  }

  if (packageSkus.value.length === 0) {
    uni.showToast({
      title: '请至少添加一个商品',
      icon: 'none',
    });
    return;
  }

  loading.value = true;

  try {
    let savedPackageId: number;

    const packagePayload: any = { ...form.value };
    if (form.value.sort_order !== undefined && form.value.sort_order !== null) {
      packagePayload.sort_order = Number(form.value.sort_order);
    }

    if (packageId.value) {
      // 更新套餐
      await updatePackage(packageId.value, packagePayload);
      savedPackageId = packageId.value;
    } else {
      // 创建套餐：必须传入当前公司 ID（packages 表外键 company_companies -> companies.id）
      const rawCompanyId = companyInfo.value?.id;
      if (rawCompanyId == null || rawCompanyId === '' || Number(rawCompanyId) <= 0) {
        uni.showToast({ title: '请先选择公司', icon: 'none' });
        loading.value = false;
        return;
      }
      const companyId = Number(rawCompanyId);
      const result = await createPackage({
        ...packagePayload,
        company_companies: companyId,
      });
      savedPackageId = result.id;
    }

    // 保存套餐SKU（按列表顺序写入 sort_order）
    const existingIds = packageSkus.value.filter(item => item.id).map(item => item.id);
    packageSkus.value.forEach((item: any, index: number) => {
      item.sort_order = item.sort_order !== undefined && item.sort_order !== null ? item.sort_order : index;
    });
    for (const item of packageSkus.value) {
      if (item.id) {
        await updatePackageSku(item.id, {
          quantity: item.quantity,
          sort_order: item.sort_order,
        });
      } else {
        await addPackageSku({
          package_packages: savedPackageId,
          product_sku_product_skus: item.product_sku.id,
          quantity: item.quantity,
          sort_order: item.sort_order,
        });
      }
    }

    uni.showToast({
      title: '保存成功',
      icon: 'success',
    });

    setTimeout(() => {
      uni.navigateBack();
    }, 1500);
  } catch (error: any) {
    const msg = error?.message || (error?.errors?.[0]?.message ?? '') || '';
    const isFkError = /foreign key|constraint-violation|constraint/i.test(msg);
    uni.showToast({
      title: isFkError ? '当前公司无效或不存在，请从公司列表重新进入后再试' : (msg || '保存失败'),
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

onLoad((options: any) => {
  if (options?.id) {
    packageId.value = Number(options.id);
  }
  if (packageId.value) {
    loadPackageDetail();
  }
});
</script>

<style scoped>
@import '@/styles/form-inputs.css';
.package-edit-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.page-content {
  padding-bottom: 60rpx;
}

.section {
  background: #ffffff;
  margin-bottom: 20rpx;
  padding: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-item {
  margin-bottom: 30rpx;
}

.label {
  font-size: 28rpx;
  color: #666666;
  margin-bottom: 16rpx;
}

.required {
  color: #ff6b6b;
}

.input {
  width: 100%;
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.textarea {
  width: 100%;
  min-height: 200rpx;
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.image-upload {
  width: 200rpx;
  height: 200rpx;
  border: 2rpx dashed #d0d0d0;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f8f8;
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
  gap: 10rpx;
}

.upload-icon {
  font-size: 48rpx;
}

.upload-text {
  font-size: 24rpx;
  color: #999999;
}

.add-sku-btn {
  padding: 10rpx 20rpx;
  background: #667eea;
  color: #ffffff;
  border-radius: 8rpx;
  font-size: 26rpx;
  border: none;
}

.sku-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.sku-item {
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sku-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.sku-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #333333;
}

.sku-price {
  font-size: 26rpx;
  color: #ff6b6b;
}

.sku-quantity {
  font-size: 24rpx;
  color: #999999;
}

.sku-actions {
  display: flex;
  gap: 10rpx;
}

.sku-btn {
  padding: 8rpx 16rpx;
  background: #ffffff;
  color: #333333;
  border-radius: 4rpx;
  font-size: 24rpx;
}

.sku-btn.delete {
  background: #fff5f5;
  color: #ff6b6b;
}

.empty-skus {
  padding: 40rpx;
  text-align: center;
  color: #999999;
  font-size: 28rpx;
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

/* 设置数量弹窗：避免数量输入框被遮挡 */
.quantity-modal {
  max-height: none;
}
.quantity-modal .quantity-modal-body {
  flex: none;
  padding: 30rpx 30rpx 40rpx;
  overflow: visible;
}
.quantity-modal .quantity-input-wrap {
  margin-bottom: 0;
}
.quantity-modal .quantity-input {
  min-height: 88rpx;
  padding: 24rpx 28rpx;
  box-sizing: border-box;
}

.sku-search {
  margin-bottom: 20rpx;
}

.search-input {
  width: 100%;
  min-height: 88rpx;
  padding: 24rpx 28rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.sku-select-list {
  max-height: 400rpx;
}

.sku-search-loading,
.sku-load-more-hint {
  padding: 24rpx;
  text-align: center;
  font-size: 26rpx;
  color: #999;
}

.sku-load-more-hint {
  padding: 16rpx;
}

.sku-load-more-row {
  padding: 20rpx;
  text-align: center;
}

.sku-load-more-btn {
  padding: 16rpx 48rpx;
  font-size: 28rpx;
  color: #667eea;
  background: #f0f4ff;
  border: 1rpx solid #667eea;
  border-radius: 24rpx;
  line-height: 1.4;
}

.sku-load-more-btn::after {
  border: none;
}

.sku-select-item {
  padding: 20rpx;
  border-bottom: 1rpx solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sku-select-name {
  font-size: 28rpx;
  color: #333333;
}

.sku-select-price {
  font-size: 26rpx;
  color: #ff6b6b;
}

.sku-name-display {
  font-size: 28rpx;
  color: #333333;
  padding: 10rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
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

.category-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.selected-category {
  color: #333333;
}

.category-placeholder {
  color: #999999;
}

.category-arrow {
  color: #999999;
  font-size: 32rpx;
}
</style>
