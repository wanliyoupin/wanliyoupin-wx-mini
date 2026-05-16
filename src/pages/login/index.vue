<template>
  <view class="login-container">
    <!-- 顶部装饰 -->
    <view class="header-decoration"></view>

    <!-- 登录表单 -->
    <view class="login-form">
      <view class="form-title">欢迎登录</view>

      <!-- 默认：手机号快捷登录为主 -->
      <template v-if="!showPasswordMode">
        <view class="form-lead">授权手机号，一键登录</view>
        <view class="form-private-hint">仅已向管理员登记的手机号可完成授权；未登记用户无法自动开通。</view>
        <view class="quick-login-block">
          <button
            class="quick-login-btn"
            open-type="getPhoneNumber"
            @getphonenumber="handleWechatLogin"
            :disabled="isLoading"
          >
            <text class="quick-login-btn__icon">📱</text>
            <text class="quick-login-btn__text">{{ isLoading ? '登录中…' : '手机号快捷登录' }}</text>
          </button>
          <text class="quick-login-hint">使用微信在本小程序已绑定的手机号</text>
        </view>
        <view class="mode-switch mode-switch--subtle" @click="showPasswordMode = true">
          使用账号密码登录
        </view>
      </template>

      <!-- 账号密码登录（小字切换后展示） -->
      <template v-else>
        <view class="form-subtitle">账号密码登录</view>
        <view class="form-content">
          <view class="input-group">
            <view class="input-label">手机号</view>
            <input
              class="input-field"
              type="number"
              placeholder="请输入手机号"
              v-model="passwordForm.mobile"
              maxlength="11"
            />
          </view>

          <view class="input-group">
            <view class="input-label">密码</view>
            <input
              class="input-field"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              v-model="passwordForm.password"
            />
            <view class="password-toggle" @click="showPassword = !showPassword">
              <text class="toggle-icon">{{ showPassword ? '👁️' : '👁️‍🗨️' }}</text>
            </view>
          </view>

          <button
            class="login-button"
            :disabled="!canSubmitPassword || isLoading"
            :loading="isLoading"
            @click="handlePasswordLogin"
          >
            {{ isLoading ? '登录中…' : '登录' }}
          </button>
        </view>
        <view class="mode-switch mode-switch--subtle" @click="showPasswordMode = false">
          返回手机号快捷登录
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { passwordLogin } from '@/api/user/index';
import { setUserContext, clearUserContext } from '@/store/userStore';
import { completePhoneNumberAuth } from '@/utils/wechatPhoneAuth';
import { syncCompanyContextAfterAuthLogin } from '@/utils/postAuthCompanySync';

const showPassword = ref(false);
/** false：主界面为手机号快捷登录；true：展示账号密码表单 */
const showPasswordMode = ref(false);
const isLoading = ref(false);

// 密码登录表单
const passwordForm = ref({
  mobile: '',
  password: '',
});

// 计算属性：是否可以提交密码登录
const canSubmitPassword = computed(() => {
  return passwordForm.value.mobile.length === 11 && passwordForm.value.password.length >= 6;
});

// 密码登录
const handlePasswordLogin = async () => {
  if (!canSubmitPassword.value) {
    uni.showToast({
      title: '请填写完整信息',
      icon: 'none',
    });
    return;
  }

  isLoading.value = true;

  try {
    const result = await passwordLogin({
      mobile: passwordForm.value.mobile,
      password: passwordForm.value.password,
    });

    if (result && result.token) {
      // 保存用户信息（setUserContext 内部会保存到本地存储）
      setUserContext({
        user: result.user || { id: result.userId },
        token: result.token,
        userId: result.userId,
      });

      try {
        await syncCompanyContextAfterAuthLogin(result.user || { id: result.userId });
      } catch (error: any) {
        clearUserContext();
        uni.showToast({
          title: error?.message || '登录失败',
          icon: 'none',
          duration: 3200,
        });
        return;
      }

      uni.showToast({
        title: '登录成功',
        icon: 'success',
      });

      // 延迟跳转，确保toast显示
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) {
          uni.navigateBack();
        } else {
          uni.switchTab({
            url: '/pages/index/index',
          });
        }
      }, 1500);
    }
  } catch (error: any) {
    uni.showToast({
      title: error.message || '登录失败',
      icon: 'none',
    });
  } finally {
    isLoading.value = false;
  }
};

// 微信手机号快捷登录（与「我的」页共用 completePhoneNumberAuth）
const handleWechatLogin = async (e: any) => {
  isLoading.value = true;
  try {
    const { ok, message } = await completePhoneNumberAuth(e?.detail ?? {});
    if (ok) {
      uni.showToast({
        title: '登录成功',
        icon: 'success',
      });
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) {
          uni.navigateBack();
        } else {
          uni.switchTab({
            url: '/pages/index/index',
          });
        }
      }, 1500);
      return;
    }
    if (message) {
      uni.showToast({
        title: message,
        icon: 'none',
        duration: 3200,
      });
    }
  } finally {
    isLoading.value = false;
  }
};

onLoad((options) => {
  // 可以从参数中获取登录类型
  console.log('登录页面参数:', options);
});
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx;
  box-sizing: border-box;
}

.header-decoration {
  height: 200rpx;
}

.login-form {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 60rpx 40rpx;
  box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.1);
}

.form-title {
  font-size: 48rpx;
  font-weight: bold;
  color: #333333;
  text-align: center;
  margin-bottom: 16rpx;
}

.form-subtitle {
  font-size: 28rpx;
  color: #666666;
  text-align: center;
  margin-bottom: 36rpx;
}

.form-lead {
  font-size: 32rpx;
  color: #444444;
  text-align: center;
  line-height: 1.5;
  margin-bottom: 24rpx;
  font-weight: 500;
}

.form-private-hint {
  font-size: 24rpx;
  color: #888888;
  text-align: center;
  line-height: 1.5;
  margin-bottom: 40rpx;
  padding: 0 16rpx;
}

.quick-login-block {
  margin-bottom: 32rpx;
}

.quick-login-btn {
  width: 100%;
  height: 100rpx;
  background: #07c160;
  color: #ffffff;
  border-radius: 16rpx;
  font-size: 34rpx;
  font-weight: 600;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.35);
}

.quick-login-btn::after {
  border: none;
}

.quick-login-btn[disabled] {
  background: #a0d9b8;
  color: rgba(255, 255, 255, 0.9);
  box-shadow: none;
}

.quick-login-btn__icon {
  font-size: 40rpx;
}

.quick-login-btn__text {
  letter-spacing: 1rpx;
}

.quick-login-hint {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #999999;
  margin-top: 24rpx;
  line-height: 1.5;
  padding: 0 16rpx;
}

.mode-switch {
  text-align: center;
  font-size: 26rpx;
  padding: 24rpx 0 8rpx;
}

.mode-switch--subtle {
  font-size: 24rpx;
  color: #667eea;
  text-decoration: underline;
  text-underline-offset: 4rpx;
}

.form-content {
  margin-top: 8rpx;
}

.input-group {
  margin-bottom: 32rpx;
  position: relative;
}

.input-label {
  font-size: 28rpx;
  color: #333333;
  margin-bottom: 16rpx;
  font-weight: 500;
}

.input-field {
  width: 100%;
  height: 88rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 32rpx;
  color: #333333;
  box-sizing: border-box;
}

.input-field::placeholder {
  color: #cccccc;
}

.password-toggle {
  position: absolute;
  right: 24rpx;
  top: 50%;
  transform: translateY(-50%);
  margin-top: 20rpx;
  padding: 8rpx;
  cursor: pointer;
}

.toggle-icon {
  font-size: 32rpx;
}

.login-button {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border-radius: 12rpx;
  font-size: 32rpx;
  font-weight: bold;
  margin-top: 40rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-button::after {
  border: none;
}

.login-button[disabled] {
  background: #cccccc;
  color: #999999;
}
</style>
