<template>
  <view class="set-password-page">
    <view v-if="!userInfo?.id" class="need-login">
      <text class="need-login-text">正在初始化…</text>
    </view>
    <view v-else-if="!isMember" class="need-login">
      <text class="need-login-text">设置密码需为正式用户，请在「我的」完成手机号授权（须已向管理员登记）。</text>
      <button class="login-btn" type="button" @click="goToMine">去「我的」</button>
      <button class="login-btn login-btn--secondary" type="button" @click="goToPasswordLogin">
        管理员密码登录
      </button>
    </view>
    <template v-else>
      <view class="password-form">
        <view class="form-tip">
          <text>设置密码后可使用手机号+密码登录</text>
        </view>
        <view class="form-item">
          <view class="form-label">原密码</view>
          <view class="input-row">
            <input
              class="form-input"
              :type="showOld ? 'text' : 'password'"
              v-model="form.oldPassword"
              placeholder="如已设置过密码请填写"
            />
            <view class="password-toggle" @click="showOld = !showOld">
              <text class="toggle-icon">{{ showOld ? '👁️' : '👁️‍🗨️' }}</text>
            </view>
          </view>
        </view>
        <view class="form-item">
          <view class="form-label">新密码</view>
          <view class="input-row">
            <input
              class="form-input"
              :type="showNew ? 'text' : 'password'"
              v-model="form.newPassword"
              placeholder="请输入新密码（至少6位）"
            />
            <view class="password-toggle" @click="showNew = !showNew">
              <text class="toggle-icon">{{ showNew ? '👁️' : '👁️‍🗨️' }}</text>
            </view>
          </view>
        </view>
        <view class="form-item">
          <view class="form-label">确认新密码</view>
          <view class="input-row">
            <input
              class="form-input"
              :type="showConfirm ? 'text' : 'password'"
              v-model="form.confirmPassword"
              placeholder="请再次输入新密码"
            />
            <view class="password-toggle" @click="showConfirm = !showConfirm">
              <text class="toggle-icon">{{ showConfirm ? '👁️' : '👁️‍🗨️' }}</text>
            </view>
          </view>
        </view>
      </view>
      <view class="footer-actions">
        <button
          class="save-btn"
          type="button"
          :disabled="saving"
          :loading="saving"
          @click="handleSubmit"
        >
          {{ saving ? '提交中...' : '确认设置' }}
        </button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { whenAppReady } from '@/utils/appReady';
import { onShow } from '@dcloudio/uni-app';
import { userInfo } from '@/store/userStore';
import { isRegisteredMember } from '@/utils/memberSession';
import { setPassword } from '@/api/user';

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const showOld = ref(false);
const showNew = ref(false);
const showConfirm = ref(false);
const saving = ref(false);

const isMember = computed(() => isRegisteredMember(userInfo.value?.role));

function goToMine() {
  uni.switchTab({ url: '/pages/mine/index' });
}

function goToPasswordLogin() {
  uni.navigateTo({ url: '/pages/login/index' });
}

async function handleSubmit() {
  const newPwd = form.newPassword.trim();
  const confirm = form.confirmPassword.trim();

  if (!newPwd) {
    uni.showToast({ title: '请输入新密码', icon: 'none' });
    return;
  }
  if (newPwd.length < 6) {
    uni.showToast({ title: '密码至少6位', icon: 'none' });
    return;
  }
  if (newPwd !== confirm) {
    uni.showToast({ title: '两次输入的密码不一致', icon: 'none' });
    return;
  }

  saving.value = true;
  try {
    await setPassword({
      oldPassword: form.oldPassword.trim() || undefined,
      newPassword: newPwd,
    });
    uni.showToast({ title: '设置成功', icon: 'success' });
    setTimeout(() => {
      uni.navigateBack();
    }, 500);
  } catch (err: any) {
    uni.showToast({
      title: err?.message || '设置失败',
      icon: 'none',
    });
  } finally {
    saving.value = false;
  }
}

onShow(async () => {
  await whenAppReady();
});
</script>

<style scoped>
.set-password-page {
  min-height: 100vh;
  background: #f0f2f5;
  padding-bottom: 140rpx;
}

.need-login {
  padding: 80rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32rpx;
}

.need-login-text {
  font-size: 30rpx;
  color: #6b7280;
  text-align: center;
  line-height: 1.5;
}

.login-btn {
  width: 320rpx;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 44rpx;
  font-size: 28rpx;
  border: none;
}

.login-btn::after {
  border: none;
}

.login-btn--secondary {
  background: #fff;
  color: #667eea;
  border: 2rpx solid #667eea;
}

.password-form {
  margin: 24rpx;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  padding: 36rpx 32rpx;
  box-shadow: 0 2rpx 20rpx rgba(0, 0, 0, 0.04);
}

.form-tip {
  margin-bottom: 32rpx;
  padding: 20rpx 24rpx;
  background: #f0f9ff;
  border-radius: 12rpx;
  border-left: 6rpx solid #667eea;
}

.form-tip text {
  font-size: 26rpx;
  color: #6b7280;
  line-height: 1.5;
}

.form-item {
  margin-bottom: 36rpx;
}

.form-item:last-child {
  margin-bottom: 0;
}

.form-label {
  font-size: 28rpx;
  color: #1f2937;
  font-weight: 500;
  margin-bottom: 16rpx;
  display: block;
}

.input-row {
  position: relative;
  display: flex;
  align-items: center;
}

.form-input {
  flex: 1;
  min-height: 96rpx;
  padding: 0 100rpx 0 28rpx;
  line-height: 96rpx;
  font-size: 30rpx;
  color: #1f2937;
  background: #f8fafc;
  border-radius: 16rpx;
  box-sizing: border-box;
  border: 1rpx solid #e5e7eb;
}

.password-toggle {
  position: absolute;
  right: 24rpx;
  padding: 12rpx;
}

.toggle-icon {
  font-size: 36rpx;
  opacity: 0.7;
}

.footer-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.save-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 16rpx;
  font-size: 32rpx;
  font-weight: 500;
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.35);
}

.save-btn::after {
  border: none;
}

.save-btn[disabled] {
  opacity: 0.7;
}
</style>
