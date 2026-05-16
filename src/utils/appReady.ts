/**
 * 全局就绪：App onLaunch 内所有必要请求（公司 ID、公司信息、用户信息等）完成后再 resolve。
 * 页面在发起依赖全局数据的请求前应 await whenAppReady()，避免时序导致的 bug。
 */
let _resolve: (() => void) | null = null;
const appReadyPromise = new Promise<void>((resolve) => {
  _resolve = resolve;
});

export function whenAppReady(): Promise<void> {
  return appReadyPromise;
}

export function setAppReady(): void {
  if (_resolve) {
    _resolve();
    _resolve = null;
  }
}
