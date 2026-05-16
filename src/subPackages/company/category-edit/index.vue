<template>
  <view class="category-edit-page">
    <view class="page-content">
      <view class="form-section">
        <view class="form-item">
          <view class="form-label">分类名称 <text class="required">*</text></view>
          <input 
            class="form-input" 
            v-model="form.name" 
            placeholder="请输入分类名称"
            maxlength="20"
          />
        </view>

        <view class="form-item">
          <view class="form-label">分类图标 <text class="required">*</text></view>
          <view class="form-upload square" @click="uploadIcon">
            <image 
              v-if="form.icon_url" 
              :src="form.icon_url" 
              class="uploaded-image"
              mode="aspectFill"
            />
            <view v-else class="upload-placeholder">
              <text class="upload-icon">📷</text>
              <text class="upload-text">点击上传图标</text>
            </view>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">分类类型 <text class="required">*</text></view>
          <view class="option-row">
            <view
              v-for="(label, idx) in categoryTypes"
              :key="label"
              class="option-chip"
              :class="{ active: categoryTypeIndex === idx }"
              @click="onCategoryTypeChange(idx)"
            >
              {{ label }}
            </view>
          </view>
          <view v-if="form.type === 'package'" class="form-hint">套餐分类固定为顶级，无需设置父级</view>
        </view>

        <view v-show="form.type === 'product'" class="form-item">
          <view class="form-label">父级分类</view>
          <view class="parent-selector-tap" @click="showParentPicker = true">
            <text :class="{ placeholder: !form.parent_categories && !selectedParentInfo }">{{ selectedParentDisplay }}</text>
            <text class="parent-arrow">›</text>
          </view>
        </view>

    <CategoryPicker
      :show="showParentPicker"
      :selectedCategoryId="form.parent_categories"
      categoryType="product"
      :allowClear="true"
      @update:show="showParentPicker = $event"
      @select="onParentSelect"
    />

        <view v-show="form.type === 'product'" class="form-item">
          <view class="form-label">展示方式</view>
          <view class="option-row">
            <view
              v-for="(label, idx) in routeUiStyles"
              :key="label"
              class="option-chip"
              :class="{ active: routeUiStyleIndex === idx }"
              @click="onRouteUiStyleChange(idx)"
            >
              {{ label }}
            </view>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">排序 <text class="required">*</text></view>
          <input 
            class="form-input" 
            type="number" 
            v-model="form.sort_order" 
            placeholder="数字越小越靠前"
          />
        </view>
      </view>

      <view class="footer-actions">
        <button class="save-btn" @click="handleSave">保存</button>
        <button class="cancel-btn" @click="handleCancel">取消</button>
      </view>
    </view>

    <UploadProgressOverlay :show="uploading" :progress="progress" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { companyInfo } from '@/store/userStore';
import { getCategoryTree, getCategoryDetail, createCategory, updateCategory } from '@/api/category-management';
import CategoryPicker from '@/components/CategoryPicker.vue';
import { useImageUploadWithProgress } from '../utils/useImageUploadWithProgress';
import UploadProgressOverlay from '@/components/UploadProgressOverlay.vue';

const { uploading, progress, chooseAndUploadImage } = useImageUploadWithProgress();

const categoryId = ref<number | null>(null);
const form = ref({
  name: '',
  icon_url: '',
  parent_categories: undefined as number | undefined,
  level: 0,
  route_ui_style: 'categories' as 'categories' | 'products',
  sort_order: 0,
  type: 'product' as 'product' | 'package',
});
const categories = ref<any[]>([]);
const routeUiStyles = ['继续展示分类', '展示产品'];
const routeUiStyleIndex = ref(0);
const categoryTypes = ['产品分类', '套餐分类'];
const categoryTypeIndex = ref(0);
const showParentPicker = ref(false);
const selectedParentInfo = ref<{ id: number; name: string } | null>(null);

// 在树中根据 id 查找分类名称（用于编辑时展示已选父级）
function findCategoryNameById(cats: any[], id: number): string | null {
  if (!cats || !id) return null;
  for (const c of cats) {
    if (Number(c.id) === Number(id)) return c.name || null;
    if (c.categories?.length) {
      const found = findCategoryNameById(c.categories, id);
      if (found) return found;
    }
  }
  return null;
}

// 当前选中的父级展示文案
const selectedParentDisplay = computed(() => {
  if (form.value.parent_categories === undefined || form.value.parent_categories === null) {
    return '顶级分类（无父级）';
  }
  if (selectedParentInfo.value && selectedParentInfo.value.id === form.value.parent_categories) {
    return selectedParentInfo.value.name;
  }
  const name = findCategoryNameById(categories.value, form.value.parent_categories);
  return name ?? '顶级分类（无父级）';
});

// 父级选择（复用 CategoryPicker）
const onParentSelect = (category: { id: number; name: string; level?: number } | null) => {
  if (category && categoryId.value && category.id === categoryId.value) {
    uni.showToast({ title: '不能选择自身为父级', icon: 'none' });
    return;
  }
  if (category == null) {
    form.value.parent_categories = undefined;
    form.value.level = 0;
    selectedParentInfo.value = null;
  } else {
    form.value.parent_categories = category.id;
    form.value.level = (category.level ?? 0) + 1;
    selectedParentInfo.value = { id: category.id, name: category.name || '' };
  }
  showParentPicker.value = false;
};

// 加载分类树
const loadCategories = async () => {
  if (!companyInfo.value?.id) return;
  try {
    categories.value = await getCategoryTree(companyInfo.value.id);
  } catch (error) {
    console.error('加载分类失败:', error);
  }
};

// 加载分类详情
const loadCategoryDetail = async () => {
  if (!categoryId.value) return;
  try {
    const category = await getCategoryDetail(categoryId.value);
    if (category) {
      form.value = {
        name: category.name,
        icon_url: category.icon_url,
        parent_categories: category.parent_categories || undefined,
        level: category.level,
        route_ui_style: category.route_ui_style,
        sort_order: category.sort_order,
        type: category.type || 'product',
      };
      routeUiStyleIndex.value = category.route_ui_style === 'products' ? 1 : 0;
      categoryTypeIndex.value = category.type === 'package' ? 1 : 0;
      selectedParentInfo.value = null;
    }
  } catch (error: any) {
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none',
    });
  }
};

// 上传图标（带进度）
const uploadIcon = async () => {
  try {
    const url = await chooseAndUploadImage({ ext: '.jpg' });
    form.value.icon_url = url;
  } catch (error: any) {
    if (error?.message && !error.message.includes('取消')) {
      uni.showToast({ title: error.message || '上传失败', icon: 'none' });
    }
  }
};

// 分类类型选择：套餐分类固定为顶级、默认展示方式为「展示产品」
const onCategoryTypeChange = (index: number) => {
  categoryTypeIndex.value = index;
  form.value.type = index === 1 ? 'package' : 'product';
  if (form.value.type === 'package') {
    form.value.parent_categories = undefined;
    form.value.level = 0;
    form.value.route_ui_style = 'products';
    routeUiStyleIndex.value = 1;
  }
};

// 展示方式选择
const onRouteUiStyleChange = (index: number) => {
  routeUiStyleIndex.value = index;
  form.value.route_ui_style = index === 1 ? 'products' : 'categories';
};

// 保存
const handleSave = async () => {
  if (!form.value.name || !form.value.icon_url) {
    uni.showToast({
      title: '请填写分类名称和图标',
      icon: 'none',
    });
    return;
  }

  if (!companyInfo.value?.id) {
    uni.showToast({
      title: '公司信息不存在',
      icon: 'none',
    });
    return;
  }

  try {
    const payload = { ...form.value, company_companies: companyInfo.value.id };
    if (payload.type === 'package') {
      payload.parent_categories = undefined;
      payload.level = 0;
      payload.route_ui_style = 'products';
    }
    const categoryData = payload;

    if (categoryId.value) {
      await updateCategory(categoryId.value, categoryData);
    } else {
      await createCategory(categoryData);
    }

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
  }
};

// 取消
const handleCancel = () => {
  uni.navigateBack();
};

onLoad((options?: { id?: string }) => {
  if (options?.id) {
    categoryId.value = Number(options.id);
  }
  loadCategories();
  if (categoryId.value) {
    loadCategoryDetail();
  }
});
</script>

<style scoped>
@import '@/styles/form-inputs.css';

.category-edit-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: env(safe-area-inset-bottom, 0);
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

.form-hint {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #999999;
}

.option-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.option-chip {
  padding: 20rpx 32rpx;
  font-size: 28rpx;
  color: #666;
  background: #f5f5f5;
  border-radius: 12rpx;
  border: 2rpx solid transparent;
}

.option-chip.active {
  background: #e8ebf7;
  color: #667eea;
  border-color: #667eea;
  font-weight: 500;
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

/* 父级分类（点击打开 CategoryPicker） */
.parent-selector-tap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #333;
}

.parent-selector-tap .placeholder {
  color: #999;
}

.parent-arrow {
  color: #999;
  font-size: 32rpx;
}
</style>
