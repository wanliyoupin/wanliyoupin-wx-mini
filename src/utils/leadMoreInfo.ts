import type { LeadLocation } from '@/utils/leadLocation';
import { parseLeadLocationFromMoreInfo } from '@/utils/leadLocation';

/** 与导出模板、more_info JSON 键一致 */
export const BUSINESS_TYPE_OPTIONS = ['全包', '半包', '设计', '夫妻'] as const;
export const CUSTOMER_LEVEL_OPTIONS = ['重点A级', '潜力B级', '普通C级', '无效D级'] as const;
export const FIRST_EVALUATION_OPTIONS = [
  '沟通流畅',
  '认同感强',
  '热情好客',
  '敷衍了事',
  '排斥反感',
] as const;

export type LeadMoreInfoForm = {
  region: string;
  storefrontImageUrl: string;
  companyName: string;
  contactPerson: string;
  wechat: string;
  businessType: string;
  visitDate: string;
  customerLevel: string;
  firstEvaluation: string;
  catalogDelivery: string;
  firstVisitDesc: string;
  firstOrderAt: string;
  orderCount: string;
  orderAmount: string;
  remark: string;
};

const STRING_KEYS: (keyof LeadMoreInfoForm)[] = [
  'region',
  'storefrontImageUrl',
  'companyName',
  'contactPerson',
  'wechat',
  'businessType',
  'visitDate',
  'customerLevel',
  'firstEvaluation',
  'catalogDelivery',
  'firstVisitDesc',
  'firstOrderAt',
  'orderCount',
  'orderAmount',
  'remark',
];

function readStr(moreInfo: unknown, key: string): string {
  if (moreInfo == null || typeof moreInfo !== 'object' || Array.isArray(moreInfo)) return '';
  const v = (moreInfo as Record<string, unknown>)[key];
  if (v == null) return '';
  return String(v).trim();
}

export function todayDateString(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function emptyLeadMoreInfoForm(): LeadMoreInfoForm {
  return {
    region: '',
    storefrontImageUrl: '',
    companyName: '',
    contactPerson: '',
    wechat: '',
    businessType: '',
    visitDate: todayDateString(),
    customerLevel: '',
    firstEvaluation: '',
    catalogDelivery: '',
    firstVisitDesc: '',
    firstOrderAt: '',
    orderCount: '',
    orderAmount: '',
    remark: '',
  };
}

/** 从 more_info 解析表单字段；leadName 作为公司名称兜底 */
export function parseLeadMoreInfoForm(moreInfo: unknown, leadName?: string): LeadMoreInfoForm {
  const form = emptyLeadMoreInfoForm();
  for (const key of STRING_KEYS) {
    form[key] = readStr(moreInfo, key);
  }
  if (!form.storefrontImageUrl) {
    form.storefrontImageUrl = readStr(moreInfo, 'storefrontImage');
  }
  if (!form.companyName && leadName) form.companyName = leadName.trim();
  return form;
}

/** 新建：只提交有值字段 */
export function buildMoreInfoPayload(form: LeadMoreInfoForm): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const key of STRING_KEYS) {
    const v = form[key].trim();
    if (v) payload[key] = v;
  }
  return payload;
}

/** 编辑：提交全部字段，空值写 null 以便清除旧数据 */
export function buildMoreInfoUpdatePayload(
  form: LeadMoreInfoForm
): Record<string, string | null> {
  const payload: Record<string, string | null> = {};
  for (const key of STRING_KEYS) {
    const v = form[key].trim();
    payload[key] = v || null;
  }
  return payload;
}

export function guessRegionFromLocation(loc: LeadLocation | null): string {
  if (!loc) return '';
  const text = loc.address || loc.name || '';
  if (!text) return '';
  const m = text.match(/(.+?(?:省|自治区|市|区|县|旗))/);
  return m?.[1]?.trim() || text.slice(0, 24);
}

export function pickerIndex(options: readonly string[], value: string): number {
  const idx = options.indexOf(value);
  return idx >= 0 ? idx : 0;
}

export function parseLeadLocationFromForm(
  moreInfo: unknown
): LeadLocation | null {
  return parseLeadLocationFromMoreInfo(moreInfo);
}
