<template>
  <view class="product-detail-page">
    <!-- 统一导航栏（含状态栏高度） -->
    <PageNavBar :title="navTitle" :show-back="true" @back="goBack" />

    <!-- 加载状态 -->
    <view v-if="loading" class="loading-container">
      <view class="loading-spinner"></view>
      <text>加载中...</text>
    </view>

    <view v-else-if="missingProductId" class="load-fail-container">
      <text class="load-fail-text">无法识别商品链接，请重新扫码或从首页进入</text>
      <button class="load-fail-btn" @click="goHome">去首页</button>
    </view>

    <view v-else-if="productLoadFailed" class="load-fail-container">
      <text class="load-fail-text">商品不存在、已下架或暂无权限查看</text>
      <button class="load-fail-btn" @click="goHome">去首页</button>
    </view>

    <!-- 商品详情 -->
    <scroll-view v-else-if="productDetail" scroll-y class="scroll-content">
      <!-- 顶部仅展示封面图：原始比例、高度自适应 -->
      <view class="cover-section">
        <image
          v-if="productDetail.cover_image_url"
          class="cover-image"
          :src="productDetail.cover_image_url"
          mode="widthFix"
          @click="previewImages([productDetail.cover_image_url], 0)"
        />
        <view v-else class="cover-placeholder">暂无封面</view>
      </view>

      <!-- 商品基本信息 -->
      <view class="product-info-section">
        <view v-if="productTags.length > 0" class="product-tags-above-row">
          <text v-for="(tag, i) in productTags" :key="i" class="product-tag-inline">{{ tag }}</text>
        </view>
        <view class="product-name-row">
          <text class="product-name-label">产品名称：</text>
          <view class="product-name-trail">
            <view class="product-name-wrap">
              <text class="product-name">{{ productDetail.name }}</text>
            </view>
          </view>
        </view>
        <view v-if="canViewPrice && minPrice" class="product-price">
          <text class="price-label">产品价格：</text>
          <text class="price-value">¥{{ formatPrice(minPrice) }}</text>
          <text v-if="hasMultiplePrices" class="price-range">起</text>
        </view>
        <view v-else-if="!userInfo?.id" class="price-tip">
          <text>加载中…</text>
        </view>
        <view v-else class="price-tip">
          <text>请联系管理员授权查看价格</text>
        </view>
      </view>

      <!-- 商品介绍（富文本，保留换行） -->
      <view v-if="productDetail.description" class="description-section">
        <view class="section-title">商品介绍</view>
        <view class="description-content">
          <rich-text :nodes="descriptionForRichText"></rich-text>
        </view>
      </view>

      <!-- 规格选择 -->
      <view v-if="skus.length > 0" class="sku-section">
        <view class="section-title">选择规格</view>
        <view class="sku-list">
          <view
            v-for="(sku, index) in skus"
            :key="sku.id"
            class="sku-item"
            :class="{ selected: selectedSkuIds.includes(sku.id), disabled: sku.stock <= 0 }"
            @click="toggleSku(sku)"
          >
            <view class="sku-checkbox" :class="{ checked: selectedSkuIds.includes(sku.id) }">
              <text v-if="selectedSkuIds.includes(sku.id)">✓</text>
            </view>
            <image
              v-if="sku.image_url"
              class="sku-image"
              :src="sku.image_url"
              mode="aspectFill"
            ></image>
            <view class="sku-info">
              <view class="sku-name">{{ sku.name }}</view>
              <view class="sku-meta">
                <text v-if="canViewPrice" class="sku-price">¥{{ formatPrice((sku.price || 0) * priceFactor) }}</text>
                <text v-if="sku.stock <= 0" class="sku-stock stock-zero">缺货</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 产品详情 / 实景拍摄 两个媒体内容 Tab -->
      <view class="media-tabs-section">
        <view class="media-tabs">
          <view
            class="media-tab"
            :class="{ active: mediaTab === 'detail' }"
            @click="mediaTab = 'detail'"
          >
            <text>产品详情</text>
          </view>
          <view
            class="media-tab"
            :class="{ active: mediaTab === 'scene' }"
            @click="mediaTab = 'scene'"
          >
            <text>实景拍摄</text>
          </view>
        </view>
        <!-- 产品详情内容 -->
        <view v-show="mediaTab === 'detail'" class="media-tab-content">
          <view v-if="detailMediaList.length === 0" class="media-empty">暂无产品详情媒体</view>
          <view v-else class="detail-media-list">
            <template v-for="(media, index) in detailMediaList" :key="`detail-${index}`">
              <image
                v-if="media.file_type !== 'video'"
                class="detail-media-item img"
                :src="media.file_url"
                mode="widthFix"
                @click="previewImages(detailImageUrls, getDetailImageIndex(index))"
              />
              <view v-else class="detail-media-item video-wrap">
                <video :src="media.file_url" class="detail-video" controls :show-center-play-btn="true" object-fit="contain" />
              </view>
            </template>
          </view>
        </view>
        <!-- 实景拍摄内容：与产品详情一致，一行一个、高度自适应 -->
        <view v-show="mediaTab === 'scene'" class="media-tab-content">
          <view v-if="sceneMediaList.length === 0" class="media-empty">暂无实景拍摄媒体</view>
          <view v-else class="scene-media-list">
            <template v-for="(media, index) in sceneMediaList" :key="`scene-${index}`">
              <image
                v-if="media.file_type !== 'video'"
                class="scene-media-item img"
                :src="media.file_url"
                mode="widthFix"
                @click="previewImages(sceneImageUrls, getSceneImageIndex(index))"
              />
              <view v-else class="scene-media-item video-wrap">
                <video :src="media.file_url" class="scene-video" controls :show-center-play-btn="true" object-fit="contain" />
              </view>
            </template>
          </view>
        </view>
      </view>

      <!-- 底部占位 -->
      <view class="footer-placeholder"></view>
    </scroll-view>

    <!-- 底部操作栏（封装组件：首页、购物车、主按钮） -->
    <DetailFooterBar
      v-if="productDetail && !missingProductId && !productLoadFailed"
      :cart-count="cartCount"
      @home="goHome"
      @cart="goCart"
    >
      <button
        class="product-detail-footer-btn"
        :class="{ 'product-detail-footer-btn--disabled': !userInfo?.id ? true : (selectedSkuIds.length === 0 || !canAddToCart) }"
        @click="handleAddToCart"
      >
        {{ !userInfo?.id ? '请稍候…' : (selectedSkuIds.length === 0 ? '请先选择规格' : '加入购物车') }}
      </button>
    </DetailFooterBar>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { getProductDetail } from '@/api/product/index';
import { syncCompanyInfo } from '@/api/company/index';
import { addToCart, getCartList, updateCartQuantity, toggleCartSelected } from '@/api/cart/index';
import { userInfo, companyInfo, user_token } from '@/store/userStore';
import { getCompanyUserRoleCached } from '@/utils/auth';
import { safeNavigateBack } from '@/utils/navigation';
import { mergeMiniProgramEntryQuery, parsePositiveIntParam } from '@/utils/sceneParams';
import { shouldAllowAutoSwitchCompanyFromEntry } from '@/utils/entryCompanyPolicy';
import { whenAppReady } from '@/utils/appReady';
import PageNavBar from '@/components/PageNavBar.vue';
import SkeletonScreen from '@/components/SkeletonScreen.vue';
import DetailFooterBar from '@/components/DetailFooterBar.vue';

const productId = ref<number | null>(null);
const productDetail = ref<any>(null);
const loading = ref(false);
/** 无有效商品 id（常见于扫码参数未传入） */
const missingProductId = ref(false);
/** 接口无数据或请求失败（避免 v-if 全部不命中导致整页空白） */
const productLoadFailed = ref(false);
const selectedSkuIds = ref<number[]>([]);
const cartCount = ref(0);

// 用户权限和价格系数
const canViewPrice = ref(false);
const canAddToCart = ref(false);
const priceFactor = ref(1); // 价格系数，默认为1

// 计算属性
const skus = computed(() => {
  return productDetail.value?.product_skus || [];
});

// 产品详情 / 实景拍摄 Tab 当前选中的是哪个
const mediaTab = ref<'detail' | 'scene'>('detail');

// 产品详情媒体列表（图片+视频，保持顺序）
const detailMediaList = computed(() => {
  return productDetail.value?.detail_medias || [];
});

// 实景拍摄媒体列表（图片+视频）
const sceneMediaList = computed(() => {
  return productDetail.value?.scene_medias || [];
});

const detailImages = computed(() => {
  return detailMediaList.value.filter((m: any) => m.file_type === 'image');
});

const sceneImages = computed(() => {
  return sceneMediaList.value.filter((m: any) => m.file_type === 'image');
});

// 产品详情里仅图片的 URL 列表（用于预览）
const detailImageUrls = computed(() => {
  return detailMediaList.value.filter((m: any) => m.file_type === 'image').map((m: any) => m.file_url).filter(Boolean);
});

const sceneImageUrls = computed(() => {
  return sceneMediaList.value.filter((m: any) => m.file_type === 'image').map((m: any) => m.file_url).filter(Boolean);
});

// 在详情媒体列表中，第 index 项在「仅图片」列表中的下标（用于预览）
const getDetailImageIndex = (index: number | string) => {
  const i = Number(index);
  let n = 0;
  for (let j = 0; j < i && j < detailMediaList.value.length; j++) {
    if (detailMediaList.value[j].file_type !== 'video') n++;
  }
  return n;
};

const getSceneImageIndex = (index: number | string) => {
  const i = Number(index);
  let n = 0;
  for (let j = 0; j < i && j < sceneMediaList.value.length; j++) {
    if (sceneMediaList.value[j].file_type !== 'video') n++;
  }
  return n;
};

const navTitle = computed(() => {
  const name = companyInfo.value?.name;
  return name ? `${name} - 商品详情` : '商品详情';
});

// 计算最低价格（应用价格系数）
const minPrice = computed(() => {
  if (!skus.value.length) return null;
  const prices = skus.value.map((sku: any) => {
    const basePrice = sku.price || 0;
    return basePrice > 0 ? basePrice * priceFactor.value : 0;
  }).filter((p: number) => p > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
});

const hasMultiplePrices = computed(() => {
  if (!skus.value.length) return false;
  const prices = skus.value.map((sku: any) => sku.price || 0).filter((p: number) => p > 0);
  return new Set(prices).size > 1;
});

// 商品标签：从 tags 字符串解析（逗号、顿号、竖线分隔）
const productTags = computed(() => {
  const raw = productDetail.value?.tags;
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(/[,，、|｜]/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);
});

// 商品介绍富文本：将换行符转为 <br/>，便于 rich-text 正确换行
const descriptionForRichText = computed(() => {
  const raw = productDetail.value?.description;
  if (raw == null || raw === '') return '';
  const str = typeof raw === 'string' ? raw : String(raw);
  return str.replace(/\n/g, '<br/>');
});

// 检查权限（forceRefresh：从设置返回等场景下刷新价格系数缓存）
const checkPermissions = async (forceRefresh?: boolean) => {
  if (!userInfo.value?.id) {
    canViewPrice.value = false;
    canAddToCart.value = false;
    priceFactor.value = 1;
    return;
  }

  try {
    const roleInfo = await getCompanyUserRoleCached(companyInfo.value?.id, forceRefresh);
    if (roleInfo) {
      canViewPrice.value = roleInfo.canViewPrice;
      canAddToCart.value = true; // 只要登录且是公司用户即可加入购物车，与是否可看价格无关
      priceFactor.value = roleInfo.priceFactor || 1;
    } else {
      canViewPrice.value = false;
      canAddToCart.value = false;
      priceFactor.value = 1;
    }
  } catch (error) {
    console.error('检查权限失败:', error);
    canViewPrice.value = false;
    canAddToCart.value = false;
    priceFactor.value = 1;
  }
};

// 加载商品详情
const loadProductDetail = async () => {
  if (!productId.value) return;

  loading.value = true;
  productLoadFailed.value = false;

  try {
    const detail = await getProductDetail(productId.value);
    if (!detail) {
      productDetail.value = null;
      productLoadFailed.value = true;
      uni.showToast({
        title: '商品不存在或已下架',
        icon: 'none',
      });
      return;
    }
    productDetail.value = detail;
    await checkPermissions();
  } catch (error: any) {
    productDetail.value = null;
    productLoadFailed.value = true;
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
};

// 切换SKU选择（缺货也可选，用于加入购物车）
const toggleSku = (sku: any) => {
  const index = selectedSkuIds.value.indexOf(sku.id);
  if (index >= 0) {
    selectedSkuIds.value.splice(index, 1);
  } else {
    selectedSkuIds.value.push(sku.id);
  }
};

// 加入购物车（重复加购时数量+1；加购后保持规格选中状态；新加项默认勾选）
const handleAddToCart = async () => {
  if (!userInfo.value?.id) {
    uni.showToast({ title: '请稍候…', icon: 'none' });
    return;
  }

  if (selectedSkuIds.value.length === 0) {
    uni.showToast({
      title: '请选择规格',
      icon: 'none',
    });
    return;
  }

  if (!canAddToCart.value) {
    uni.showToast({
      title: '请联系管理员授权',
      icon: 'none',
    });
    return;
  }

  try {
    const list = await getCartList();
    const bySkuId = new Map<number, any>();
    list.forEach((item: any) => {
      const sid = item.product_sku?.id;
      if (sid != null) bySkuId.set(Number(sid), item);
    });

    const promises: Promise<any>[] = [];
    for (const skuId of selectedSkuIds.value) {
      const existing = bySkuId.get(Number(skuId));
      if (existing) {
        promises.push(updateCartQuantity(existing.id, (existing.quantity || 0) + 1));
        promises.push(toggleCartSelected(existing.id, true));
      } else {
        promises.push(addToCart({ skuId, quantity: 1 }));
      }
    }

    await Promise.all(promises);

    uni.showToast({
      title: '已加入购物车',
      icon: 'success',
    });

    loadCartCount();
  } catch (error: any) {
    uni.showToast({
      title: error.message || '加入购物车失败',
      icon: 'none',
    });
  }
};

// 预览图片
const previewImages = (urls: string[], current: number) => {
  if (!urls || urls.length === 0) return;
  uni.previewImage({
    urls,
    current: current >= 0 ? current : 0,
    loop: true,
    indicator: 'number',
  });
};

// 返回
const goBack = () => {
  safeNavigateBack();
};

// 去首页
const goHome = () => {
  uni.switchTab({
    url: '/pages/index/index',
  });
};

// 去购物车
const goCart = () => {
  uni.switchTab({
    url: '/pages/cart/index',
  });
};

// 加载购物车数量（用于角标：展示加购项数）
const loadCartCount = async () => {
  if (!userInfo.value?.id || !companyInfo.value?.id) {
    cartCount.value = 0;
    return;
  }
  try {
    const list = await getCartList();
    cartCount.value = Array.isArray(list) ? list.length : 0;
  } catch {
    cartCount.value = 0;
  }
};

// 格式化价格
const formatPrice = (price: number) => {
  return Number(price).toFixed(2);
};

onLoad((options?: Record<string, string | undefined>) => {
  void (async () => {
    await whenAppReady();
    const merged = mergeMiniProgramEntryQuery(options);
    const id = parsePositiveIntParam(merged.id);
    const sceneCompanyId = parsePositiveIntParam(merged.companyId);
    if (sceneCompanyId != null && (await shouldAllowAutoSwitchCompanyFromEntry())) {
      try {
        uni.setStorageSync('companyId', String(sceneCompanyId));
      } catch (_) {}
      const cur = companyInfo.value?.id != null ? Number(companyInfo.value.id) : NaN;
      if (!Number.isInteger(cur) || cur !== sceneCompanyId) {
        try {
          await syncCompanyInfo(sceneCompanyId, true);
          if (user_token.value) {
            await getCompanyUserRoleCached(undefined, true);
          }
        } catch (e) {
          console.error('扫码商品：同步公司上下文失败', e);
        }
      }
    }
    if (id != null) {
      productId.value = id;
      await loadProductDetail();
    } else {
      missingProductId.value = true;
    }
    await loadCartCount();
  })();
});

onShow(() => {
  loadCartCount();
  // 登录返回或公司价格设置变更后，强制刷新角色/价格系数
  if (productDetail.value && userInfo.value?.id) {
    void checkPermissions(true);
  }
});

// 分享带 companyId，别人点开可进入对应公司
onShareAppMessage(() => {
  const cid = companyInfo?.value?.id ?? uni.getStorageSync('companyId') ?? '';
  const path = cid
    ? `/pages/product-detail/index?id=${productId.value}&companyId=${cid}`
    : `/pages/product-detail/index?id=${productId.value}`;
  return {
    title: productDetail.value?.name || '商品详情',
    path,
  };
});

onShareTimeline(() => {
  const cid = companyInfo?.value?.id ?? uni.getStorageSync('companyId') ?? '';
  const query = cid
    ? `id=${productId.value}&companyId=${cid}`
    : `id=${productId.value}`;
  return {
    title: productDetail.value?.name || '商品详情',
    query,
  };
});
</script>

<style scoped>
/* 参考图：主色深青绿、主文黑、次文深灰、背景白 */
.product-detail-page {
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
  background: #f5f5f5;
  padding-bottom: 120rpx;
}

.skeleton-area {
  min-height: 60vh;
  padding: 0;
}

.scroll-content {
  height: calc(100vh - 100rpx - env(safe-area-inset-bottom));
  min-height: 0;
}

.loading-container {
  padding: 200rpx 0;
  text-align: center;
  color: #666666;
  font-size: 28rpx;
}

.load-fail-container {
  padding: 120rpx 48rpx 200rpx;
  text-align: center;
  color: #666666;
  font-size: 28rpx;
}

.load-fail-text {
  display: block;
  line-height: 1.6;
  margin-bottom: 40rpx;
}

.load-fail-btn {
  font-size: 28rpx;
  padding: 16rpx 48rpx;
  background: #0d9488;
  color: #ffffff;
  border-radius: 8rpx;
  border: none;
}

.loading-spinner {
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid #e0e0e0;
  border-top-color: #0d9488;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20rpx;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.cover-section {
  width: 100%;
  background: #ffffff;
  margin-bottom: 20rpx;
}

.cover-image {
  width: 100%;
  display: block;
  vertical-align: top;
}

.cover-placeholder {
  width: 100%;
  min-height: 400rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666666;
  font-size: 28rpx;
}

/* 产品详情 / 实景拍摄 Tab：选中用主色深青绿 */
.media-tabs-section {
  background: #ffffff;
  padding: 0 30rpx 30rpx;
  margin-bottom: 20rpx;
}

.media-tabs {
  display: flex;
  border-bottom: 2rpx solid #e8e8e8;
  margin-bottom: 24rpx;
}

.media-tab {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 30rpx;
  color: #666666;
  position: relative;
  font-weight: 400;
}

.media-tab.active {
  color: #0d9488;
  font-weight: bold;
}

.media-tab.active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 60rpx;
  height: 4rpx;
  background: #0d9488;
  border-radius: 2rpx;
}

.media-tab-content {
  min-height: 120rpx;
}

.media-empty {
  text-align: center;
  color: #666666;
  font-size: 28rpx;
  padding: 48rpx 0;
}

.detail-media-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.detail-media-item.img {
  width: 100%;
  display: block;
  vertical-align: top;
}

.detail-media-item.video-wrap,
.scene-media-item.video-wrap {
  width: 100%;
  overflow: hidden;
  background: #000;
}

.detail-video,
.scene-video {
  width: 100%;
  height: 400rpx;
  display: block;
}

/* 实景拍摄：一行一个，高度自适应，无间隔 */
.scene-media-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.scene-media-item.img {
  width: 100%;
  display: block;
  vertical-align: top;
}

.scene-video {
  width: 100%;
  min-height: 300rpx;
  display: block;
}

.product-info-section {
  background: #ffffff;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.product-tags-above-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 16rpx;
  width: 100%;
}

.product-name-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  margin-bottom: 16rpx;
  line-height: 1.45;
  width: 100%;
}

.product-name-label {
  flex-shrink: 0;
  font-size: 28rpx;
  color: #666666;
  margin-right: 8rpx;
}

.product-name-trail {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0;
  flex: 1;
  min-width: 0;
}

.product-name-wrap {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
}

.product-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #000000;
  word-break: break-word;
  white-space: normal;
}

/* 与 .section-title（商品介绍）同色 #0d9488 */
.product-tag-inline {
  font-size: 38rpx;
  font-weight: 600;
  color: #0d9488;
  background: #f0fdfa;
  padding: 4rpx 16rpx;
  border-radius: 24rpx;
  white-space: nowrap;
  line-height: 1.3;
}

.product-price {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.price-label {
  font-size: 26rpx;
  color: #666666;
}

.price-value {
  font-size: 32rpx;
  font-weight: bold;
  color: #ff6b6b;
}

.price-range {
  font-size: 24rpx;
  color: #666666;
}

.price-tip {
  padding: 20rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  text-align: center;
  font-size: 28rpx;
  color: #666666;
}

.description-section,
.video-section,
.sku-section {
  background: #ffffff;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

/* 区块标题：主色深青绿、加粗，参考图「商品介绍」「规格」 */
.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #0d9488;
  margin-bottom: 24rpx;
  padding-bottom: 16rpx;
  border-bottom: 2rpx solid #e8e8e8;
}

.description-content {
  font-size: 28rpx;
  color: #333333;
  line-height: 1.8;
  word-break: break-word;
}

.product-video {
  width: 100%;
  height: 400rpx;
  border-radius: 12rpx;
}

.sku-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.sku-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  border: 2rpx solid #e8e8e8;
  transition: all 0.3s;
}

.sku-item.selected {
  border-color: #0d9488;
  background: #f0fdfa;
}

.sku-item.disabled {
  opacity: 0.5;
}

.sku-checkbox {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid #d0d0d0;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  flex-shrink: 0;
  transition: all 0.3s;
}

.sku-checkbox.checked {
  background: #0d9488;
  border-color: #0d9488;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: bold;
}

.sku-image {
  width: 120rpx;
  height: 120rpx;
  border-radius: 8rpx;
  background: #f0f0f0;
  flex-shrink: 0;
}

.sku-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.sku-name {
  font-size: 28rpx;
  font-weight: 400;
  color: #000000;
}

.sku-meta {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.sku-price {
  font-size: 32rpx;
  font-weight: bold;
  color: #ff6b6b;
}

.sku-stock {
  font-size: 24rpx;
  color: #666666;
}

.sku-stock.stock-zero {
  color: #ff6b6b;
}


/* ---------- 底部栏占位（与 DetailFooterBar 高度一致） ---------- */
.footer-placeholder {
  height: calc(100rpx + env(safe-area-inset-bottom));
}

/* 产品详情页主按钮：略大、靠右（由 DetailFooterBar 的 margin-left 控制） */
.product-detail-footer-btn {
  height: 72rpx;
  padding: 0 48rpx;
  background: #0d9488;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 36rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.product-detail-footer-btn--disabled {
  background: #f0f0f0;
  color: #aaa;
  font-weight: 500;
}
</style>
