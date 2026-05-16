<template>
  <view class="package-list-page">
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
          <button v-if="!isViewOnly" class="add-btn" @click="goToAddPackage">+ 添加</button>
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
          placeholder="搜索套餐名称"
          placeholder-class="search-placeholder"
        />
      </view>
    </view>

    <!-- 套餐列表（仅此区域可滚动） -->
    <scroll-view
      scroll-y
      class="package-list-scroll"
      @scrolltolower="loadPackages()"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="loadPackages(true)"
    >
    <view class="package-list">
      <view 
        v-for="pkg in filteredPackages" 
        :key="pkg.id"
        class="package-item"
      >
        <view class="package-item-main" @click="onPackageClick(pkg)">
          <image 
            class="package-image" 
            :src="pkg.cover_image_url" 
            mode="aspectFill"
          ></image>
          <view class="package-info">
            <view class="package-name">{{ pkg.name }}</view>
            <text v-if="getCategoryPath(pkg.category) !== '未分类'" class="package-cat-path">{{ getCategoryPath(pkg.category) }}</text>
            <view class="package-meta">
              <text class="sku-count">{{ pkg.package_product_skus?.length || 0 }}个商品</text>
              <text class="status" :class="{ 'status-shelved': pkg.is_shelved }">
                {{ pkg.is_shelved ? '已下架' : '已上架' }}
              </text>
              <text v-if="isFromDefaultCompany(pkg)" class="tag-system">系统配置</text>
            </view>
            <view v-if="pkg.description" class="package-desc">
              {{ pkg.description }}
            </view>
          </view>
          <view v-if="!isViewOnly" class="package-actions">
            <template v-if="isFromDefaultCompany(pkg)">
              <view v-if="isPackageHidden(pkg)" class="action-btn unhide" @click.stop="handleUnhidePackage(pkg)">取消隐藏</view>
              <view v-else class="action-btn hide" @click.stop="handleHidePackage(pkg)">隐藏</view>
            </template>
            <template v-else>
              <view class="action-btn" @click.stop="toggleShelve(pkg)">
                {{ pkg.is_shelved ? '上架' : '下架' }}
              </view>
              <view class="action-btn delete" @click.stop="handleDelete(pkg)">删除</view>
            </template>
          </view>
        </view>
        <view class="item-entry-row">
          <template v-if="!isViewOnly && !isFromDefaultCompany(pkg)">
            <text class="entry-link" @click.stop="goToEditPackage(pkg.id)">编辑</text>
            <text class="entry-divider">|</text>
          </template>
          <text class="entry-link" @click.stop="goToPreviewPackage(pkg.id)">预览</text>
        </view>
      </view>

      <!-- 搜索无结果 -->
      <view v-if="packages.length > 0 && filteredPackages.length === 0 && !loading" class="empty-state">
        <text class="empty-text">未找到匹配「{{ searchKeyword }}」的套餐</text>
      </view>
      <!-- 空状态 -->
      <view v-else-if="packages.length === 0 && !loading" class="empty-state">
        <text class="empty-text">暂无套餐</text>
        <button class="empty-btn" @click="goToAddPackage">添加套餐</button>
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
      category-type="package"
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
import { getPackageList, getPackageListWithCompanyHidden, getPackageListMultiCompany, deletePackage, updatePackage } from '@/subPackages/company/api/package';
import { getDefaultCompanyIdCached } from '@/api/config/index';
import { getCompanyDetailCached, updateCompany } from '@/subPackages/company/api/platform';
import CategoryPicker from '@/components/CategoryPicker.vue';
import { exportPackagesToExcel } from '../utils/exportExcel';

const packages = ref<any[]>([]);
const loading = ref(false);
const currentTab = ref<'all' | 'shelved' | 'unshelved'>('all');
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
const selectedScope = ref<'all' | 'mine' | 'headquarters'>('all');
const defaultCompanyId = ref<number | null>(null);
const hiddenPackageIds = ref<number[]>([]);
const searchKeyword = ref('');
const showCategoryFilter = ref(false);
const filterCategoryId = ref<number | null>(null);
const filterCategoryLabel = ref('全部分类');
const visibilityFilter = ref<'all' | 'visible' | 'hidden'>('all');
const refreshing = ref(false);

// 超级管理员从公司管理点进来时传入的 companyId（核查只读）
const viewCompanyId = ref<number | null>(null);
const effectiveCompanyId = () => viewCompanyId.value ?? companyInfo.value?.id ?? null;
const categoryFilterCompanyId = computed(() => effectiveCompanyId());
/** 核查入口只读：不显示添加/编辑/删除/上架下架，仅可预览 */
const isViewOnly = computed(() => !!viewCompanyId.value);

function isFromDefaultCompany(pkg: any): boolean {
  const myId = companyInfo.value?.id;
  const defaultId = defaultCompanyId.value;
  return !!(defaultId && myId && defaultId !== myId && pkg._companyId === defaultId);
}

function isPackageHidden(pkg: any): boolean {
  return hiddenPackageIds.value.includes(Number(pkg.id));
}

function selectScope(scope: 'all' | 'mine' | 'headquarters') {
  selectedScope.value = scope;
  filterCategoryId.value = null;
  filterCategoryLabel.value = '全部分类';
  loadPackages(true);
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
  loadPackages(true);
}

function activeCategoryFilterId(): number | undefined {
  return filterCategoryId.value == null ? undefined : filterCategoryId.value;
}

function onPackageClick(pkg: any) {
  if (isViewOnly.value || isFromDefaultCompany(pkg)) {
    goToPreviewPackage(pkg.id);
    return;
  }
  goToEditPackage(pkg.id);
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

// 先按「展示中/已隐藏」筛选
const visibilityFilteredPackages = computed(() => {
  const list = packages.value;
  if (visibilityFilter.value === 'all') return list;
  if (visibilityFilter.value === 'visible') {
    return list.filter((p: any) => !isFromDefaultCompany(p) || !isPackageHidden(p));
  }
  return list.filter((p: any) => isFromDefaultCompany(p) && isPackageHidden(p));
});

// 再按关键词过滤（名称、介绍）
const filteredPackages = computed(() => {
  const kw = (searchKeyword.value || '').trim().toLowerCase();
  const list = visibilityFilteredPackages.value;
  if (!kw) return list;
  return list.filter((p: any) => {
    const name = (p.name || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    return name.includes(kw) || desc.includes(kw);
  });
});

// 加载套餐列表（全部 = 当前公司 + 系统配置公司；只看自己公司 = 仅当前公司）
const loadPackages = async (reset = false) => {
  if (loading.value || (!hasMore.value && !reset)) {
    return;
  }

  const myId = effectiveCompanyId();
  if (!myId) {
    uni.showToast({ title: '公司信息不存在', icon: 'none' });
    return;
  }

  const catFilterId = activeCategoryFilterId();

  if (reset) {
    page.value = 1;
    hasMore.value = true;
    defaultCompanyId.value = await getDefaultCompanyIdCached();
    if (selectedScope.value === 'mine') {
      const merged = await getPackageListWithCompanyHidden({
        companyId: myId,
        categoryId: catFilterId,
        limit: pageSize,
        offset: 0,
      });
      hiddenPackageIds.value = merged.hiddenPackageIds;
      let filtered = (merged.packages || []).map((p: any) => ({ ...p, _companyId: myId }));
      if (currentTab.value === 'shelved') filtered = filtered.filter((p: any) => !p.is_shelved);
      else if (currentTab.value === 'unshelved') filtered = filtered.filter((p: any) => p.is_shelved);
      packages.value = filtered;
      hasMore.value = merged.total > filtered.length;
      if (filtered.length > 0) page.value = 2;
      loading.value = false;
      refreshing.value = false;
      uni.stopPullDownRefresh();
      return;
    }
    const companyDetail = await getCompanyDetailCached(myId);
    const hidden = (companyDetail as any)?.hidden_package_ids;
    hiddenPackageIds.value = Array.isArray(hidden) ? hidden.map((id: any) => Number(id)) : [];
  }

  loading.value = true;
  if (reset) refreshing.value = true;

  try {
    if (selectedScope.value === 'headquarters' && defaultCompanyId.value && defaultCompanyId.value !== myId) {
      const result = await getPackageList({
        companyId: defaultCompanyId.value,
        categoryId: catFilterId,
        limit: pageSize,
        offset: (page.value - 1) * pageSize,
      });
      let list = (result.packages || []).map((p: any) => ({ ...p, _companyId: defaultCompanyId.value }));
      if (currentTab.value === 'shelved') list = list.filter((p: any) => !p.is_shelved);
      else if (currentTab.value === 'unshelved') list = list.filter((p: any) => p.is_shelved);
      if (reset) packages.value = list;
      else packages.value = [...packages.value, ...list];
      if (result.total <= packages.value.length) hasMore.value = false;
      else page.value++;
    } else if (selectedScope.value === 'all' && defaultCompanyId.value && defaultCompanyId.value !== myId) {
      const multi = await getPackageListMultiCompany({
        companyIds: [myId, defaultCompanyId.value],
        hiddenForCompanyId: myId,
        categoryId: catFilterId,
        limit: pageSize,
        offset: (page.value - 1) * pageSize,
      });
      hiddenPackageIds.value = multi.hiddenPackageIds;
      let list = multi.packages || [];
      if (currentTab.value === 'shelved') list = list.filter((p: any) => !p.is_shelved);
      else if (currentTab.value === 'unshelved') list = list.filter((p: any) => p.is_shelved);
      if (reset) packages.value = list;
      else packages.value = [...packages.value, ...list];
      hasMore.value = list.length === pageSize && packages.value.length < multi.total;
      if (list.length > 0) page.value++;
    } else {
      const result = await getPackageList({
        companyId: myId,
        categoryId: catFilterId,
        limit: pageSize,
        offset: (page.value - 1) * pageSize,
      });
      let list = (result.packages || []).map((p: any) => ({ ...p, _companyId: myId }));
      if (currentTab.value === 'shelved') list = list.filter((p: any) => !p.is_shelved);
      else if (currentTab.value === 'unshelved') list = list.filter((p: any) => p.is_shelved);
      if (reset) packages.value = list;
      else packages.value = [...packages.value, ...list];
      if (result.total <= packages.value.length) hasMore.value = false;
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

// 导出 Excel：拉取当前公司 + 系统配置公司全部套餐（按当前上架筛选）后导出，核查进入时也包含两家数据
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
    const all: any[] = [];
    for (const cid of companyIds) {
      let offset = 0;
      while (true) {
        const res = await getPackageList({ companyId: cid, limit, offset });
        const list = (res.packages || []).map((p: any) => ({ ...p, _companyId: cid }));
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
    await exportPackagesToExcel(filtered);
    uni.showToast({ title: '导出成功，请查看文档', icon: 'success' });
  } catch (e: any) {
    uni.hideLoading();
    const msg = e?.errMsg ?? e?.message ?? '导出失败';
    uni.showToast({ title: msg, icon: 'none', duration: 3000 });
  }
};

// 切换上架/下架
const toggleShelve = async (pkg: any) => {
  try {
    await updatePackage(pkg.id, {
      is_shelved: !pkg.is_shelved,
    });
    uni.showToast({
      title: pkg.is_shelved ? '已上架' : '已下架',
      icon: 'success',
    });
    loadPackages(true);
  } catch (error: any) {
    uni.showToast({ title: error.message || '操作失败', icon: 'none' });
  }
};

// 删除套餐
const handleDelete = (pkg: any) => {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除套餐"${pkg.name}"吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await deletePackage(pkg.id);
          uni.showToast({ title: '删除成功', icon: 'success' });
          loadPackages(true);
        } catch (error: any) {
          uni.showToast({ title: error.message || '删除失败', icon: 'none' });
        }
      }
    },
  });
};

// 隐藏系统配置公司的套餐
async function handleHidePackage(pkg: any) {
  const myId = companyInfo.value?.id;
  if (!myId) return;
  try {
    const company = await getCompanyDetailCached(myId) as any;
    const cur = (company?.hidden_package_ids || []).map((id: any) => Number(id));
    if (cur.includes(Number(pkg.id))) {
      uni.showToast({ title: '已隐藏', icon: 'none' });
      return;
    }
    await updateCompany(myId, { hidden_package_ids: [...cur, Number(pkg.id)] });
    uni.showToast({ title: '已加入隐藏名单', icon: 'success' });
    loadPackages(true);
  } catch (error: any) {
    uni.showToast({ title: (error as any)?.message || '操作失败', icon: 'none' });
  }
}

// 取消隐藏系统配置公司的套餐
async function handleUnhidePackage(pkg: any) {
  const myId = companyInfo.value?.id;
  if (!myId) return;
  try {
    const company = await getCompanyDetailCached(myId) as any;
    const cur = (company?.hidden_package_ids || []).map((id: any) => Number(id));
    const next = cur.filter((id: number) => id !== Number(pkg.id));
    if (next.length === cur.length) {
      uni.showToast({ title: '未在隐藏名单中', icon: 'none' });
      return;
    }
    await updateCompany(myId, { hidden_package_ids: next });
    uni.showToast({ title: '已取消隐藏', icon: 'success' });
    loadPackages(true);
  } catch (error: any) {
    uni.showToast({ title: (error as any)?.message || '操作失败', icon: 'none' });
  }
}

// 跳转到添加套餐
const goToAddPackage = () => {
  uni.navigateTo({
    url: '/subPackages/company/package-edit/index',
  });
};

// 跳转到编辑套餐
const goToEditPackage = (packageId: number) => {
  uni.navigateTo({
    url: `/subPackages/company/package-edit/index?id=${packageId}`,
  });
};

// 跳转预览套餐（详情页）
const goToPreviewPackage = (packageId: number) => {
  uni.navigateTo({
    url: `/pages/package-detail/index?id=${packageId}`,
  });
};

watch(currentTab, () => {
  loadPackages(true);
});

onLoad((options?: { companyId?: string }) => {
  if (options?.companyId) {
    viewCompanyId.value = Number(options.companyId);
  }
});

onShow(() => {
  loadPackages(true);
});

onPullDownRefresh(() => {
  loadPackages(true);
});

onReachBottom(() => {
  loadPackages();
});
</script>

<style scoped>
.package-list-page {
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

.package-cat-path {
  display: block;
  font-size: 22rpx;
  color: #888;
  margin-top: 4rpx;
  line-height: 1.35;
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

.view-only-tip {
  font-size: 26rpx;
  color: #999;
}

.visibility-row {
  margin-top: 4rpx;
}

.package-list-scroll {
  flex: 1;
  height: 0;
  overflow: hidden;
}

.package-list {
  padding: 20rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333333;
  padding: 24rpx 0 12rpx;
  margin-top: 8rpx;
}

.section-title:first-child {
  margin-top: 0;
  padding-top: 0;
}

.package-item {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.package-item-main {
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

.package-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background: #f0f0f0;
}

.package-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.package-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333333;
}

.package-meta {
  font-size: 24rpx;
  color: #999999;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.status {
  color: #ff6b6b;
}

.status-shelved {
  color: #51cf66;
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

.package-desc {
  font-size: 26rpx;
  color: #666666;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.package-actions {
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

.action-btn.hide {
  background: #fff7e6;
  color: #d48806;
}

.action-btn.unhide {
  background: #e6f7ff;
  color: #1890ff;
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
