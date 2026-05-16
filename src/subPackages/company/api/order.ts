import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';

export async function getOrderList(params: {
  companyId: number;
  orderStatus?: string;
  paymentStatus?: string;
  /** 搜索：订单号、收货人、收货手机号、用户手机号 */
  keyword?: string;
  limit?: number;
  offset?: number;
}) {
  const variables: any = {
    companyId: params.companyId,
    limit: params.limit || 20,
    offset: params.offset || 0,
  };

  const conditions: string[] = ['company_companies: { _eq: $companyId }'];
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
    '$companyId: bigint!',
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
      '{ user: { mobile: { _ilike: $searchPattern } } }',
    ].filter(Boolean);
    whereClause = `_and: [\n          { ${baseWhere} },\n          { _or: [ ${orParts.join(', ')} ] }\n        ]`;
  } else {
    whereClause = conditions.join('\n          ');
  }

  const query = `
    query GetOrderList(
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
        user {
          id
          mobile
          nickname
          avatar_url
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

export async function getOrderDetail(orderId: number) {
  const query = `
    query GetOrderDetail($orderId: bigint!) {
      orders_by_pk(id: $orderId) {
        id
        order_status
        payment_status
        total_price
        total_amount
        price_factor
        remark
        receiver_name
        receiver_phone
        receiver_address
        created_at
        updated_at
        user {
          id
          mobile
          nickname
          avatar_url
        }
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
    }
  `;

  const result = await client.execute({
    query,
    variables: { orderId },
  });

  return result?.orders_by_pk;
}

/** 确认订单（订单状态 pending -> confirmed） */
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

/** 确认收款（支付状态 pending -> approved；可传实际收款金额；completeOrder=false 时不改订单状态） */
export async function approvePayment(
  orderId: number,
  completeOrder = true,
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

/** 归档订单：order_status -> completed（仅当已确认且已支付后使用） */
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
