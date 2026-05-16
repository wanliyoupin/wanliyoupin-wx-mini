import { setUserContext, user_token } from '@/store/userStore';
import { wxSilentLogin } from '@/api/user/index';

/** 防止 onLaunch / onShow / 退出登录后并发多次 wx.login */
let wxSilentAuthPromise: Promise<void> | null = null;

async function runWxSilentAuthOnce(): Promise<void> {
  if (user_token.value) return;
  // #ifdef MP-WEIXIN
  try {
    const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: resolve,
        fail: reject,
      });
    });
    if (!loginRes.code) return;
    const data = await wxSilentLogin(loginRes.code);
    if (data?.token) {
      setUserContext({
        user: data.user || { id: data.userId },
        token: data.token,
        userId: data.userId,
      });
    }
  } catch (e) {
    console.warn('微信静默登录失败:', e);
  }
  // #endif
}

/** 无 token 时 wx.login 静默注册/识别 wx_guest_user（与 App.vue 共用同一互斥） */
export async function ensureWxSilentAuth(): Promise<void> {
  if (user_token.value) return;
  if (!wxSilentAuthPromise) {
    wxSilentAuthPromise = runWxSilentAuthOnce().finally(() => {
      wxSilentAuthPromise = null;
    });
  }
  await wxSilentAuthPromise;
}
