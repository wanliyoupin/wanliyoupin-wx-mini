<template>
  <view class="product-list-page">
    <!-- 顶部操作栏 -->
    <view class="header-bar">
      <view class="header-actions">
        <view class="filter-tabs">
          <view 
            class="tab-item" 
            :class="{ active: currentTab === 'all' }"
            @click="currentTab = 'all'"
          >
            全部
          </view>
          <view 
            class="tab-item" 
            :class="{ active: currentTab === 'shelved' }"
            @click="currentTab = 'shelved'"
          >
            已上架
          </view>
          <view 
            class="tab-item" 
            :class="{ active: currentTab === 'unshelved' }"
            @click="currentTab = 'unshelved'"
          >
            已下架
          </view>
        </view>
        <view class="action-group">
          <button class="export-btn" @click="handleExportExcel">导出</button>
          <button v-if="!isViewOnly" class="add-btn" @click="goToAddProduct">+ 添加</button>
        </view>
        <text v-if="isViewOnly" class="view-only-tip">仅查看，不可操作</text>
      </view>
      <view class="scope-row">
        <view 
          class="scope-tab" 
          :class="{ active: selectedScope === 'all' }"
          @click="selectScope('all')"
        >
          全部
        </view>
        <view 
          class="scope-tab" 
          :class="{ active: selectedScope === 'mine' }"
          @click="selectScope('mine')"
        >
          只看自己公司
        </view>
        <view 
          class="scope-tab" 
          :class="{ active: selectedScope === 'headquarters' }"
          @click="selectScope('headquarters')"
        >
          只看总部
        </view>
      </view>
      <view v-if="selectedScope !== 'mine'" class="scope-row visibility-row">
        <view 
          class="scope-tab" 
          :class="{ active: visibilityFilter === 'all' }"
          @click="visibilityFilter = 'all'"
        >
          全部
        </view>
        <view 
          class="scope-tab" 
          :class="{ active: visibilityFilter === 'visible' }"
          @click="visibilityFilter = 'visible'"
        >
          展示中
        </view>
        <view 
          class="scope-tab" 
          :class="{ active: visibilityFilter === 'hidden' }"
          @click="visibilityFilter = 'hidden'"
        >
          已隐藏
        </view>
      </view>
      <view class="category-filter-row">
        <text class="category-filter-label">分类</text>
        <view class="category-picker-display" @click="showCategoryFilter = true">
          <text class="category-picker-text">{{ filterCategoryLabel }}</text>
          <text class="category-picker-arrow">▼</text>
        </view>
      </view>
      <view class="search-row">
        <input :adjust-position="false"
          class="search-input"
          v-model="searchKeyword"
          confirm-type="search"
          placeholder="搜索商品名称（名称/描述）"
          placeholder-class="search-placeholder"
          @confirm="onSearchConfirm"
        />
      </view>
    </view>

    <!-- 商品列表（仅此区域可滚动） -->
    <scroll-view
      scroll-y
      class="product-list-scroll"
      @scrolltolower="loadProducts()"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="loadProducts(true)"
    >
    <view class="product-list">
      <view 
        v-for="product in filteredProducts" 
        :key="product.id"
        class="product-item"
      >
        <view class="product-item-main" @click="onProductClick(product)">
          <image 
            class="product-image" 
            :src="product.cover_image_url" 
            mode="aspectFill"
          ></image>
          <view class="product-info">
            <view class="product-name">{{ product.name }}</view>
            <text v-if="getCategoryPath(product.category) !== '未分类'" class="product-cat-path">{{ getCategoryPath(product.category) }}</text>
            <view class="product-meta">
              <text class="sku-count">{{ product.product_skus?.length || 0 }}个规格</text>
              <text class="status" :class="{ 'status-shelved': !product.is_shelved }">
                {{ product.is_shelved ? '已下架' : '已上架' }}
              </text>
              <text v-if="isFromDefaultCompany(product)" class="tag-system">系统配置</text>
            </view>
          </view>
          <view v-if="!isViewOnly" class="product-actions">
            <template v-if="isFromDefaultCompany(product)">
              <view v-if="isProductHidden(product)" class="action-btn unhide" @click.stop="handleUnhideProduct(product)">取消隐藏</view>
              <view v-else class="action-btn hide" @click.stop="handleHideProduct(product)">隐藏</view>
            </template>
            <template v-else>
              <view class="action-btn" @click.stop="toggleShelve(product)">
                {{ product.is_shelved ? '上架' : '下架' }}
              </view>
              <view class="action-btn delete" @click.stop="handleDelete(product)">
                删除
              </view>
            </template>
          </view>
        </view>
        <view class="item-entry-row">
          <template v-if="!isViewOnly && !isFromDefaultCompany(product)">
            <text class="entry-link" @click.stop="goToEditProduct(product.id)">编辑</text>
            <text class="entry-divider">|</text>
          </template>
          <text class="entry-link" @click.stop="goToPreviewProduct(product.id)">预览</text>
        </view>
      </view>

      <!-- 关键词无结果（已由服务端筛选） -->
      <view v-if="products.length === 0 && listKeywordParam() && !loading" class="empty-state">
        <text class="empty-text">未找到匹配「{{ searchKeyword.trim() }}」的商品</text>
      </view>
      <!-- 展示中/已隐藏 筛空 -->
      <view v-else-if="products.length > 0 && filteredProducts.length === 0 && !loading" class="empty-state">
        <text class="empty-text">当前展示条件下暂无可显示商品</text>
      </view>
      <!-- 空状态 -->
      <view v-else-if="products.length === 0 && !loading" class="empty-state">
        <text class="empty-text">暂无商品</text>
        <button class="empty-btn" @click="goToAddProduct">添加商品</button>
      </view>

      <!-- 加载中 -->
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>
    </view>
    </scroll-view>

    <CategoryPicker
      :show="showCategoryFilter"
      :selected-category-id="filterCategoryId"
      category-type="product"
      :allow-clear="true"
      clear-option-text="全部分类"
      :hide-scope-bar="true"
      :list-scope="selectedScope"
      :company-id-override="categoryFilterCompanyId"
      @update:show="showCategoryFilter = $event"
      @select="onCategoryFilterSelect"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app';
import { companyInfo } from '@/store/userStore';
import { getProductList, getProductListWithCompanyHidden, getProductListMultiCompany, deleteProduct, updateProduct } from '@/subPackages/company/api/product';
import { getDefaultCompanyIdCached } from '@/api/config/index';
import { getCompanyDetailCached, updateCompany } from '@/subPackages/company/api/platform';
import CategoryPicker from '@/components/CategoryPicker.vue';
import { exportProductsToExcel } from '../utils/exportExcel';

const products = ref<any[]>([]);
const loading = ref(false);
const currentTab = ref<'all' | 'shelved' | 'unshelved'>('all');
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
const selectedScope = ref<'all' | 'mine' | 'headquarters'>('all');
const defaultCompanyId = ref<number | null>(null);
const hiddenProductIds = ref<number[]>([]);
const searchKeyword = ref('');
const showCategoryFilter = ref(false);
const filterCategoryId = ref<number | null>(null);
const filterCategoryLabel = ref('全部分类');
/** 展示中/已隐藏筛选（仅在选择「全部」或「只看总部」时显示；只看自己公司无隐藏概念） */
const visibilityFilter = ref<'all' | 'visible' | 'hidden'>('all');
const refreshing = ref(false);

// 超级管理员从公司管理点进来时传入的 companyId（仅查看，不编辑时用）
const viewCompanyId = ref<number | null>(null);
const effectiveCompanyId = () => viewCompanyId.value ?? companyInfo.value?.id ?? null;
/** CategoryPicker 合并树 / mine 时用，与列表 effective公司一致 */
const categoryFilterCompanyId = computed(() => effectiveCompanyId());
/** 核查入口只读：不显示添加/编辑/删除/上架下架，仅可预览 */
const isViewOnly = computed(() => !!viewCompanyId.value);

function isFromDefaultCompany(product: any): boolean {
  const myId = companyInfo.value?.id;
  const defaultId = defaultCompanyId.value;
  return !!(defaultId && myId && defaultId !== myId && product._companyId === defaultId);
}

function isProductHidden(product: any): boolean {
  return hiddenProductIds.value.includes(Number(product.id));
}

function selectScope(scope: 'all' | 'mine' | 'headquarters') {
  selectedScope.value = scope;
  filterCategoryId.value = null;
  filterCategoryLabel.value = '全部分类';
  loadProducts(true);
}

function onCategoryFilterSelect(payload: any | null) {
  if (!payload) {
    filterCategoryId.value = null;
    filterCategoryLabel.value = '全部分类';
  } else {
    const n = Number(payload.id);
    filterCategoryId.value = Number.isFinite(n) ? n : null;
    filterCategoryLabel.value = payload.pathLabel || payload.name || '全部分类';
  }
  loadProducts(true);
}

function onProductClick(product: any) {
  if (isViewOnly.value || isFromDefaultCompany(product)) {
    goToPreviewProduct(product.id);
    return;
  }
  goToEditProduct(product.id);
}

// 根据分类的父子关系拼出完整目录路径（一级/二级/三级）
function getCategoryPath(cat: any): string {
  if (!cat?.name) return '未分类';
  const parts: string[] = [];
  let c: any = cat;
  while (c?.name) {
    parts.unshift(String(c.name).trim());
    c = c.category;
  }
  return parts.length ? parts.join(' / ') : '未分类';
}

function activeCategoryFilterId(): number | undefined {
  return filterCategoryId.value == null ? undefined : filterCategoryId.value;
}

// 先按「展示中/已隐藏」筛选（仅对系统配置公司的商品生效）
const visibilityFilteredProducts = computed(() => {
  const list = products.value;
  if (visibilityFilter.value === 'all') return list;
  if (visibilityFilter.value === 'visible') {
    return list.filter((p: any) => !isFromDefaultCompany(p) || !isProductHidden(p));
  }
  // 已隐藏：只显示系统配置公司且已隐藏的
  return list.filter((p: any) => isFromDefaultCompany(p) && isProductHidden(p));
});

/** 关键词由服务端 Hasura 过滤，此处仅做展示中/已隐藏 */
const filteredProducts = computed(() => visibilityFilteredProducts.value);

function listKeywordParam(): string | undefined {
  const s = (searchKeyword.value || '').trim();
  return s.length > 0 ? s : undefined;
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
function onSearchConfirm() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
  loadProducts(true);
}
watch(searchKeyword, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadProducts(true);
  }, 400);
});

// 加载商品列表（支持「全部」= 当前公司 + 系统配置公司；「只看自己公司」= 仅当前公司）
const loadProducts = async (reset = false) => {
  if (loading.value || (!hasMore.value && !reset)) {
    return;
  }

  const myId = effectiveCompanyId();
  if (!myId) {
    uni.showToast({ title: '公司信息不存在', icon: 'none' });
    return;
  }

  const catFilterId = activeCategoryFilterId();
  const kw = listKeywordParam();

  if (reset) {
    page.value = 1;
    hasMore.value = true;
    defaultCompanyId.value = await getDefaultCompanyIdCached();
    // 「只看自己公司」时用合并接口一次拿 hidden + 列表
    if (selectedScope.value === 'mine') {
      const merged = await getProductListWithCompanyHidden({
        companyId: myId,
        categoryId: catFilterId,
        limit: pageSize,
        offset: 0,
        keyword: kw,
      });
      hiddenProductIds.value = merged.hiddenProductIds;
      let filtered = (merged.products || []).map((p: any) => ({ ...p, _companyId: myId }));
      if (currentTab.value === 'shelved') filtered = filtered.filter((p: any) => !p.is_shelved);
      else if (currentTab.value === 'unshelved') filtered = filtered.filter((p: any) => p.is_shelved);
      products.value = filtered;
      hasMore.value = merged.total > filtered.length;
      if (filtered.length > 0) page.value = 2;
      loading.value = false;
      refreshing.value = false;
      uni.stopPullDownRefresh();
      return;
    }
    const companyDetail = await getCompanyDetailCached(myId);
    const hidden = companyDetail?.hidden_product_ids;
    hiddenProductIds.value = Array.isArray(hidden) ? hidden.map((id: any) => Number(id)) : [];
  }

  loading.value = true;
  if (reset) refreshing.value = true;

  try {
    if (selectedScope.value === 'headquarters' && defaultCompanyId.value && defaultCompanyId.value !== myId) {
      // 只看总部：仅系统配置公司
      const result = await getProductList({
        companyId: defaultCompanyId.value,
        categoryId: catFilterId,
        limit: pageSize,
        offset: (page.value - 1) * pageSize,
        keyword: kw,
      });
      let list = (result.products || []).map((p: any) => ({ ...p, _companyId: defaultCompanyId.value }));
      if (currentTab.value === 'shelved') list = list.filter((p: any) => !p.is_shelved);
      else if (currentTab.value === 'unshelved') list = list.filter((p: any) => p.is_shelved);
      if (reset) products.value = list;
      else products.value = [...products.value, ...list];
      if (result.total <= products.value.length) hasMore.value = false;
      else page.value++;
    } else if (selectedScope.value === 'all' && defaultCompanyId.value && defaultCompanyId.value !== myId) {
      // 全部：单次请求，where company_companies _in [myId, defaultId]
      const multi = await getProductListMultiCompany({
        companyIds: [myId, defaultCompanyId.value],
        hiddenForCompanyId: myId,
        categoryId: catFilterId,
        limit: pageSize,
        offset: (page.value - 1) * pageSize,
        keyword: kw,
      });
      hiddenProductIds.value = multi.hiddenProductIds;
      let list = multi.products || [];
      if (currentTab.value === 'shelved') list = list.filter((p: any) => !p.is_shelved);
      else if (currentTab.value === 'unshelved') list = list.filter((p: any) => p.is_shelved);
      if (reset) products.value = list;
      else products.value = [...products.value, ...list];
      hasMore.value = list.length === pageSize && products.value.length < multi.total;
      if (list.length > 0) page.value++;
    } else {
      // 只看自己公司：仅当前公司，保持原有分页
      const where: any = {
        companyId: myId,
        categoryId: catFilterId,
        limit: pageSize,
        offset: (page.value - 1) * pageSize,
        keyword: kw,
      };
      const result = await getProductList(where);
      let pageList = result.products || [];
      if (currentTab.value === 'shelved') pageList = pageList.filter((p: any) => !p.is_shelved);
      else if (currentTab.value === 'unshelved') pageList = pageList.filter((p: any) => p.is_shelved);
      const tagged = pageList.map((p: any) => ({ ...p, _companyId: myId }));
      if (reset) products.value = tagged;
      else products.value = [...products.value, ...tagged];
      if (result.total <= products.value.length) hasMore.value = false;
      else page.value++;
    }
  } catch (error: any) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
    refreshing.value = false;
    uni.stopPullDownRefresh();
  }
};

// 导出 Excel：拉取当前公司 + 系统配置公司全部商品（按当前上架筛选）后导出，核查进入时也包含两家数据
const handleExportExcel = async () => {
  const myId = effectiveCompanyId();
  if (!myId) {
    uni.showToast({ title: '公司信息不存在', icon: 'none' });
    return;
  }
  uni.showLoading({ title: '准备导出...' });
  try {
    const defaultId = await getDefaultCompanyIdCached();
    const companyIds = defaultId && defaultId !== myId ? [myId, defaultId] : [myId];
    const limit = 200;
    const exportKw = listKeywordParam();
    const all: any[] = [];
    for (const cid of companyIds) {
      let offset = 0;
      while (true) {
        const res = await getProductList({ companyId: cid, limit, offset, keyword: exportKw });
        const list = (res.products || []).map((p: any) => ({ ...p, _companyId: cid }));
        all.push(...list);
        if (list.length < limit) break;
        offset += limit;
      }
    }
    let filtered = all;
    if (currentTab.value === 'shelved') filtered = all.filter((p: any) => !p.is_shelved);
    else if (currentTab.value === 'unshelved') filtered = all.filter((p: any) => p.is_shelved);
    uni.hideLoading();
    if (filtered.length === 0) {
      uni.showToast({ title: '暂无数据可导出', icon: 'none' });
      return;
    }
    await exportProductsToExcel(filtered);
    uni.showToast({ title: '导出成功，请查看文档', icon: 'success' });
  } catch (e: any) {
    uni.hideLoading();
    const msg = e?.errMsg ?? e?.message ?? '导出失败';
    uni.showToast({ title: msg, icon: 'none', duration: 3000 });
  }
};

// 切换上架/下架
const toggleShelve = async (product: any) => {
  try {
    await updateProduct(product.id, {
      is_shelved: !product.is_shelved,
    });

    uni.showToast({
      title: product.is_shelved ? '已上架' : '已下架',
      icon: 'success',
    });

    // 重新加载列表
    loadProducts(true);
  } catch (error: any) {
    uni.showToast({
      title: error.message || '操作失败',
      icon: 'none',
    });
  }
};

// 删除商品
const handleDelete = (product: any) => {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除商品"${product.name}"吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteProduct(product.id);
          uni.showToast({ title: '删除成功', icon: 'success' });
          loadProducts(true);
        } catch (error: any) {
          uni.showToast({ title: error.message || '删除失败', icon: 'none' });
        }
      }
    },
  });
};

// 隐藏系统配置公司的商品（写入当前公司的 hidden_product_ids）
async function handleHideProduct(product: any) {
  const myId = companyInfo.value?.id;
  if (!myId) return;
  try {
    const company = await getCompanyDetailCached(myId);
    const cur = (company?.hidden_product_ids || []).map((id: any) => Number(id));
    if (cur.includes(Number(product.id))) {
      uni.showToast({ title: '已隐藏', icon: 'none' });
      return;
    }
    await updateCompany(myId, { hidden_product_ids: [...cur, Number(product.id)] });
    uni.showToast({ title: '已加入隐藏名单', icon: 'success' });
    loadProducts(true);
  } catch (error: any) {
    uni.showToast({ title: (error as any)?.message || '操作失败', icon: 'none' });
  }
}

async function handleUnhideProduct(product: any) {
  const myId = companyInfo.value?.id;
  if (!myId) return;
  try {
    const company = await getCompanyDetailCached(myId);
    const cur = (company?.hidden_product_ids || []).map((id: any) => Number(id));
    const next = cur.filter((id: number) => id !== Number(product.id));
    if (next.length === cur.length) {
      uni.showToast({ title: '未在隐藏名单中', icon: 'none' });
      return;
    }
    await updateCompany(myId, { hidden_product_ids: next });
    uni.showToast({ title: '已取消隐藏', icon: 'success' });
    loadProducts(true);
  } catch (error: any) {
    uni.showToast({ title: (error as any)?.message || '操作失败', icon: 'none' });
  }
}

// 跳转到添加商品
const goToAddProduct = () => {
  uni.navigateTo({
    url: '/subPackages/company/product-edit/index',
  });
};

// 跳转到编辑商品
const goToEditProduct = (productId: number) => {
  uni.navigateTo({
    url: `/subPackages/company/product-edit/index?id=${productId}`,
  });
};

const goToPreviewProduct = (productId: number) => {
  uni.navigateTo({
    url: `/pages/product-detail/index?id=${productId}`,
  });
};

// 监听tab切换
watch(currentTab, () => {
  loadProducts(true);
});

onLoad((options?: { companyId?: string }) => {
  if (options?.companyId) {
    viewCompanyId.value = Number(options.companyId);
  }
});

onShow(() => {
  loadProducts(true);
});

onPullDownRefresh(() => {
  loadProducts(true);
});

onReachBottom(() => {
  loadProducts();
});
</script>

<style scoped>
.product-list-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  height: 100vh;
  background: #f5f5f5;
  box-sizing: border-box;
}

.header-bar {
  background: #ffffff;
  padding: 14rpx 24rpx 18rpx;
  border-bottom: 1rpx solid #e8e8e8;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-height: 56rpx;
}

.filter-tabs {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.tab-item {
  padding: 6rpx 14rpx;
  font-size: 24rpx;
  color: #666666;
  border-radius: 20rpx;
  transition: all 0.2s;
  flex-shrink: 0;
}

.tab-item.active {
  background: #667eea;
  color: #ffffff;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.export-btn {
  padding: 6rpx 14rpx;
  font-size: 24rpx;
  color: #667eea;
  background: transparent;
  border: 1rpx solid #667eea;
  border-radius: 20rpx;
  line-height: 1.4;
}

.export-btn::after {
  border: none;
}

.add-btn {
  padding: 6rpx 14rpx;
  font-size: 24rpx;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border-radius: 20rpx;
  border: none;
  line-height: 1.4;
}

.add-btn::after {
  border: none;
}

.view-only-tip {
  font-size: 24rpx;
  color: #999;
}

.scope-row {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
  margin-top: 0;
}

.scope-tab {
  padding: 4rpx 12rpx;
  font-size: 22rpx;
  color: #666;
  background: #f5f5f5;
  border-radius: 16rpx;
}

.scope-tab.active {
  background: #e8ebf7;
  color: #667eea;
  font-weight: 500;
}

.category-filter-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 4rpx;
}

.category-filter-label {
  font-size: 24rpx;
  color: #666;
  flex-shrink: 0;
}

.category-filter-row .category-picker-display {
  flex: 1;
  min-width: 0;
}

.category-picker-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56rpx;
  padding: 0 20rpx;
  background: #f5f5f5;
  border-radius: 28rpx;
}

.category-picker-text {
  font-size: 26rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.category-picker-arrow {
  font-size: 22rpx;
  color: #999;
  margin-left: 12rpx;
  flex-shrink: 0;
}

.search-row {
  margin-top: 4rpx;
}

.search-input {
  width: 100%;
  height: 56rpx;
  padding: 0 20rpx;
  background: #f5f5f5;
  border-radius: 28rpx;
  font-size: 26rpx;
  color: #333;
  box-sizing: border-box;
}

.search-placeholder {
  color: #999;
}

.product-cat-path {
  display: block;
  font-size: 22rpx;
  color: #888;
  margin-top: 4rpx;
  line-height: 1.35;
}

.tag-system {
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  background: #fff7e6;
  color: #d48806;
  border-radius: 4rpx;
}

.tag-hidden {
  font-size: 20rpx;
  color: #999;
  padding: 2rpx 8rpx;
  background: #f5f5f5;
  border-radius: 4rpx;
}

.action-btn.hide {
  background: #fff7e6;
  color: #d48806;
}

.action-btn.unhide {
  background: #e6f7ff;
  color: #1890ff;
}

.product-list-scroll {
  flex: 1;
  height: 0;
  overflow: hidden;
}

.visibility-row {
  margin-top: 4rpx;
}

.product-list {
  padding: 20rpx;
}

.product-item {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.product-item-main {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.item-entry-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-top: 8rpx;
  border-top: 1rpx solid #f0f0f0;
  font-size: 24rpx;
}

.entry-link {
  color: #667eea;
}

.entry-divider {
  color: #ddd;
}

.product-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background: #f0f0f0;
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.product-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-meta {
  display: flex;
  gap: 20rpx;
  font-size: 24rpx;
  color: #999999;
}

.status {
  color: #ff6b6b;
}

.status-shelved {
  color: #51cf66;
}

.product-actions {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.action-btn {
  padding: 8rpx 20rpx;
  background: #f0f0f0;
  color: #333333;
  border-radius: 8rpx;
  font-size: 24rpx;
  text-align: center;
}

.action-btn.delete {
  background: #fff5f5;
  color: #ff6b6b;
}

.empty-state {
  padding: 100rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: #999999;
  display: block;
  margin-bottom: 40rpx;
}

.empty-btn {
  padding: 20rpx 40rpx;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border-radius: 12rpx;
  font-size: 28rpx;
  border: none;
}

.loading-state {
  padding: 40rpx 0;
  text-align: center;
  color: #999999;
  font-size: 28rpx;
}
</style>
