<template>
  <view class="container">
    <!-- 统一导航栏（含状态栏高度） -->
    <PageNavBar :title="companyInfo?.name || '首页'" />

    <!-- 搜索框：点击跳转搜索页并自动聚焦 -->
    <SearchBox type="product" placeholder="请输入商品名称" search-icon="/static/index/srch.png" />

    <!-- 骨架屏 - 在加载中显示 -->
    <view v-if="loading" class="skeleton-container">
      <!-- 顶部轮播图骨架 -->
      <view class="skeleton-banner"></view>

      <!-- 分类骨架 - 第一组 -->
      <view class="skeleton-section">
        <view class="skeleton-title"></view>
        <view class="skeleton-category-grid">
          <view
            v-for="i in 10"
            :key="`cat1-${i}`"
            class="skeleton-category-item"
          >
            <view class="skeleton-category-icon"></view>
            <view class="skeleton-category-name"></view>
          </view>
        </view>
      </view>

      <!-- 分类骨架 - 第二组 -->
      <view class="skeleton-section">
        <view class="skeleton-title"></view>
        <view class="skeleton-category-grid">
          <view
            v-for="i in 10"
            :key="`cat2-${i}`"
            class="skeleton-category-item"
          >
            <view class="skeleton-category-icon"></view>
            <view class="skeleton-category-name"></view>
          </view>
        </view>
      </view>

      <!-- 底部轮播图骨架 -->
      <view class="skeleton-banner"></view>
    </view>

    <!-- 实际内容 - 只在非加载状态显示 -->
    <view v-else>
      <!-- 顶部轮播图 -->
      <view class="banner-container" v-show="hasBanners(topBanners)">
        <swiper
          class="banner-swiper"
          circular
          autoplay
          interval="3000"
          duration="500"
          indicator-dots
          indicator-active-color="#007aff"
        >
          <swiper-item
            v-for="(banner, index) in topBanners"
            :key="index"
            @tap="handleBannerClick(banner)"
          >
            <image
              class="banner-image"
              :src="getBannerImage(banner) + '?x-oss-process=image/format,webp'"
              mode="aspectFill"
            ></image>
          </swiper-item>
        </swiper>
      </view>

      <!-- 无数据提示 -->
      <view v-show="isEmpty(categoryList)" class="empty-container">
        <view class="empty-data">暂无分类数据</view>
      </view>

      <!-- 分类数据 -->
      <view v-show="!isEmpty(categoryList)">
        <!-- 遍历所有主分类 -->
        <view
          v-for="(mainCategory, mainIndex) in categoryList"
          :key="mainIndex"
          class="section"
        >
          <!-- 主分类名称 -->
          <view class="title">{{ mainCategory.name }}</view>

          <!-- 子分类网格 -->
          <view class="category-grid" v-show="hasChildren(mainCategory)">
            <view
              v-for="(subCategory, subIndex) in mainCategory.children"
              :key="subIndex"
              class="category-item"
              @tap="handleCategoryClick(subCategory, mainCategory)"
            >
              <view class="category-icon-wrapper">
                <image
                  class="category-icon"
                  :src="
                    getCategoryImage(subCategory) +
                    '?x-oss-process=image/format,webp'
                  "
                  mode="aspectFit"
                ></image>
              </view>
              <text class="category-name">{{ subCategory.name }}</text>
            </view>
          </view>

          <!-- 高端定制区域下方的底部轮播图 -->
          <view
            class="banner-container bottom-banner"
            v-show="isLastCategory(mainIndex) && hasBanners(bottomBanners)"
          >
            <swiper
              class="banner-swiper"
              circular
              autoplay
              interval="4000"
              duration="500"
              indicator-dots
              indicator-active-color="#007aff"
            >
              <swiper-item
                v-for="(banner, index) in bottomBanners"
                :key="index"
                @tap="handleBannerClick(banner)"
              >
                <image
                  class="banner-image"
                  :src="
                    getBannerImage(banner) + '?x-oss-process=image/format,webp'
                  "
                  mode="aspectFill"
                ></image>
              </swiper-item>
            </swiper>
          </view>
        </view>
      </view>
    </view>

  </view>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from "vue";
import { getHomePageData } from "@/api/home/index";
import { getPinia } from "@/store/piniaInstance";
import { useUserStore } from "@/store/user";
import { getHomePageCacheValid, setHomePageCache, userInfo, companyInfo } from "@/store/userStore";
import { whenAppReady } from "@/utils/appReady";
import { mergeMiniProgramEntryQuery, parsePositiveIntParam } from "@/utils/sceneParams";
import { shouldAllowAutoSwitchCompanyFromEntry } from "@/utils/entryCompanyPolicy";
import { onShow, onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import type { BannerArray } from "@/types/companies";

import PageNavBar from '@/components/PageNavBar.vue';
import SearchBox from '@/components/SearchBox.vue';

/** 首页分类项（含子分类） */
interface CategoryItem {
  id: any;
  name: any;
  sort_order?: any;
  route_ui_style?: any;
  ui_style?: any;
  icon_url?: any;
  type?: any;
  skip?: boolean;
  img?: { url: any } | null;
  icon?: any;
  image?: any;
  children?: CategoryItem[];
}

export default defineComponent({
  components: { PageNavBar, SearchBox },
  setup() {
    const pinia = getPinia();
    const userStore = pinia ? useUserStore(pinia) : null;
    // 使用兼容层 companyInfo，切换公司后标题能实时更新

    const categoryList = ref<CategoryItem[]>([]);
    const loading = ref(true);
    const topBanners = ref<BannerArray>([]);
    const bottomBanners = ref<BannerArray>([]);

    const sortBanners = (arr: any[]) =>
      [...arr].sort((a, b) => {
        const sortA = typeof a === "object" ? a.sort ?? 999 : 999;
        const sortB = typeof b === "object" ? b.sort ?? 999 : 999;
        return sortA - sortB;
      });

    /** 一次请求拉取轮播 + 分类，优先用 store 内 5 分钟缓存。companyId 优先 store，无则读 storage（App 可能尚未写完 store） */
    const fetchHomeData = async (forceRefresh = false) => {
      let companyId: number | null = companyInfo?.value?.id ?? null;
      if (companyId == null) {
        try {
          const id = uni.getStorageSync('companyId');
          if (id != null && id !== '') {
            const n = Number(id);
            if (!Number.isNaN(n)) companyId = n;
          }
        } catch (_) {}
      }
      if (companyId == null && (await shouldAllowAutoSwitchCompanyFromEntry())) {
        const merged = mergeMiniProgramEntryQuery();
        const fromEntry = parsePositiveIntParam(merged.companyId);
        if (fromEntry != null) {
          companyId = fromEntry;
          try {
            uni.setStorageSync('companyId', String(fromEntry));
          } catch (_) {}
        }
      }
      if (!companyId) {
        categoryList.value = [];
        topBanners.value = [];
        bottomBanners.value = [];
        loading.value = false;
        return;
      }

      const cached = !forceRefresh ? getHomePageCacheValid(companyId) : null;
      if (cached) {
        categoryList.value = cached.categoryList;
        topBanners.value = cached.topBanners;
        bottomBanners.value = cached.bottomBanners;
        loading.value = false;
        return;
      }

      loading.value = true;
      try {
        const res = await getHomePageData(companyId);
        if (res?.code === 0 && res.data) {
          const top = sortBanners(res.data.banners.top);
          const bottom = sortBanners(res.data.banners.bottom);
          categoryList.value = res.data.categoryList ?? [];
          topBanners.value = top;
          bottomBanners.value = bottom;
          setHomePageCache(companyId, {
            categoryList: categoryList.value,
            topBanners: top,
            bottomBanners: bottom,
          });
        } else {
          uni.showToast({
            title: res?.message || "获取首页数据失败",
            icon: "none",
          });
        }
      } catch (error) {
        console.error("获取首页数据失败:", error);
        uni.showToast({
          title: "获取首页数据失败",
          icon: "none",
        });
      } finally {
        loading.value = false;
      }
    };

    // App 的 syncCompanyInfo 可能晚于首页 onShow，companyInfo 就绪后若缺分类或轮播则补拉一次（首次进入时轮播来自缓存，缓存可能尚未就绪）
    watch(
      () => companyInfo?.value?.id,
      (id) => {
        if (!id || loading.value) return;
        const noCategories = categoryList.value.length === 0;
        const noBanners = topBanners.value.length === 0 && bottomBanners.value.length === 0;
        if (noCategories || noBanners) {
          fetchHomeData(true);
        }
      }
    );

    // 获取分类图片
    const getCategoryImage = (category: any) => {
      if (!category) return "/static/default.png";

      if (category.img && category.img.url) {
        return category.img.url;
      }

      if (category.icon) {
        return category.icon;
      }

      if (category.image) {
        return category.image;
      }

      return "/static/default.png";
    };

    // 获取轮播图图片
    const getBannerImage = (banner: any) => {
      if (!banner) return "/static/default-banner.png";

      // banner 可能是字符串（兼容旧数据），也可能是对象
      if (typeof banner === "string") {
        return banner;
      }

      // 使用 file_url 字段
      if (banner.file_url) {
        return banner.file_url;
      }

      return "/static/default-banner.png";
    };

    // 检查是否有轮播图（显式函数，避免构建后丢失）
    function hasBanners(banners: any[]) {
      return banners && banners.length > 0;
    }

    // 检查分类列表是否为空
    const isEmpty = (list: any[]) => {
      return !list || list.length === 0;
    };

    // 检查分类是否有子分类
    const hasChildren = (category: any) => {
      return category.children && category.children.length > 0;
    };

    // 检查是否是最后一个分类
    const isLastCategory = (index: number) => {
      return index === categoryList.value.length - 1;
    };

    // 轮播图点击处理函数
    const handleBannerClick = (banner: any) => {
      if (!banner) return;

      // 如果是字符串格式（旧数据），不处理跳转
      if (typeof banner === "string") {
        return;
      }

      // 如果有 link 字段，进行跳转
      if (banner.link) {
        const link = banner.link;
        
        // 判断是内部路径还是外部链接
        if (link.startsWith("http://") || link.startsWith("https://")) {
          // 外部链接，使用 web-view 或复制链接
          uni.showToast({
            title: "外部链接",
            icon: "none",
          });
          // 可以在这里添加打开外部链接的逻辑
        } else {
          // 内部路径，使用 navigateTo 或 switchTab
          if (link.startsWith("/pages/")) {
            // 判断是否是 tabBar 页面
            const tabBarPages = [
              "/pages/index/index",
              "/pages/package/index",
              "/pages/cart/index",
              "/pages/mine/index",
            ];
            
            if (tabBarPages.includes(link)) {
              uni.switchTab({
                url: link,
              });
            } else {
              uni.navigateTo({
                url: link,
                fail: (err) => {
                  console.error("跳转失败:", err);
                  uni.showToast({
                    title: "页面不存在",
                    icon: "none",
                  });
                },
              });
            }
          } else {
            // 相对路径，添加 /pages 前缀
            uni.navigateTo({
              url: `/pages${link}`,
              fail: (err) => {
                console.error("跳转失败:", err);
              },
            });
          }
        }
      }
    };

    // 分类点击处理函数
    // 根据 ui_style 字段决定跳转行为
    const handleCategoryClick = (category: any, mainCategory: any) => {
      console.log('分类点击事件触发:', category);
      console.log('分类完整数据:', JSON.stringify(category, null, 2));
      
      if (!category) {
        console.error('分类数据为空');
        uni.showToast({
          title: '分类数据错误',
          icon: 'none',
        });
        return;
      }

      if (!category.id) {
        console.error('分类ID为空:', category);
        uni.showToast({
          title: '分类ID错误',
          icon: 'none',
        });
        return;
      }

      const categoryId = category.id;
      const categoryName = category.name || '';

      // 统一进分类筛选页：根据后台 route_ui_style 展示子分类网格或本分类商品（与「展示商品 / 继续展示分类」一致），避免再跳转到独立的 product列表页
      const url = `/pages/category-filter/index?categoryId=${categoryId}&categoryName=${encodeURIComponent(categoryName)}`;
      uni.navigateTo({
        url,
        fail: (err) => {
          uni.showToast({
            title: '页面跳转失败: ' + (err?.errMsg || '未知错误'),
            icon: 'none',
            duration: 3000,
          });
        },
      });
    };

    onShow(async () => {
      await whenAppReady();
      fetchHomeData(false);
    });

    // 有缓存时直接展示，不闪骨架屏
    if (companyInfo?.value?.id) {
      const cached = getHomePageCacheValid(companyInfo.value.id);
      if (cached) {
        categoryList.value = cached.categoryList;
        topBanners.value = cached.topBanners;
        bottomBanners.value = cached.bottomBanners;
        loading.value = false;
      }
    }

    return {
      categoryList,
      loading,
      topBanners,
      bottomBanners,
      getCategoryImage,
      getBannerImage,
      handleCategoryClick,
      handleBannerClick,
      hasBanners,
      isEmpty,
      hasChildren,
      companyInfo,
      isLastCategory,
      userInfo,
    };
  },
  onShareAppMessage() {
    const cid = companyInfo?.value?.id ?? uni.getStorageSync("companyId") ?? '';
    const path = cid ? `/pages/index/index?companyId=${cid}` : '/pages/index/index';
    return {
      title: companyInfo?.value?.name ? `${companyInfo.value.name}` : '首页',
      path,
      imageUrl: "",
    };
  },
  onShareTimeline() {
    const cid = companyInfo?.value?.id ?? uni.getStorageSync("companyId") ?? '';
    const query = cid ? `companyId=${cid}` : '';
    return {
      title: companyInfo?.value?.name ? `${companyInfo.value.name}` : '首页',
      query,
    };
  },
});
</script>

<style scoped>
.container {
  position: relative;
  min-height: 100vh;
  background-color: #ffffff;
}

/* 搜索框样式 */
.search-box {
  padding: 15rpx 30rpx;
  background-color: #ffffff;
}

.search-input {
  display: flex;
  align-items: center;
  background-color: #f0f0f0;
  border-radius: 40rpx;
  padding: 10rpx 30rpx;
}

.search-icon {
  width: 40rpx;
  height: 40rpx;
  margin-right: 10rpx;
}

/* 轮播图样式 */
.banner-container {
  margin: 10rpx 30rpx;
  border-radius: 12rpx;
  overflow: hidden;
}

.bottom-banner {
  margin-top: 30rpx;
  padding-bottom: 30rpx;
}

.banner-swiper {
  height: 240rpx;
  width: 100%;
}

.banner-image {
  width: 100%;
  height: 100%;
}

/* 分类区域 */
.section {
  margin-bottom: 30rpx;
}

.title {
  text-align: center;
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
  margin: 30rpx 0 15rpx;
}

/* 分类网格 */
.category-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: 10rpx 20rpx;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20rpx;
  cursor: pointer;
  position: relative;
  z-index: 1;
  -webkit-tap-highlight-color: transparent;
  padding: 10rpx;
  box-sizing: border-box;
  width: 100%;
  touch-action: manipulation;
}

.category-item:active {
  opacity: 0.7;
  transform: scale(0.95);
}

.category-icon-wrapper {
  width: 85rpx;
  height: 85rpx;
  background-color: rgba(212, 240, 235, 0.6);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 10rpx;
}

.category-icon {
  width: 55rpx;
  height: 55rpx;
}

.category-name {
  font-size: 24rpx;
  color: #333;
  text-align: center;
}

/* 加载和空数据状态 */
.loading-container,
.empty-container {
  padding: 40rpx;
  text-align: center;
  margin: 0 20rpx;
}

.loading,
.empty-data {
  color: #999;
  font-size: 28rpx;
}

/* 骨架屏样式 */
.skeleton-container {
  padding: 0 30rpx;
}

.skeleton-banner {
  height: 260rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 12rpx;
  margin: 20rpx 0 30rpx 0;
}

.skeleton-section {
  margin-bottom: 30rpx;
}

.skeleton-title {
  width: 200rpx;
  height: 34rpx;
  margin: 40rpx auto 20rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4rpx;
}

.skeleton-category-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: 10rpx 0;
}

.skeleton-category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20rpx;
}

.skeleton-category-icon {
  width: 100rpx;
  height: 100rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 50%;
  margin-bottom: 10rpx;
}

.skeleton-category-name {
  width: 80rpx;
  height: 24rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4rpx;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

</style>
