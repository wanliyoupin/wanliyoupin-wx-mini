/**
 * 安全返回：有上一页则 navigateBack，否则 reLaunch 到首页（避免从分享进入时「无法返回」报错）
 */
export function safeNavigateBack(fallbackUrl = '/pages/index/index') {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.reLaunch({ url: fallbackUrl });
  }
}
