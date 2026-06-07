import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';
import type { LeadLocation } from '@/utils/leadLocation';
import { getCompanyUserRoleCached, isPlatformAdmin } from '@/utils/auth';

export type LeadStatus = 'new' | 'lost' | 'converted';

export type LeadRow = {
  id: number;
  name: string;
  phone: string;
  status: LeadStatus | string;
  company_companies?: number;
  created_by_company_users?: number | null;
  created_at?: string;
  updated_at?: string;
  more_info?: unknown;
  companyUserByCreatedByCompanyUsers?: {
    user?: { nickname?: string; mobile?: string };
  } | null;
  company_lead_tracks?: LeadTrack[];
};

export type LeadTrack = {
  id: number;
  content: string;
  attachments?: unknown;
  created_at?: string;
  company_user?: {
    id: number;
    user?: { nickname?: string; mobile?: string };
  } | null;
};

export type LeadDetail = LeadRow & {
  company_lead_tracks?: LeadTrack[];
};

export const LEAD_STATUS_LABEL: Record<string, string> = {
  new: '新建',
  lost: '失败',
  converted: '已转客户',
};

const LEAD_STATUSES = new Set(['new', 'lost', 'converted']);

const LEAD_LIST_FIELDS = `
  id
  name
  phone
  status
  company_companies
  created_by_company_users
  created_at
  updated_at
  more_info
  companyUserByCreatedByCompanyUsers {
    id
    user { nickname mobile }
  }
  company_lead_tracks(order_by: { created_at: asc }) {
    id
    content
    created_at
  }
`;

const LEAD_TRACK_FIELDS = `
  id
  content
  attachments
  created_at
  created_by_company_users
  company_user {
    id
    user { nickname mobile }
  }
`;

function mergeLeadMoreInfo(
  existing: unknown,
  stringPatch?: Record<string, string | null>,
  location?: LeadLocation | null
): Record<string, unknown> | null {
  const hasPatch = stringPatch && Object.keys(stringPatch).length > 0;
  const hasLoc = location !== undefined;
  if (!hasPatch && !hasLoc) return null;

  const base =
    existing != null && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};

  if (stringPatch) {
    for (const [key, val] of Object.entries(stringPatch)) {
      if (val === null || val === '') delete base[key];
      else base[key] = val;
    }
  }
  if (hasLoc) {
    if (location === null) delete base.location;
    else base.location = location;
  }
  return Object.keys(base).length > 0 ? base : null;
}

async function resolveMyCompanyUserId(companyId: number): Promise<number | null> {
  const role = await getCompanyUserRoleCached(companyId, true);
  return role?.companyUserId ?? null;
}

async function assertCanManageLead(lead: LeadRow): Promise<void> {
  if (await isPlatformAdmin()) return;
  const companyId = lead.company_companies;
  if (companyId == null) throw new Error('数据异常');
  const myCuId = await resolveMyCompanyUserId(Number(companyId));
  if (myCuId == null || lead.created_by_company_users !== myCuId) {
    throw new Error('无权限操作该线索');
  }
}

async function buildLeadListWhere(params: {
  companyId: number;
  status?: string;
  keyword?: string;
}): Promise<Record<string, unknown>> {
  const and: Record<string, unknown>[] = [{ company_companies: { _eq: params.companyId } }];
  if (params.status) and.push({ status: { _eq: params.status } });
  if (params.keyword?.trim()) {
    const kw = `%${params.keyword.trim()}%`;
    and.push({
      _or: [{ name: { _ilike: kw } }, { phone: { _ilike: kw } }],
    });
  }
  if (!(await isPlatformAdmin())) {
    const myCuId = await resolveMyCompanyUserId(params.companyId);
    if (myCuId == null) throw new Error('无法查询线索');
    and.push({ created_by_company_users: { _eq: myCuId } });
  }
  return { _and: and };
}

export async function fetchLeadList(params: {
  companyId: number;
  status?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const where = await buildLeadListWhere(params);

  const res = (await client.execute({
    query: `
      query LeadList($where: company_leads_bool_exp!, $limit: Int!, $offset: Int!) {
        company_leads(
          where: $where
          limit: $limit
          offset: $offset
          order_by: { updated_at: desc }
        ) {
          ${LEAD_LIST_FIELDS}
        }
        company_leads_aggregate(where: $where) {
          aggregate { count }
        }
      }
    `,
    variables: { where, limit, offset },
  })) as {
    company_leads?: LeadRow[];
    company_leads_aggregate?: { aggregate?: { count?: number } };
  };

  return {
    leads: res.company_leads ?? [],
    total: res.company_leads_aggregate?.aggregate?.count ?? 0,
  };
}

export async function createLead(params: {
  companyId: number;
  name: string;
  phone: string;
  location?: LeadLocation | null;
  moreInfo?: Record<string, string>;
}) {
  const myCuId = await resolveMyCompanyUserId(params.companyId);
  if (myCuId == null) throw new Error('无法创建线索');

  const mergedPatch = {
    ...(params.moreInfo ?? {}),
    companyName: params.moreInfo?.companyName ?? params.name,
  };
  const moreInfo = mergeLeadMoreInfo(null, mergedPatch, params.location ?? undefined);

  const object: Record<string, unknown> = {
    company_companies: params.companyId,
    name: params.name.trim(),
    phone: params.phone.trim(),
    status: 'new',
    created_by_company_users: myCuId,
  };
  if (moreInfo) object.more_info = moreInfo;

  const res = (await client.execute({
    query: `
      mutation InsertLead($object: company_leads_insert_input!) {
        insert_company_leads_one(object: $object) {
          ${LEAD_LIST_FIELDS}
        }
      }
    `,
    variables: { object },
  })) as { insert_company_leads_one?: LeadRow | null };

  const row = res.insert_company_leads_one;
  if (!row) throw new Error('创建失败');
  return row;
}

export async function updateLeadProfile(
  leadId: number,
  params: {
    name?: string;
    phone?: string;
    location?: LeadLocation | null;
    moreInfo?: Record<string, string | null>;
  }
) {
  const detail = await fetchLeadDetail(leadId);
  await assertCanManageLead(detail);
  if (detail.status === 'converted') throw new Error('已转客户，不可编辑');

  const patch: Record<string, unknown> = {};
  if (params.name !== undefined) patch.name = params.name.trim();
  if (params.phone !== undefined) patch.phone = params.phone.trim();

  const nameForMore = typeof patch.name === 'string' ? patch.name : detail.name;
  const morePatch =
    params.moreInfo && !params.moreInfo.companyName
      ? { ...params.moreInfo, companyName: nameForMore }
      : params.moreInfo;
  const merged = mergeLeadMoreInfo(detail.more_info, morePatch, params.location);
  if (merged !== null) patch.more_info = merged;

  return patchLead(leadId, patch, detail);
}

export async function fetchLeadDetail(leadId: number): Promise<LeadDetail> {
  const res = (await client.execute({
    query: `
      query LeadDetail($id: bigint!) {
        company_leads_by_pk(id: $id) {
          ${LEAD_LIST_FIELDS}
          company_lead_tracks(order_by: { created_at: asc }) {
            ${LEAD_TRACK_FIELDS}
          }
        }
      }
    `,
    variables: { id: leadId },
  })) as { company_leads_by_pk?: LeadDetail | null };

  const lead = res.company_leads_by_pk;
  if (!lead) throw new Error('线索不存在');
  await assertCanManageLead(lead);
  return lead;
}

export async function patchLead(
  leadId: number,
  body: Record<string, unknown>,
  cachedLead?: LeadRow
) {
  if (body.action === 'convert') {
    return convertLead(leadId, cachedLead);
  }

  const lead = cachedLead ?? (await fetchLeadDetail(leadId));
  if (lead.status === 'converted') throw new Error('已转客户，不可修改');

  const patch: Record<string, unknown> = {};

  if (body.status !== undefined) {
    const st = typeof body.status === 'string' ? body.status : '';
    if (!LEAD_STATUSES.has(st) || st === 'converted') {
      throw new Error('无效的状态');
    }
    patch.status = st;
  }
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new Error('name 不能为空');
    patch.name = name;
  }
  if (body.phone !== undefined) {
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (!phone) throw new Error('phone 不能为空');
    patch.phone = phone;
  }
  if (body.moreInfo !== undefined && body.moreInfo !== null && typeof body.moreInfo === 'object') {
    const merged = mergeLeadMoreInfo(
      lead.more_info,
      body.moreInfo as Record<string, string | null>,
      undefined
    );
    if (merged !== null) patch.more_info = merged;
  }
  if (body.location !== undefined) {
    const merged = mergeLeadMoreInfo(lead.more_info, undefined, body.location as LeadLocation | null);
    if (merged !== null) patch.more_info = merged;
  }

  if (Object.keys(patch).length === 0) throw new Error('无有效更新字段');

  const res = (await client.execute({
    query: `
      mutation UpdateLead($id: bigint!, $patch: company_leads_set_input!) {
        update_company_leads_by_pk(pk_columns: { id: $id }, _set: $patch) {
          ${LEAD_LIST_FIELDS}
        }
      }
    `,
    variables: { id: leadId, patch },
  })) as { update_company_leads_by_pk?: LeadRow | null };

  const row = res.update_company_leads_by_pk;
  if (!row) throw new Error('更新失败');
  return row;
}

export async function addLeadTrack(leadId: number, content: string) {
  const lead = await fetchLeadDetail(leadId);
  if (lead.status === 'converted') throw new Error('已转客户，不可跟进');

  const companyId = lead.company_companies;
  if (companyId == null) throw new Error('数据异常');
  const myCuId = await resolveMyCompanyUserId(Number(companyId));
  if (myCuId == null) throw new Error('无法添加跟进');

  const res = (await client.execute({
    query: `
      mutation AddTrack($object: company_lead_tracks_insert_input!) {
        insert_company_lead_tracks_one(object: $object) {
          ${LEAD_TRACK_FIELDS}
        }
      }
    `,
    variables: {
      object: {
        company_lead_company_leads: leadId,
        content: content.trim(),
        attachments: [],
        created_by_company_users: myCuId,
      },
    },
  })) as { insert_company_lead_tracks_one?: LeadTrack | null };

  const row = res.insert_company_lead_tracks_one;
  if (!row) throw new Error('写入失败');
  return row;
}

async function convertLead(leadId: number, cachedLead?: LeadRow) {
  const lead = cachedLead ?? (await fetchLeadDetail(leadId));
  await assertCanManageLead(lead);

  if (lead.status === 'converted') throw new Error('已转化，勿重复操作');
  const companyId = lead.company_companies;
  if (companyId == null) throw new Error('数据异常');

  const mobile = String(lead.phone).trim();
  if (mobile.length !== 11) throw new Error('线索手机号非 11 位，无法匹配用户');

  const userRes = (await client.execute({
    query: `
      query UserByMobile($m: String!) {
        users(where: { mobile: { _eq: $m } }, limit: 1) { id }
      }
    `,
    variables: { m: mobile },
  })) as { users?: { id: number }[] };

  let userId = userRes.users?.[0]?.id;
  if (!userId) {
    const createRes = (await client.execute({
      query: `
        mutation CreateUser($m: String!) {
          insert_users_one(object: { mobile: $m, role: "user" }) { id }
        }
      `,
      variables: { m: mobile },
    })) as { insert_users_one?: { id: number } | null };
    userId = createRes.insert_users_one?.id;
    if (!userId) throw new Error('创建平台用户失败');
  }

  const cuRes = (await client.execute({
    query: `
      mutation AddCompanyUser($object: company_users_insert_input!) {
        insert_company_users_one(
          object: $object
          on_conflict: {
            constraint: company_users_company_companies_user_users_key
            update_columns: [role, level, can_view_price, price_factor]
          }
        ) {
          id
        }
      }
    `,
    variables: {
      object: {
        user_users: userId,
        company_companies: companyId,
        role: 'user',
        level: 'A',
        can_view_price: true,
        price_factor: 1,
      },
    },
  })) as { insert_company_users_one?: { id: number } | null };

  const cuId = cuRes.insert_company_users_one?.id;
  if (!cuId) throw new Error('写入公司客户失败');

  const nowIso = new Date().toISOString();
  const updRes = (await client.execute({
    query: `
      mutation FinishConvert($id: bigint!, $cu: bigint!, $uid: bigint!, $at: timestamptz!) {
        update_company_leads_by_pk(
          pk_columns: { id: $id }
          _set: {
            status: "converted"
            converted_company_users: $cu
            converted_at: $at
            linked_user_users: $uid
          }
        ) {
          ${LEAD_LIST_FIELDS}
        }
      }
    `,
    variables: { id: leadId, cu: cuId, uid: userId, at: nowIso },
  })) as { update_company_leads_by_pk?: LeadRow | null };

  const updated = updRes.update_company_leads_by_pk;
  if (!updated) throw new Error('更新线索状态失败');
  return updated;
}

/** 拉取当前筛选条件下全部线索（分页合并，供导出） */
export async function fetchAllLeadsForExport(params: {
  companyId: number;
  status?: string;
  keyword?: string;
}) {
  const pageSize = 100;
  let offset = 0;
  let total = 0;
  const all: LeadRow[] = [];
  do {
    const res = await fetchLeadList({
      companyId: params.companyId,
      status: params.status,
      keyword: params.keyword,
      limit: pageSize,
      offset,
    });
    total = res.total ?? 0;
    const batch = res.leads ?? [];
    all.push(...batch);
    offset += pageSize;
    if (batch.length < pageSize) break;
  } while (all.length < total);
  return all;
}
