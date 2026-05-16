/**
 * 小程序码 / 扫码进入时的 scene 解析（微信会 urlencode，需安全 decode）
 */
export function safeDecodeURIComponent(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

/** 合并后的扁平 query（含 scene / 普通链接二维码 q 展开后的键） */
export type MiniProgramFlatQuery = Record<string, string>;

export function parseMiniProgramScene(scene: string | null | undefined): URLSearchParams | null {
  if (scene == null || scene === '') return null;
  const raw = safeDecodeURIComponent(String(scene));
  try {
    return new URLSearchParams(raw);
  } catch {
    return null;
  }
}

/**
 * 解析小程序码自定义 scene（如 id%3D1460%26companyId%3D5）。
 * 兼容：双重 urlencode、部分环境下 URLSearchParams 解析异常时用手动按 & 拆分。
 */
export function flattenMiniProgramSceneToRecord(scene: string | null | undefined): MiniProgramFlatQuery {
  const out: MiniProgramFlatQuery = {};
  if (scene == null || scene === '') return out;
  let raw = String(scene).trim();
  raw = safeDecodeURIComponent(raw);
  if (/%[0-9A-Fa-f]{2}/.test(raw)) {
    raw = safeDecodeURIComponent(raw);
  }
  try {
    const sp = new URLSearchParams(raw);
    sp.forEach((v, k) => {
      if (v !== '') out[k] = v;
    });
  } catch {
    // ignore
  }
  if (Object.keys(out).length === 0) {
    for (const part of raw.split('&')) {
      const eq = part.indexOf('=');
      if (eq <= 0) continue;
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      if (k && v) out[k] = v;
    }
  }
  return out;
}

/** 解析 scene 或普通 query 中的正整数 id（排除 NaN） */
export function parsePositiveIntParam(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function assignParamsFromEncodedUrlQuery(encodedQ: string, target: MiniProgramFlatQuery) {
  try {
    const decoded = safeDecodeURIComponent(encodedQ);
    const qIdx = decoded.indexOf('?');
    const fragment =
      qIdx >= 0 ? decoded.slice(qIdx + 1).split('#')[0] : decoded.split('#')[0];
    const params = new URLSearchParams(fragment);
    params.forEach((v, k) => {
      if (v !== '' && target[k] == null) target[k] = v;
    });
  } catch {
    // ignore
  }
}

/**
 * 将微信 onLoad / App.query 上的扁平对象展开：`id`、`companyId` 等直传字段 +
 * `scene`（小程序码自定义参数）+ `q`（扫普通链接二维码时的整段 URL）
 */
export function expandFlatQueryObject(
  q: Record<string, string | undefined> | null | undefined
): MiniProgramFlatQuery {
  const out: MiniProgramFlatQuery = {};
  if (!q) return out;
  for (const key of Object.keys(q)) {
    if (key === 'scene' || key === 'q') continue;
    const v = q[key];
    if (v != null && v !== '') out[key] = String(v);
  }
  if (q.scene != null && q.scene !== '') {
    const fromScene = flattenMiniProgramSceneToRecord(q.scene);
    for (const k of Object.keys(fromScene)) {
      if (fromScene[k] !== '' && out[k] == null) out[k] = fromScene[k];
    }
  }
  if (q.q != null && q.q !== '') {
    assignParamsFromEncodedUrlQuery(q.q, out);
  }
  return out;
}

/**
 * 合并页面 onLoad 参数与 `getLaunchOptionsSync` / `getEnterOptionsSync` 的 query。
 * 顺序：先冷启动/入口 query（补全首次扫码时页面未带上 scene 的情况），再用当前页参数覆盖（分享链接、路由跳转以页面为准）。
 */
export function mergeMiniProgramEntryQuery(
  pageOptions?: Record<string, string | undefined>
): MiniProgramFlatQuery {
  const merged: MiniProgramFlatQuery = {};
  const applyFill = (flat?: Record<string, string | undefined>) => {
    const e = expandFlatQueryObject(flat);
    for (const k of Object.keys(e)) {
      if (merged[k] == null) merged[k] = e[k];
    }
  };
  try {
    const lo = uni.getLaunchOptionsSync?.() as { query?: Record<string, string | undefined> } | undefined;
    if (lo?.query) applyFill(lo.query);
  } catch {
    // ignore
  }
  try {
    const eo = (uni as any).getEnterOptionsSync?.() as { query?: Record<string, string | undefined> } | undefined;
    if (eo?.query) applyFill(eo.query);
  } catch {
    // ignore
  }
  const pageExpanded = expandFlatQueryObject(pageOptions);
  for (const k of Object.keys(pageExpanded)) {
    merged[k] = pageExpanded[k];
  }
  return merged;
}
