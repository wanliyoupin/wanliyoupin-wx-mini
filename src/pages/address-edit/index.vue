<template>
  <view class="address-edit-page">
    <view class="form-section">
      <view class="form-item">
        <view class="form-label">收货人 <text class="required">*</text></view>
        <input class="form-input" v-model="form.receiver_name" placeholder="请输入收货人姓名" maxlength="20" />
      </view>
      <view class="form-item">
        <view class="form-label">手机号 <text class="required">*</text></view>
        <input class="form-input" type="number" v-model="form.receiver_phone" placeholder="请输入手机号" maxlength="11" />
      </view>
      <view class="form-item">
        <view class="form-label">详细地址 <text class="required">*</text></view>
        <textarea
          class="form-textarea"
          v-model="form.receiver_address"
          placeholder="街道、楼栋、门牌等"
          maxlength="200"
        />
      </view>
      <view class="form-item row">
        <text class="form-label">设为默认地址</text>
        <switch :checked="form.is_default" @change="onDefaultChange" color="#667eea" />
      </view>
    </view>
    <view class="footer-actions">
      <button class="save-btn" @click="handleSave" :loading="saving">保存</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { userInfo, user_token } from '@/store/userStore';
import { getAddressList, createAddress, updateAddress, type AddressInput } from '@/api/address/index';

const addressId = ref<number | null>(null);
const saving = ref(false);
const form = reactive<AddressInput & { is_default?: boolean }>({
  receiver_name: '',
  receiver_phone: '',
  receiver_address: '',
  receiver_province: '',
  receiver_city: '',
  receiver_district: '',
  is_default: false,
});

function onDefaultChange(e: Event) {
  form.is_default = (e as unknown as { detail: { value: boolean } }).detail.value;
}

onLoad((options?: { id?: string }) => {
  if (options?.id) {
    addressId.value = Number(options.id);
  }
});

onMounted(async () => {
  if (!user_token.value || !userInfo.value?.id) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  if (addressId.value) {
    const list = await getAddressList(userInfo.value.id);
    const item = list.find((a) => Number(a.id) === addressId.value);
    if (item) {
      form.receiver_name = item.receiver_name;
      form.receiver_phone = item.receiver_phone;
      form.receiver_address = item.receiver_address;
      form.receiver_province = item.receiver_province || '';
      form.receiver_city = item.receiver_city || '';
      form.receiver_district = item.receiver_district || '';
      form.is_default = item.is_default;
    }
  }
});

async function handleSave() {
  if (!form.receiver_name?.trim()) {
    uni.showToast({ title: '请输入收货人', icon: 'none' });
    return;
  }
  if (!form.receiver_phone?.trim()) {
    uni.showToast({ title: '请输入手机号', icon: 'none' });
    return;
  }
  if (!form.receiver_address?.trim()) {
    uni.showToast({ title: '请输入详细地址', icon: 'none' });
    return;
  }
  const userId = userInfo.value?.id;
  if (!userId) return;
  saving.value = true;
  try {
    const payload: AddressInput = {
      receiver_name: form.receiver_name.trim(),
      receiver_phone: form.receiver_phone.trim(),
      receiver_address: form.receiver_address.trim(),
      receiver_province: form.receiver_province?.trim() || undefined,
      receiver_city: form.receiver_city?.trim() || undefined,
      receiver_district: form.receiver_district?.trim() || undefined,
      is_default: form.is_default,
    };
    if (addressId.value) {
      await updateAddress(addressId.value, userId, payload);
      uni.showToast({ title: '保存成功', icon: 'success' });
    } else {
      await createAddress(userId, payload);
      uni.showToast({ title: '添加成功', icon: 'success' });
    }
    setTimeout(() => uni.navigateBack(), 800);
  } catch (e: any) {
    uni.showToast({ title: e?.message || '保存失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.address-edit-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
  padding-bottom: 140rpx;
}

.form-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.form-item {
  margin-bottom: 28rpx;
}

.form-item.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-label {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 12rpx;
  display: block;
}

.form-label.required .required {
  color: #f56c6c;
}

.form-input {
  width: 100%;
  height: 80rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  box-sizing: border-box;
}

.form-input + .form-input {
  margin-top: 16rpx;
}

.form-textarea {
  width: 100%;
  min-height: 160rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  box-sizing: border-box;
}

.footer-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1rpx solid #eee;
}

.save-btn {
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
