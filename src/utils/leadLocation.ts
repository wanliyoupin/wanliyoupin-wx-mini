/** 线索 more_info.location，与后端 leadAuth 结构一致 */
export type LeadLocation = {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
};

export function parseLeadLocationFromMoreInfo(moreInfo: unknown): LeadLocation | null {
  if (moreInfo == null || typeof moreInfo !== 'object' || Array.isArray(moreInfo)) return null;
  const loc = (moreInfo as Record<string, unknown>).location;
  if (loc == null || typeof loc !== 'object' || Array.isArray(loc)) return null;
  const o = loc as Record<string, unknown>;
  const latitude = Number(o.latitude);
  const longitude = Number(o.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    name: typeof o.name === 'string' ? o.name : undefined,
    address: typeof o.address === 'string' ? o.address : undefined,
  };
}

export function formatLeadLocationText(loc: LeadLocation | null): string {
  if (!loc) return '';
  if (loc.address) return loc.address;
  if (loc.name) return loc.name;
  return `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
}

const LOCATION_SCOPE = 'scope.userLocation';

function promptOpenLocationSettings(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: '需要位置权限',
      content: '请允许使用位置信息，以便在地图上选择线索位置',
      confirmText: '去设置',
      cancelText: '取消',
      success: (modalRes) => {
        if (!modalRes.confirm) {
          resolve(false);
          return;
        }
        uni.openSetting({
          success: (settingRes) => {
            resolve(!!settingRes.authSetting?.[LOCATION_SCOPE]);
          },
          fail: () => resolve(false),
        });
      },
      fail: () => resolve(false),
    });
  });
}

function mapChooseLocationError(errMsg: string): string {
  const msg = errMsg.toLowerCase();
  if (msg.includes('cancel') || msg.includes('取消')) return '';
  if (msg.includes('app.json') && msg.includes('userlocation')) {
    return '小程序未声明位置权限，请停止并重新编译项目后在开发者工具中刷新';
  }
  if (msg.includes('auth deny') || msg.includes('authorize') || msg.includes('permission')) {
    return '位置权限未开启，请在设置中允许使用位置信息';
  }
  if (msg.includes('requiredprivateinfos') || msg.includes('privacy')) {
    return '小程序未配置地图选点权限，请联系管理员在微信公众平台完善隐私设置';
  }
  if (msg.includes('system permission denied')) {
    return '请在手机系统设置中为本微信开启定位权限';
  }
  return '打开地图失败，请确认已授权位置并重新编译小程序后再试';
}

/** 微信小程序：用户须先同意隐私协议，否则 chooseLocation 会直接失败 */
async function ensurePrivacyAuthorized(): Promise<void> {
  const wxApi = (globalThis as { wx?: { requirePrivacyAuthorize?: (o: {
    success?: () => void;
    fail?: (e: { errMsg?: string }) => void;
  }) => void } }).wx;
  if (!wxApi?.requirePrivacyAuthorize) return;

  await new Promise<void>((resolve, reject) => {
    wxApi.requirePrivacyAuthorize!({
      success: () => resolve(),
      fail: () => {
        reject(new Error('需同意隐私政策后才能使用地图选点'));
      },
    });
  });
}

async function handleChooseLocationFail(errMsg: string): Promise<never> {
  const hint = mapChooseLocationError(errMsg);
  if (!hint) {
    throw new Error('');
  }
  if (hint.includes('权限') || hint.includes('设置')) {
    const ok = await promptOpenLocationSettings();
    if (ok) {
      throw new Error(`${hint}，开启后请再次点击选点`);
    }
  }
  throw new Error(hint);
}

/** 打开微信地图选点（含隐私协议；直接 chooseLocation，由微信处理授权弹窗） */
export async function chooseLeadLocation(): Promise<LeadLocation | null> {
  try {
    await ensurePrivacyAuthorized();
  } catch (e) {
    throw e instanceof Error ? e : new Error('隐私授权未通过');
  }

  return new Promise((resolve, reject) => {
    uni.chooseLocation({
      success: (res) => {
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          name: res.name || undefined,
          address: res.address || undefined,
        });
      },
      fail: (err: UniApp.GeneralCallbackResult) => {
        void handleChooseLocationFail(err?.errMsg || '')
          .catch((e: Error) => {
            if (!e.message) resolve(null);
            else reject(e);
          });
      },
    });
  });
}

/** 在系统地图中打开已保存的位置 */
export function openLeadLocation(loc: LeadLocation) {
  uni.openLocation({
    latitude: loc.latitude,
    longitude: loc.longitude,
    name: loc.name || '线索位置',
    address: loc.address || '',
    scale: 16,
  });
}
