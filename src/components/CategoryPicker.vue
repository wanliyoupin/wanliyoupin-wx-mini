<template>
  <!-- 分类选择弹窗 -->
  <view v-if="show" class="category-picker-overlay" @click="handleClose">
    <view class="category-picker-modal" @click.stop>
      <view class="modal-header">
        <text class="modal-title">选择分类</text>
        <text class="modal-close" @click="handleClose">×</text>
      </view>
      
      <!-- 筛选选项（列表页等场景由外层切换范围时隐藏，避免重复） -->
      <view v-if="!hideScopeBar" class="filter-bar">
        <view class="filter-item" :class="{ active: selectedScope === 'all' }" @click="selectScope('all')">
          <text class="filter-text">全部</text>
        </view>
        <view class="filter-item" :class="{ active: selectedScope === 'mine' }" @click="selectScope('mine')">
          <text class="filter-text">只看当前公司</text>
        </view>
        <view class="filter-item" :class="{ active: selectedScope === 'headquarters' }" @click="selectScope('headquarters')">
          <text class="filter-text">只看总部</text>
        </view>
      </view>

      <!-- 不选分类 / 全部分类（文案可由 clearOptionText 配置） -->
      <view
        v-if="allowClear"
        class="clear-category-row"
        :class="{ active: selectedCategoryId == null }"
        @click="handleClearCategory"
      >
        <text class="clear-category-text">{{ clearOptionText }}</text>
      </view>
      
      <!-- 分类树 -->
      <scroll-view scroll-y class="category-tree">
        <view v-if="loading" class="loading-state">
          <text>加载中...</text>
        </view>
        
        <view v-else-if="displayCategories.length === 0" class="empty-state">
          <text class="empty-text">暂无分类</text>
        </view>
        
        <view v-else>
          <view 
            v-for="category in displayCategories" 
            :key="category.id"
            class="category-item"
            :class="{ 
              'has-children': category.categories && category.categories.length > 0,
              'expanded': category.expanded,
              'selected': selectedCategoryId === category.id
            }"
          >
            <view 
              class="category-main" 
              @click="toggleExpand(category)"
            >
              <view class="category-info">
                <image 
                  v-if="category.icon_url" 
                  :src="category.icon_url" 
                  class="category-icon"
                  mode="aspectFill"
                />
                <text class="category-name">{{ category.name }}</text>
              </view>
              <view class="category-actions">
                <view 
                  class="select-btn" 
                  @click.stop="selectCategory(category)"
                >
                  选择
                </view>
                <text v-if="category.categories && category.categories.length > 0" class="expand-icon">
                  {{ category.expanded ? '▼' : '▶' }}
                </text>
              </view>
            </view>
            
            <!-- 第二层子分类 -->
            <view 
              v-if="category.expanded && category.categories && category.categories.length > 0"
              class="sub-categories"
            >
              <view 
                v-for="subCategory in category.categories" 
                :key="subCategory.id"
                class="sub-category-item"
                :class="{ 
                  'selected': selectedCategoryId === subCategory.id,
                  'has-children': hasSubChildren(subCategory),
                  'expanded': subCategory.expanded
                }"
              >
                <view 
                  class="sub-category-main"
                  @click="toggleSubExpand(subCategory)"
                >
                  <view class="category-info">
                    <image 
                      v-if="subCategory.icon_url" 
                      :src="subCategory.icon_url" 
                      class="category-icon"
                      mode="aspectFill"
                    />
                    <text class="category-name">{{ subCategory.name }}</text>
                  </view>
                  <view class="category-actions">
                    <view 
                      class="select-btn" 
                      @click.stop="selectCategory(subCategory)"
                    >
                      选择
                    </view>
                    <!-- 第二层：有子节点或未加载过子节点时显示展开箭头，便于按需加载第三层 -->
                    <text 
                      v-if="hasSubChildren(subCategory)"
                      class="expand-icon"
                    >
                      {{ subCategory.expanded ? '▼' : '▶' }}
                    </text>
                  </view>
                </view>
                <!-- 第三层子分类 -->
                <view 
                  v-if="subCategory.expanded && subCategory.categories && subCategory.categories.length > 0"
                  class="sub-sub-categories"
                >
                  <view 
                    v-for="subSub in subCategory.categories" 
                    :key="subSub.id"
                    class="sub-sub-category-item"
                    :class="{ 'selected': selectedCategoryId === subSub.id }"
                  >
                    <view class="category-info">
                      <image 
                        v-if="subSub.icon_url" 
                        :src="subSub.icon_url" 
                        class="category-icon"
                        mode="aspectFill"
                      />
                      <text class="category-name">{{ subSub.name }}</text>
                    </view>
                    <view 
                      class="select-btn" 
                      @click="selectCategory(subSub)"
                    >
                      选择
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { companyInfo } from '@/store/userStore';
import { getCategoryTree as getAdminCategoryTree, getCategoryChildren as getAdminCategoryChildren } from '@/api/category-management';
import { getCategoryTree as getFrontendCategoryTree } from '@/api/category/index';
import { getDefaultCompanyIdCached } from '@/api/config/index';

interface Props {
  show: boolean;
  selectedCategoryId?: number | null;
  /** 仅展示该类型：'product' 商品分类 / 'package' 套餐分类，不传则展示全部 */
  categoryType?: 'product' | 'package' | null;
  /** 为 true 时显示「不选择分类」选项，选择后 emit select(null) */
  allowClear?: boolean;
  /** allowClear 时首行文案，默认「不选择分类」；列表筛选可设为「全部分类」 */
  clearOptionText?: string;
  /** 为 true 时隐藏顶部「全部/只看当前公司/只看总部」，由外层页面切换 listScope */
  hideScopeBar?: boolean;
  /** 与 hideScopeBar 配合：外层列表当前的「全部 / 只看自己 / 只看总部」 */
  listScope?: 'all' | 'mine' | 'headquarters' | null;
  /** 核查入口等：指定公司 id，覆盖当前登录公司（mine/合并树时用） */
  companyIdOverride?: number | null;
}

interface Emits {
  (e: 'update:show', value: boolean): void;
  (e: 'select', category: any): void;
}

const props = withDefaults(defineProps<Props>(), {
  clearOptionText: '不选择分类',
  hideScopeBar: false,
  listScope: null,
  companyIdOverride: null,
});
const emit = defineEmits<Emits>();

const categories = ref<any[]>([]);
const loading = ref(false);
const selectedScope = ref<'all' | 'mine' | 'headquarters'>('all');
const defaultCompanyId = ref<number | null>(null);

// 显示的分类（按筛选条件加载的数据）
const displayCategories = computed(() => categories.value);

function effectiveListScope(): 'all' | 'mine' | 'headquarters' {
  if (props.hideScopeBar && props.listScope != null) {
    return props.listScope;
  }
  return selectedScope.value;
}

function effectiveCompanyIdForTree(): number | null {
  return props.companyIdOverride ?? companyInfo.value?.id ?? null;
}

function addExpandState(cats: any[], useChildren = false): any[] {
  if (!Array.isArray(cats)) return [];
  return cats.map((cat: any) => {
    const children = useChildren
      ? (cat.children || cat.categories || [])
      : (cat.categories || []);
    return {
      ...cat,
      expanded: !!cat.expanded,
      categories: addExpandState(children, useChildren),
    };
  });
}

// 加载分类树
const loadCategories = async () => {
  const scope = effectiveListScope();
  const myId = effectiveCompanyIdForTree();
  if (!myId && scope !== 'headquarters') {
    categories.value = [];
    return;
  }
  if (scope === 'headquarters') {
    const defaultId = await getDefaultCompanyIdCached();
    if (!defaultId) {
      categories.value = [];
      return;
    }
    defaultCompanyId.value = defaultId;
  } else {
    defaultCompanyId.value = null;
  }

  loading.value = true;
  try {
    const categoryType = props.categoryType ?? undefined;
    if (scope === 'mine' && myId) {
      const result = await getAdminCategoryTree(myId, categoryType);
      categories.value = addExpandState(Array.isArray(result) ? result : []);
    } else if (scope === 'headquarters' && defaultCompanyId.value) {
      const result = await getAdminCategoryTree(defaultCompanyId.value, categoryType);
      categories.value = addExpandState(Array.isArray(result) ? result : []);
    } else {
      // 全部：使用前端 API（合并当前公司和默认公司的分类）
      if (!myId) {
        categories.value = [];
      } else {
        const result = await getFrontendCategoryTree(myId, categoryType ?? undefined);
        if (result && result.code === 0 && result.data) {
          categories.value = addExpandState(result.data, true);
        } else {
          categories.value = [];
        }
      }
    }
  } catch (error: any) {
    console.error('加载分类失败:', error);
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none',
    });
    categories.value = [];
  } finally {
    loading.value = false;
  }
};

function selectScope(scope: 'all' | 'mine' | 'headquarters') {
  selectedScope.value = scope;
  loadCategories();
}

// 切换展开/收起（第一层）
const toggleExpand = (category: any) => {
  category.expanded = !category.expanded;
};

// 第二层是否显示展开箭头：已有子节点，或尚未加载过子节点（便于按需加载第三层）
const hasSubChildren = (subCategory: any) => {
  if (subCategory.categories && subCategory.categories.length > 0) return true;
  if (subCategory.childrenLoaded === true) return false; // 已加载过且为空，不再显示箭头
  return true; // 未加载过，显示箭头以便展开时按需加载
};

// 切换第二层展开/收起（用于显示第三层）；若无子节点则按需拉取（保证第三层能展示）
const toggleSubExpand = async (subCategory: any) => {
  subCategory.expanded = !subCategory.expanded;
  const scope = effectiveListScope();
  const baseId = effectiveCompanyIdForTree();
  const companyId = scope === 'headquarters' ? defaultCompanyId.value : baseId;
  if (subCategory.expanded && (!subCategory.categories || subCategory.categories.length === 0) && companyId) {
    try {
      const categoryType = props.categoryType ?? undefined;
      const list = await getAdminCategoryChildren(subCategory.id, companyId, categoryType);
      subCategory.categories = (Array.isArray(list) ? list : []).map((c: any) => ({
        ...c,
        expanded: false,
        categories: [],
      }));
      subCategory.childrenLoaded = true;
    } catch (e) {
      console.error('加载子分类失败', e);
      subCategory.categories = [];
      subCategory.childrenLoaded = true;
    }
  }
};

// 在树中查找某分类从根到该节点的名称路径，用于回显完整路径
function findPathInTree(cats: any[], targetId: number, pathSoFar: string[]): string[] | null {
  if (!Array.isArray(cats)) return null;
  for (const c of cats) {
    const name = (c.name && String(c.name).trim()) || '';
    const nextPath = [...pathSoFar, name];
    if (Number(c.id) === Number(targetId)) return nextPath;
    const children = c.categories || c.children || [];
    const found = findPathInTree(children, targetId, nextPath);
    if (found) return found;
  }
  return null;
}

// 选择分类（传出 id、name、pathLabel、level 便于编辑页计算子分类 level）
const selectCategory = (category: any) => {
  const id = category?.id;
  const name = category?.name ?? '';
  const level = category?.level;
  const pathArr = id != null ? findPathInTree(categories.value, Number(id), []) : null;
  const pathLabel = pathArr && pathArr.length > 0 ? pathArr.join(' / ') : name;
  emit('select', { id, name, pathLabel, level });
  handleClose();
};

// 不选择分类（allowClear 时）
const handleClearCategory = () => {
  emit('select', null);
  handleClose();
};

// 关闭弹窗
const handleClose = () => {
  emit('update:show', false);
};

// 打开时加载；外层 listScope / 核查公司变化时在已打开状态下重新拉树
watch(
  () => [props.show, props.listScope, props.companyIdOverride, props.hideScopeBar] as const,
  ([show]) => {
    if (show) {
      loadCategories();
    }
  },
);
</script>

<style scoped>
.category-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.category-picker-modal {
  width: 90%;
  max-width: 600rpx;
  max-height: 80vh;
  background: #ffffff;
  border-radius: 24rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.2);
  animation: modal-fade-in 0.3s ease;
}

@keyframes modal-fade-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  padding: 30rpx 40rpx;
  border-bottom: 1rpx solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
}

.modal-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #1e293b;
}

.modal-close {
  font-size: 48rpx;
  color: #94a3b8;
  line-height: 0.8;
  padding: 10rpx;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding: 20rpx 40rpx;
  border-bottom: 1rpx solid #f1f5f9;
  background: #ffffff;
}

.filter-item {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 24rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 20rpx;
  font-size: 24rpx;
  color: #64748b;
  transition: all 0.3s;
}

.filter-item.active {
  background: #e0e7ff;
  border-color: #667eea;
  color: #667eea;
}

.filter-icon {
  font-size: 24rpx;
}

.filter-text {
  font-size: 24rpx;
}

.clear-category-row {
  padding: 24rpx 40rpx;
  border-bottom: 1rpx solid #f1f5f9;
  background: #f8fafc;
}

.clear-category-row.active {
  background: #e0e7ff;
}

.clear-category-text {
  font-size: 28rpx;
  color: #667eea;
}

.category-tree {
  flex: 1;
  padding: 20rpx 0;
  max-height: 50vh;
}

.loading-state,
.empty-state {
  padding: 60rpx;
  text-align: center;
  color: #94a3b8;
  font-size: 28rpx;
}

.category-item {
  border-bottom: 1rpx solid #f1f5f9;
}

.category-item.selected {
  background: #f0f7ff;
}

.category-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 40rpx;
  transition: background 0.2s;
}

.category-main:active {
  background: #f8fafc;
}

.category-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.category-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 8rpx;
}

.category-name {
  font-size: 28rpx;
  color: #1e293b;
}

.category-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.select-btn {
  padding: 8rpx 20rpx;
  background: #667eea;
  color: #ffffff;
  border-radius: 20rpx;
  font-size: 24rpx;
  transition: all 0.3s;
}

.select-btn:active {
  opacity: 0.8;
}

.expand-icon {
  font-size: 24rpx;
  color: #94a3b8;
  width: 32rpx;
  text-align: center;
}

.sub-categories {
  background: #f8fafc;
  padding-left: 40rpx;
}

.sub-category-item {
  border-top: 1rpx solid #f1f5f9;
}

.sub-category-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 40rpx;
  transition: background 0.2s;
}

.sub-category-main:active {
  background: #f1f5f9;
}

.sub-category-item.selected .sub-category-main {
  background: #e0e7ff;
}

.sub-sub-categories {
  background: #f1f5f9;
  padding-left: 56rpx;
}

.sub-sub-category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 40rpx;
  border-top: 1rpx solid #e2e8f0;
  transition: background 0.2s;
}

.sub-sub-category-item.selected {
  background: #e0e7ff;
}

.sub-sub-category-item:active {
  background: #e2e8f0;
}
</style>
