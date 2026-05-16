<template>
  <view class="category-list-page">
    <!-- 顶部操作栏 -->
    <view class="header-bar">
      <view class="filter-row">
        <view class="filter-tabs">
          <view 
            class="filter-tab" 
            :class="{ active: selectedType === null }"
            @click="selectType(null)"
          >
            全部
          </view>
          <view 
            class="filter-tab" 
            :class="{ active: selectedType === 'product' }"
            @click="selectType('product')"
          >
            产品
          </view>
          <view 
            class="filter-tab" 
            :class="{ active: selectedType === 'package' }"
            @click="selectType('package')"
          >
            套餐
          </view>
        </view>
        <view class="scope-tabs">
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
        <view v-if="selectedScope !== 'mine'" class="scope-tabs visibility-row">
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
      </view>
      <button v-if="!isViewOnly" class="add-btn" @click="goToAddCategory">+ 添加</button>
      <text v-else class="view-only-tip">仅查看，不可操作</text>
    </view>
    <view class="route-style-hint">
      <text class="route-style-hint-text">
        展示模式：紫色标签为「展示产品」（小程序直接列出本分类商品）；灰色为「继续展示分类」（先进子分类）。
      </text>
    </view>

    <!-- 分类树：仅此区域可滚动 -->
    <scroll-view scroll-y class="category-list-scroll" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="loadCategories">
    <view class="category-tree">
      <view
        v-for="item in visibilityFlatList"
        :key="item.node.id"
        class="category-row"
        :class="[`depth-${item.depth}`, { 'has-children': hasChildren(item.node) }]"
        :style="{ paddingLeft: (item.depth * 32 + 24) + 'rpx' }"
      >
        <view 
          class="row-inner"
          @click="toggleExpand(item.node)"
        >
          <view class="expand-area">
            <text 
              v-if="hasChildren(item.node)" 
              class="expand-icon"
              :class="{ expanded: item.node.expanded }"
            >
              {{ item.node.expanded ? '▼' : '▶' }}
            </text>
            <text v-else class="expand-placeholder"></text>
          </view>
          <image 
            v-if="item.node.icon_url" 
            :src="item.node.icon_url" 
            class="row-icon"
            mode="aspectFill"
          />
          <view v-else class="row-icon placeholder-icon">
            <text class="placeholder-text">{{ (item.node.name || '')[0] }}</text>
          </view>
            <view class="row-info">
            <text class="row-name">{{ item.node.name }}</text>
            <view class="row-meta">
              <text class="row-type" :class="getTypeClass(item.node.type)">
                {{ getTypeText(item.node.type) }}
              </text>
              <text class="row-level">L{{ item.node.level }}</text>
              <text
                class="row-route-style"
                :class="item.node.route_ui_style === 'products' ? 'route-products' : 'route-categories'"
              >
                {{ item.node.route_ui_style === 'products' ? '展示产品' : '继续展示分类' }}
              </text>
              <text v-if="isFromDefaultCompany(item.node)" class="row-tag-system">系统配置</text>
              <text class="row-counts">{{ getCategoryCounts(item.node) }}</text>
            </view>
          </view>
          <view v-if="!isViewOnly" class="row-actions" @click.stop>
            <template v-if="isFromDefaultCompany(item.node)">
              <view v-if="isCategoryHidden(item.node)" class="action-btn unhide" @click="handleUnhideCategory(item.node)">取消隐藏</view>
              <view v-else class="action-btn hide" @click="handleHideCategory(item.node)">隐藏</view>
            </template>
            <template v-else>
              <view class="action-btn" @click="goToEditCategory(item.node)">编辑</view>
              <view class="action-btn delete" @click="handleDelete(item.node)">删除</view>
            </template>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="visibilityFlatList.length === 0 && !loading" class="empty-state">
        <text class="empty-icon">📁</text>
        <text class="empty-text">暂无分类</text>
        <text class="empty-hint">{{ isViewOnly ? '当前为查看模式' : '点击右上角添加分类' }}</text>
        <button v-if="!isViewOnly" class="empty-btn" @click="goToAddCategory">添加分类</button>
      </view>

      <!-- 加载中 -->
      <view v-if="loading" class="loading-state">
        <view class="loading-spinner"></view>
        <text>加载中...</text>
      </view>
    </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { companyInfo } from '@/store/userStore';
import { getCategoryTree, getCategoryTreeMultiCompany, deleteCategory } from '@/api/category-management';
import { getDefaultCompanyIdCached } from '@/api/config/index';
import { getCompanyDetailCached, updateCompany } from '@/subPackages/company/api/platform';

/** 超级管理员从公司列表点进来时传入的 companyId（查看指定公司的分类，仅查看不可操作） */
const viewCompanyId = ref<number | null>(null);
const effectiveCompanyId = () => viewCompanyId.value ?? companyInfo.value?.id ?? null;
/** 是否为核查入口进入的仅查看模式 */
const isViewOnly = computed(() => !!viewCompanyId.value);

const categories = ref<any[]>([]);
const allCategories = ref<any[]>([]);
const loading = ref(false);
const selectedType = ref<'product' | 'package' | null>(null);
const selectedScope = ref<'all' | 'mine' | 'headquarters'>('all');
const defaultCompanyId = ref<number | null>(null);
/** 当前公司的隐藏分类 id 列表（用于展示已隐藏状态与取消隐藏） */
const hiddenCategoryIds = ref<number[]>([]);
const visibilityFilter = ref<'all' | 'visible' | 'hidden'>('all');
const refreshing = ref(false);

/** 给树节点递归打上 _companyId */
function tagTree(nodes: any[], companyId: number): any[] {
  return nodes.map((node) => ({
    ...node,
    _companyId: companyId,
    categories: node.categories ? tagTree(node.categories, companyId) : [],
  }));
}

/** 是否来自系统配置公司（且当前不是自己公司） */
function isFromDefaultCompany(node: any): boolean {
  const myId = effectiveCompanyId();
  const defaultId = defaultCompanyId.value;
  return !!(defaultId && myId && defaultId !== myId && node._companyId === defaultId);
}

/** 是否已隐藏（仅对系统配置公司的分类有效） */
function isCategoryHidden(node: any): boolean {
  return hiddenCategoryIds.value.includes(Number(node.id));
}

// 确保每个节点都有 expanded，默认展开
function ensureExpanded(nodes: any[]): any[] {
  return nodes.map((cat: any) => ({
    ...cat,
    expanded: cat.expanded !== false,
    categories: cat.categories ? ensureExpanded(cat.categories) : [],
  }));
}

// 根据展开状态扁平化树为列表（只显示当前展开路径下的节点）
function flattenTree(nodes: any[], depth: number): { node: any; depth: number }[] {
  const result: { node: any; depth: number }[] = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.expanded && node.categories && node.categories.length > 0) {
      result.push(...flattenTree(node.categories, depth + 1));
    }
  }
  return result;
}

const flatList = computed(() => flattenTree(categories.value, 0));

// 按展示中/已隐藏筛选（仅对系统配置公司的分类生效）
const visibilityFlatList = computed(() => {
  const list = flatList.value;
  if (visibilityFilter.value === 'all') return list;
  if (visibilityFilter.value === 'visible') {
    return list.filter((item) => !isFromDefaultCompany(item.node) || !isCategoryHidden(item.node));
  }
  return list.filter((item) => isFromDefaultCompany(item.node) && isCategoryHidden(item.node));
});

/** 当前分类下子分类个数、商品/套餐个数文案 */
function getCategoryCounts(node: any): string {
  const childCount = node.categories?.length ?? 0;
  const productCount = node.products_aggregate?.aggregate?.count ?? 0;
  const productListed = node.products_listed_aggregate?.aggregate?.count ?? productCount;
  const packageCount = node.packages_aggregate?.aggregate?.count ?? 0;
  const parts: string[] = [];
  if (childCount > 0) parts.push(`${childCount} 个子分类`);
  if (node.type === 'product' && productCount > 0) {
    if (productListed < productCount) {
      parts.push(`${productCount} 个商品（${productListed} 已上架）`);
    } else {
      parts.push(`${productCount} 个商品`);
    }
  }
  if (node.type === 'package' && packageCount > 0) parts.push(`${packageCount} 个套餐`);
  if (node.type !== 'product' && node.type !== 'package') {
    if (productCount > 0) parts.push(`${productCount} 个商品`);
    if (packageCount > 0) parts.push(`${packageCount} 个套餐`);
  }
  return parts.length ? parts.join('、') : '0';
}

function hasChildren(node: any): boolean {
  return node.categories && node.categories.length > 0;
}

// 获取分类类型文本
function getTypeText(type: string) {
  return type === 'package' ? '套餐' : '产品';
}

// 获取分类类型样式类
function getTypeClass(type: string) {
  return type === 'package' ? 'type-package' : 'type-product';
}

// 选择类型筛选
function selectType(type: 'product' | 'package' | null) {
  selectedType.value = type;
  filterCategories();
}

// 按范围筛选：只保留 _companyId === 指定公司 的节点
function filterByScope(cats: any[], companyId: number): any[] {
  return cats
    .filter((cat: any) => cat._companyId === companyId)
    .map((cat: any) => ({
      ...cat,
      categories: cat.categories ? filterByScope(cat.categories, companyId) : [],
    }));
}

// 筛选分类（类型 + 范围）
function filterCategories() {
  let list = allCategories.value;
  const myId = effectiveCompanyId();
  if (selectedScope.value === 'mine' && myId) {
    list = filterByScope(list, myId);
  } else if (selectedScope.value === 'headquarters' && defaultCompanyId.value) {
    list = filterByScope(list, defaultCompanyId.value);
  }
  if (!selectedType.value) {
    categories.value = list.map((cat: any) => ({
      ...cat,
      expanded: true,
      categories: cat.categories ? ensureExpanded(cat.categories) : [],
    }));
  } else {
    function filterByType(cats: any[]): any[] {
      return cats
        .filter((cat: any) => cat.type === selectedType.value)
        .map((cat: any) => ({
          ...cat,
          expanded: true,
          categories: cat.categories ? filterByType(cat.categories) : [],
        }));
    }
    categories.value = filterByType(list);
  }
}

function selectScope(scope: 'all' | 'mine' | 'headquarters') {
  selectedScope.value = scope;
  filterCategories();
}

// 加载分类树（当前公司 + 系统配置公司，并打上 _companyId）
async function loadCategories() {
  const myId = effectiveCompanyId();
  if (!myId) {
    uni.showToast({ title: '公司信息不存在', icon: 'none' });
    return;
  }
  loading.value = true;
  refreshing.value = true;
  try {
    defaultCompanyId.value = await getDefaultCompanyIdCached();

    if (defaultCompanyId.value && defaultCompanyId.value !== myId) {
      // 一次请求获取当前公司 + 总部公司的分类及当前公司的隐藏列表（类型在前端筛选）
      const { categories, hiddenCategoryIds: hidden } = await getCategoryTreeMultiCompany({
        companyIds: [myId, defaultCompanyId.value],
        hiddenForCompanyId: myId,
      });
      hiddenCategoryIds.value = hidden;
      allCategories.value = Array.isArray(categories) ? categories : [];
    } else {
      const [companyDetail, myTree] = await Promise.all([
        getCompanyDetailCached(myId),
        getCategoryTree(myId),
      ]);
      const hidden = companyDetail?.hidden_category_ids;
      hiddenCategoryIds.value = Array.isArray(hidden) ? hidden.map((id: any) => Number(id)) : [];
      allCategories.value = tagTree(Array.isArray(myTree) ? myTree : [], myId);
    }
    filterCategories();
  } catch (error: any) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
    refreshing.value = false;
    uni.stopPullDownRefresh();
  }
}

// 切换展开/收起
function toggleExpand(node: any) {
  if (hasChildren(node)) {
    node.expanded = !node.expanded;
  }
}

function goToAddCategory() {
  uni.navigateTo({ url: '/subPackages/company/category-edit/index' });
}

function goToEditCategory(category: any) {
  uni.navigateTo({ url: `/subPackages/company/category-edit/index?id=${category.id}` });
}

function handleDelete(category: any) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除分类「${category.name}」吗？`,
    success: async (res: any) => {
      if (res.confirm) {
        try {
          await deleteCategory(category.id);
          uni.showToast({ title: '删除成功', icon: 'success' });
          loadCategories();
        } catch (error: any) {
          uni.showToast({ title: error.message || '删除失败', icon: 'none' });
        }
      }
    },
  });
}

// 隐藏系统配置公司的分类（写入当前公司的 hidden_category_ids）
async function handleHideCategory(category: any) {
  const myId = effectiveCompanyId();
  if (!myId) return;
  try {
    const company = await getCompanyDetailCached(myId);
    const cur = (company?.hidden_category_ids || []).map((id: any) => Number(id));
    if (cur.includes(Number(category.id))) {
      uni.showToast({ title: '已隐藏', icon: 'none' });
      return;
    }
    await updateCompany(myId, { hidden_category_ids: [...cur, Number(category.id)] });
    uni.showToast({ title: '已加入隐藏名单', icon: 'success' });
    loadCategories();
  } catch (error: any) {
    uni.showToast({ title: (error as any)?.message || '操作失败', icon: 'none' });
  }
}

// 取消隐藏系统配置公司的分类
async function handleUnhideCategory(category: any) {
  const myId = effectiveCompanyId();
  if (!myId) return;
  try {
    const company = await getCompanyDetailCached(myId);
    const cur = (company?.hidden_category_ids || []).map((id: any) => Number(id));
    const next = cur.filter((id: number) => id !== Number(category.id));
    if (next.length === cur.length) {
      uni.showToast({ title: '未在隐藏名单中', icon: 'none' });
      return;
    }
    await updateCompany(myId, { hidden_category_ids: next });
    uni.showToast({ title: '已取消隐藏', icon: 'success' });
    loadCategories();
  } catch (error: any) {
    uni.showToast({ title: (error as any)?.message || '操作失败', icon: 'none' });
  }
}

onLoad((options?: { companyId?: string }) => {
  if (options?.companyId) {
    viewCompanyId.value = Number(options.companyId);
  }
});

onShow(() => {
  loadCategories();
});

onPullDownRefresh(() => {
  loadCategories();
});
</script>

<style scoped>
.category-list-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  height: 100vh;
  background: linear-gradient(180deg, #f8f9fc 0%, #eef0f5 100%);
  box-sizing: border-box;
}

/* 顶部栏：紧凑布局 */
.header-bar {
  background: #fff;
  padding: 14rpx 24rpx 18rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.filter-row {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.filter-tabs {
  display: flex;
  gap: 8rpx;
}

.filter-tab {
  flex: 1;
  min-width: 0;
  text-align: center;
  padding: 8rpx 12rpx;
  font-size: 24rpx;
  color: #666;
  background: #f5f5f5;
  border-radius: 20rpx;
  transition: all 0.2s;
}

.filter-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: 500;
}

.scope-tabs {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
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

.add-btn {
  padding: 8rpx 16rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 20rpx;
  font-size: 24rpx;
  border: none;
  flex-shrink: 0;
  line-height: 1.4;
}

.add-btn::after {
  border: none;
}

.visibility-row {
  margin-top: 4rpx;
}

.category-list-scroll {
  flex: 1;
  height: 0;
  overflow: hidden;
}

/* 树形列表 */
.category-tree {
  padding: 24rpx;
  padding-bottom: 60rpx;
}

.category-row {
  margin-bottom: 12rpx;
  border-radius: 16rpx;
  overflow: hidden;
  transition: background 0.2s;
}

.category-row .row-inner {
  display: flex;
  align-items: center;
  padding: 24rpx 20rpx;
  background: #fff;
  border-radius: 16rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.category-row.has-children .row-inner {
  padding-left: 20rpx;
}

.expand-area {
  width: 44rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-icon {
  font-size: 22rpx;
  color: #999;
  transition: transform 0.2s;
}

.expand-icon.expanded {
  color: #667eea;
}

.expand-placeholder {
  display: inline-block;
  width: 22rpx;
}

.row-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 14rpx;
  flex-shrink: 0;
  margin-right: 20rpx;
  background: #f0f2f5;
}

.placeholder-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e8ebf7 0%, #e0e4f0 100%);
}

.placeholder-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #667eea;
}

.row-info {
  flex: 1;
  min-width: 0;
}

.row-name {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 8rpx;
}

.route-style-hint {
  padding: 0 24rpx 12rpx;
  background: #fff;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);
}

.route-style-hint-text {
  font-size: 22rpx;
  color: #888;
  line-height: 1.45;
}

.row-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}

.row-route-style {
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
  font-weight: 500;
  border: 1rpx solid transparent;
}

.row-route-style.route-products {
  background: #f3e8ff;
  color: #6b21a8;
  border-color: #ddd6fe;
}

.row-route-style.route-categories {
  background: #f4f4f5;
  color: #52525b;
  border-color: #e4e4e7;
}

.row-type {
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
}

.row-type.type-product {
  background: #e8f4ff;
  color: #1890ff;
}

.row-type.type-package {
  background: #e8f8f0;
  color: #52c41a;
}

.row-level {
  font-size: 22rpx;
  color: #999;
  padding: 2rpx 8rpx;
  background: #f5f5f5;
  border-radius: 4rpx;
}

.row-tag-system {
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  background: #fff7e6;
  color: #d48806;
  border-radius: 4rpx;
  margin-left: 8rpx;
}

.row-counts {
  font-size: 22rpx;
  color: #999;
  margin-left: 8rpx;
}

.action-btn.hide {
  background: #fff7e6;
  color: #d48806;
}

.action-btn.unhide {
  background: #e6f7ff;
  color: #1890ff;
}

.row-actions {
  display: flex;
  gap: 12rpx;
  flex-shrink: 0;
}

.action-btn {
  padding: 12rpx 20rpx;
  background: #f0f2f5;
  color: #555;
  border-radius: 10rpx;
  font-size: 24rpx;
}

.action-btn.delete {
  background: #fff1f0;
  color: #ff4d4f;
}

/* 不同层级视觉区分 */
.category-row.depth-0 .row-inner {
  border-left: 6rpx solid #667eea;
}

.category-row.depth-1 .row-inner {
  background: #fafbff;
  border-left: 6rpx solid #a5b4fc;
}

.category-row.depth-2 .row-inner {
  background: #f5f7ff;
  border-left: 6rpx solid #c7d2fe;
}

.category-row.depth-3 .row-inner {
  background: #eef1fc;
  border-left: 6rpx solid #e0e7ff;
}

/* 空状态 */
.empty-state {
  padding: 120rpx 40rpx;
  text-align: center;
}

.empty-icon {
  display: block;
  font-size: 80rpx;
  margin-bottom: 24rpx;
  opacity: 0.6;
}

.empty-text {
  display: block;
  font-size: 30rpx;
  color: #666;
  margin-bottom: 12rpx;
}

.empty-hint {
  display: block;
  font-size: 26rpx;
  color: #999;
  margin-bottom: 40rpx;
}

.empty-btn {
  padding: 24rpx 48rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 14rpx;
  font-size: 28rpx;
  border: none;
}

/* 加载中 */
.loading-state {
  padding: 60rpx;
  text-align: center;
  color: #999;
  font-size: 28rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid #e8e8e8;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
