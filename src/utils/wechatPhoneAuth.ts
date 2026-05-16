import { wechatLogin } from '@/api/user/index';
import { setUserContext, ensureUserInfoCached, clearUserContext } from '@/store/userStore';
import { syncCompanyContextAfterAuthLogin } from '@/utils/postAuthCompanySync';

export type PhoneAuthDetail = { errMsg?: string; code?: string };

/**
 * 微信「手机号快捷验证」回调里调用：仅当 errMsg 为 getPhoneNumber:ok 时传 e.detail
 * @returns 是否成功换发正式用户 token
 */
export async function completePhoneNumberAuth(detail: PhoneAuthDetail): Promise<{
  ok: boolean;
  message?: string;
}> {
  if (detail.errMsg !== 'getPhoneNumber:ok' || !detail.code) {
    return {
      ok: false,
      message: detail.errMsg?.includes('deny') || detail.errMsg?.includes('cancel') ? '已取消授权' : '需要授权手机号',
    };
  }

  try {
    await ensureUserInfoCached(true);

    const result = await wechatLogin({
      code: detail.code,
      codeSource: 'phone',
    });

    if (result?.token) {
      setUserContext({
        user: result.user || { id: result.userId },
        token: result.token,
        userId: result.userId,
      });
      try {
        await syncCompanyContextAfterAuthLogin(result.user || { id: result.userId });
      } catch (e) {
        clearUserContext();
        return {
          ok: false,
          message: e instanceof Error ? e.message : '登录后同步公司失败',
        };
      }
      return { ok: true };
    }
    return { ok: false, message: '登录失败' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '授权失败';
    return { ok: false, message: msg };
  }
}
