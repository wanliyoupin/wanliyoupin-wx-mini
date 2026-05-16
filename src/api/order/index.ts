import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';

/**
 * 获取当前用户的订单列表（用户端「我的订单」）
 * 支持按订单状态、支付状态筛选，以及按订单号/收货人/手机号搜索
 */
export async function getMyOrderList(params: {
  userId: number;
  orderStatus?: string;
  paymentStatus?: string;
  /** 搜索：订单号、收货人、收货手机号 */
  keyword?: string;
  limit?: number;
  offset?: number;
}) {
  const variables: any = {
    userId: params.userId,
    limit: params.limit || 20,
    offset: params.offset || 0,
  };

  const conditions: string[] = ['user_users: { _eq: $userId }', 'is_deleted: { _eq: false }'];
  if (params.orderStatus) {
    conditions.push('order_status: { _eq: $orderStatus }');
    variables.orderStatus = params.orderStatus;
  }
  if (params.paymentStatus) {
    conditions.push('payment_status: { _eq: $paymentStatus }');
    variables.paymentStatus = params.paymentStatus;
  }

  const hasKeyword = params.keyword != null && String(params.keyword).trim() !== '';
  const trimmedKeyword = hasKeyword ? String(params.keyword).trim() : '';
  const searchPattern = hasKeyword ? `%${trimmedKeyword}%` : '';
  const searchId = hasKeyword && /^\d+$/.test(trimmedKeyword) ? Number(trimmedKeyword) : null;

  let whereClause: string;
  const varDecls: string[] = [
    '$userId: bigint!',
    params.orderStatus ? '$orderStatus: String' : '',
    params.paymentStatus ? '$paymentStatus: String' : '',
    '$limit: Int',
    '$offset: Int',
  ].filter(Boolean);
  if (hasKeyword) {
    variables.searchPattern = searchPattern;
    if (searchId != null) variables.searchId = searchId;
    varDecls.push('$searchPattern: String');
    if (searchId != null) varDecls.push('$searchId: bigint');
    const baseWhere = conditions.join('\n          ');
    const orParts = [
      searchId != null ? '{ id: { _eq: $searchId } }' : '',
      '{ receiver_name: { _ilike: $searchPattern } }',
      '{ receiver_phone: { _ilike: $searchPattern } }',
    ].filter(Boolean);
    whereClause = `_and: [\n          { ${baseWhere} },\n          { _or: [ ${orParts.join(', ')} ] }\n        ]`;
  } else {
    whereClause = conditions.join('\n          ');
  }

  const query = `
    query GetMyOrderList(
      ${varDecls.join('\n      ')}
    ) {
      orders(
        where: {
          ${whereClause}
        }
        limit: $limit
        offset: $offset
        order_by: { created_at: desc }
      ) {
        id
        order_status
        payment_status
        total_price
        total_amount
        actual_amount
        price_factor
        remark
        created_at
        updated_at
        company_companies
        company {
          id
          name
        }
        order_items {
          id
          product_name
          product_image_url
          product_price
          quantity
          remark
        }
      }
      orders_aggregate(
        where: {
          ${whereClause}
        }
      ) {
        aggregate {
          count
        }
      }
    }
  `;

  const result = await client.execute({
    query,
    variables,
  });

  return {
    orders: result?.orders || [],
    total: result?.orders_aggregate?.aggregate?.count || 0,
  };
}

/**
 * 获取当前用户的订单详情（用户端）
 */
export async function getMyOrderDetail(orderId: number, userId: number) {
  const query = `
    query GetMyOrderDetail($orderId: bigint!, $userId: bigint!) {
      orders_by_pk(id: $orderId) {
        id
        status
        total_price
        total_amount
        price_factor
        remark
        created_at
        updated_at
        user_users
        company_companies
        company {
          id
          name
        }
      }
    }
  `;

  const result = await client.execute({
    query,
    variables: { orderId, userId },
  });

  const order = result?.orders_by_pk;
  if (!order || Number(order.user_users) !== Number(userId)) {
    return null;
  }
  return order;
}

/**
 * 根据订单 ID 获取订单详情（用于订单详情页，支持分享打开）
 * 返回订单及公司微信二维码，不校验当前用户
 */
export async function getOrderDetailById(orderId: number) {
  const query = `
    query GetOrderDetailById($orderId: bigint!) {
      orders_by_pk(id: $orderId) {
        id
        is_deleted
        order_status
        payment_status
        total_price
        total_amount
        actual_amount
        price_factor
        remark
        receiver_name
        receiver_phone
        receiver_address
        created_at
        company_companies
        user_users
        user {
          id
          mobile
          nickname
        }
        company {
          id
          name
          wechat_code
        }
        order_items {
          id
          product_name
          product_image_url
          product_price
          quantity
          remark
          product_sku {
            product_products
          }
        }
      }
    }
  `;
  const result = await client.execute({
    query,
    variables: { orderId },
  });
  return result?.orders_by_pk ?? null;
}

/**
 * 当前用户软删除自己的订单（is_deleted = true，列表中不再展示）
 */
export async function softDeleteMyOrder(orderId: number, userId: number) {
  const mutation = `
    mutation SoftDeleteMyOrder($orderId: bigint!, $userId: bigint!) {
      update_orders(
        where: {
          id: { _eq: $orderId }
          user_users: { _eq: $userId }
          is_deleted: { _eq: false }
        }
        _set: { is_deleted: true }
      ) {
        affected_rows
      }
    }
  `;
  const result = await client.execute({
    query: mutation,
    variables: { orderId: Number(orderId), userId: Number(userId) },
  });
  const n = (result as { update_orders?: { affected_rows?: number } })?.update_orders?.affected_rows ?? 0;
  if (n < 1) {
    throw new Error('删除失败，订单不存在或无权操作');
  }
}

/**
 * 获取订单下单用户在该公司的权限信息（供公司管理员查看，便于报价）
 * 需调用方确认当前用户为公司管理员后再调用
 */
export async function getOrderUserCompanyInfo(
  userId: number,
  companyId: number
): Promise<{ can_view_price: boolean; price_factor: number } | null> {
  const query = `
    query GetOrderUserCompanyInfo($userId: bigint!, $companyId: bigint!) {
      company_users(
        where: {
          user_users: { _eq: $userId }
          company_companies: { _eq: $companyId }
        }
        limit: 1
      ) {
        can_view_price
        price_factor
        company {
          mode_for_price
          default_for_price_factor
        }
      }
    }
  `;
  const result = await client.execute({
    query,
    variables: { userId: Number(userId), companyId: Number(companyId) },
  });
  const row = result?.company_users?.[0] as
    | {
        can_view_price: boolean;
        price_factor: number | string;
        company?: {
          mode_for_price?: string | null;
          default_for_price_factor?: number | string | null;
        } | null;
      }
    | undefined;
  if (!row) return null;
  const mode = row.company?.mode_for_price;
  const companyFactor = Number(row.company?.default_for_price_factor ?? 1);
  const userFactor = Number(row.price_factor ?? 1);
  const price_factor =
    mode === 'company' && companyFactor > 0 ? companyFactor : userFactor > 0 ? userFactor : 1;
  // 与 auth 一致：公司统一下有成员行的用户视为正式成员，一律可看价
  const can_view_price = mode === 'company' ? true : Boolean(row.can_view_price);
  return {
    can_view_price,
    price_factor,
  };
}

/** 订单项输入（从购物车生成） */
export interface CreateOrderItemInput {
  product_sku_product_skus: number;
  product_name: string;
  product_image_url?: string | null;
  product_price: number;
  quantity: number;
  /** 该子订单/规格的备注 */
  remark?: string | null;
}

/** 创建订单（从购物车选中项提交） */
export async function createOrder(params: {
  userId: number;
  companyId: number;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  receiver_province?: string | null;
  receiver_city?: string | null;
  receiver_district?: string | null;
  price_factor: number;
  total_price: number;
  total_amount: number;
  remark?: string | null;
  items: CreateOrderItemInput[];
}) {
  const mutation = `
    mutation CreateOrder($object: orders_insert_input!) {
      insert_orders_one(object: $object) {
        id
        order_status
        total_amount
        created_at
      }
    }
  `;
  const orderItemsData = params.items.map((item) => ({
    product_sku_product_skus: item.product_sku_product_skus,
    product_name: item.product_name,
    product_image_url: item.product_image_url || null,
    product_price: item.product_price,
    quantity: item.quantity,
    remark: item.remark ?? null,
  }));

  const object = {
    user_users: params.userId,
    company_companies: params.companyId,
    receiver_name: params.receiver_name,
    receiver_phone: params.receiver_phone,
    receiver_address: params.receiver_address,
    receiver_province: params.receiver_province ?? null,
    receiver_city: params.receiver_city ?? null,
    receiver_district: params.receiver_district ?? null,
    price_factor: params.price_factor,
    total_price: params.total_price,
    total_amount: params.total_amount,
    actual_amount: 0,
    order_status: 'pending',
    payment_status: 'pending',
    remark: params.remark || null,
    is_deleted: false,
    order_items: {
      data: orderItemsData,
    },
  };

  const result = await client.execute({
    query: mutation,
    variables: { object },
  });
  return result?.insert_orders_one;
}

/** 确认订单（订单状态 pending -> confirmed，主包订单详情页管理员操作用） */
export async function confirmOrder(orderId: number) {
  const mutation = `
    mutation ConfirmOrder($orderId: bigint!, $set: orders_set_input!) {
      update_orders_by_pk(
        pk_columns: { id: $orderId }
        _set: $set
      ) {
        id
        order_status
        updated_at
      }
    }
  `;
  const result = await client.execute({
    query: mutation,
    variables: {
      orderId: Number(orderId),
      set: { order_status: 'confirmed' },
    },
  });
  const updated = result?.update_orders_by_pk;
  if (!updated && result?.errors) {
    const err = result.errors[0];
    throw new Error(err?.message || '更新失败');
  }
  return updated;
}

/** 确认收款（支付状态 pending -> approved；可设置实际收款金额；completeOrder=false 时不改订单状态，归档单独操作） */
export async function approvePayment(
  orderId: number,
  completeOrder = false,
  actualAmount?: number
) {
  const set: { payment_status: string; order_status?: string; actual_amount?: number } = {
    payment_status: 'approved',
  };
  if (completeOrder) set.order_status = 'completed';
  if (actualAmount != null && !Number.isNaN(actualAmount)) set.actual_amount = actualAmount;
  const mutation = `
    mutation ApprovePayment($orderId: bigint!, $set: orders_set_input!) {
      update_orders_by_pk(
        pk_columns: { id: $orderId }
        _set: $set
      ) {
        id
        order_status
        payment_status
        updated_at
      }
    }
  `;
  const result = await client.execute({
    query: mutation,
    variables: { orderId, set },
  });
  return result?.update_orders_by_pk;
}

/** 归档订单：order_status -> completed（已确认且已支付后使用） */
export async function completeOrder(orderId: number) {
  const mutation = `
    mutation CompleteOrder($orderId: bigint!, $set: orders_set_input!) {
      update_orders_by_pk(
        pk_columns: { id: $orderId }
        _set: $set
      ) {
        id
        order_status
        updated_at
      }
    }
  `;
  const result = await client.execute({
    query: mutation,
    variables: { orderId, set: { order_status: 'completed' } },
  });
  return result?.update_orders_by_pk;
}

/** 修改订单实际收款金额（仅更新 actual_amount，订单未完成时管理员可用） */
export async function updateOrderActualAmount(orderId: number, actualAmount: number) {
  const mutation = `
    mutation UpdateOrderActualAmount($orderId: bigint!, $set: orders_set_input!) {
      update_orders_by_pk(
        pk_columns: { id: $orderId }
        _set: $set
      ) {
        id
        actual_amount
        updated_at
      }
    }
  `;
  const result = await client.execute({
    query: mutation,
    variables: {
      orderId: Number(orderId),
      set: { actual_amount: actualAmount },
    },
  });
  return result?.update_orders_by_pk;
}
