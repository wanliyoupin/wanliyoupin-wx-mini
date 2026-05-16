<template>
  <view class="address-list-page">
    <scroll-view scroll-y class="scroll-content" @scrolltolower="loadMore" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="onRefresh">
      <view v-if="list.length > 0" class="address-list">
        <view
          v-for="item in list"
          :key="item.id"
          class="address-item"
          @click="onSelectItem(item)"
        >
          <view class="address-main">
            <view class="address-header">
              <text class="receiver-name">{{ item.receiver_name }}</text>
              <text class="receiver-phone">{{ item.receiver_phone }}</text>
              <view v-if="item.is_default" class="default-tag">默认</view>
            </view>
            <text class="receiver-address">{{ item.receiver_address }}</text>
          </view>
          <view class="address-actions">
            <view class="action-btn" @click.stop="goEdit(item.id)">编辑</view>
            <view v-if="!item.is_default" class="action-btn" @click.stop="setDefault(item)">设为默认</view>
            <view class="action-btn delete" @click.stop="handleDelete(item)">删除</view>
          </view>
        </view>
      </view>
      <view v-else-if="!loading" class="empty">
        <text class="empty-text">暂无收货地址</text>
        <text class="empty-hint">点击下方按钮添加</text>
      </view>
    </scroll-view>
    <view class="footer-bar">
      <button class="add-address-btn" @click="goAdd">+ 新增地址</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { whenAppReady } from '@/utils/appReady';
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { userInfo, user_token } from '@/store/userStore';
import { getAddressList, setDefaultAddress, deleteAddress, type AddressItem } from '@/api/address/index';

const list = ref<AddressItem[]>([]);
const loading = ref(false);
const refreshing = ref(false);
const selectMode = ref(false);

onLoad((options?: { select?: string }) => {
  selectMode.value = options?.select === '1';
});

onShow(async () => {
  await whenAppReady();
  loadList();
});

onPullDownRefresh(() => {
  loadList().then(() => uni.stopPullDownRefresh());
});

function onRefresh() {
  refreshing.value = true;
  loadList().then(() => {
    refreshing.value = false;
  });
}

async function loadList() {
  const userId = userInfo.value?.id;
  if (!userId || !user_token.value) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    list.value = await getAddressList(userId);
  } catch (e: any) {
    uni.showToast({ title: e?.message || '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function loadMore() {}

function goAdd() {
  uni.navigateTo({ url: '/pages/address-edit/index' });
}

function goEdit(id: number) {
  uni.navigateTo({ url: `/pages/address-edit/index?id=${id}` });
}

function onSelectItem(item: AddressItem) {
  if (selectMode.value) {
    const pages = getCurrentPages();
    const prev = pages[pages.length - 2] as any;
    if (prev?.$vm?.onAddressSelected) {
      prev.$vm.onAddressSelected(item);
    }
    uni.navigateBack();
  }
}

async function setDefault(item: AddressItem) {
  const userId = userInfo.value?.id;
  if (!userId) return;
  try {
    await setDefaultAddress(item.id, userId);
    uni.showToast({ title: '已设为默认', icon: 'success' });
    loadList();
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' });
  }
}

function handleDelete(item: AddressItem) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除收货地址「${item.receiver_name} ${item.receiver_phone}」吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteAddress(item.id);
          uni.showToast({ title: '已删除', icon: 'success' });
          loadList();
        } catch (e: any) {
          uni.showToast({ title: e?.message || '删除失败', icon: 'none' });
        }
      }
    },
  });
}
</script>

<style scoped>
.address-list-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
}

.scroll-content {
  height: 100vh;
}

.address-list {
  padding: 20rpx;
}

.address-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.address-main {
  margin-bottom: 20rpx;
}

.address-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.receiver-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.receiver-phone {
  font-size: 28rpx;
  color: #666;
}

.default-tag {
  padding: 4rpx 12rpx;
  font-size: 22rpx;
  color: #667eea;
  background: #e8ebf7;
  border-radius: 6rpx;
}

.receiver-address {
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
}

.address-actions {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
}

.action-btn {
  font-size: 26rpx;
  color: #667eea;
}

.action-btn.delete {
  color: #f56c6c;
}

.empty {
  padding: 80rpx 40rpx;
  text-align: center;
}

.empty-text {
  font-size: 30rpx;
  color: #999;
  display: block;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: #bbb;
}

.footer-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1rpx solid #eee;
}

.add-address-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 32rpx;
  border-radius: 12rpx;
  border: none;
}
</style>
