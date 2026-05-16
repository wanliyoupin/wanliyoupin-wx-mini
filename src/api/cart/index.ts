import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';
import { userInfo, companyInfo } from '@/store/userStore';

/**
 * 获取购物车列表（严格按当前所属公司，不同公司看到不同购物车数据）
 */
export async function getCartList() {
  if (!userInfo.value?.id) {
    throw new Error('未登录，请先登录');
  }

  const companyId = companyInfo.value?.id;
  if (!companyId) {
    return [];
  }

  const query = `
    query GetCartList($userId: bigint!, $companyId: bigint!) {
      carts(
        where: {
          user_users: { _eq: $userId }
          company_companies: { _eq: $companyId }
        }
        order_by: { created_at: desc }
      ) {
        id
        quantity
        selected
        created_at
        product_sku {
          id
          name
          price
          stock
          image_url
          is_shelved
          product {
            id
            name
            cover_image_url
          }
        }
      }
    }
  `;

  const result = await client.execute({
    query,
    variables: { userId: Number(userInfo.value.id), companyId: Number(companyId) },
  });

  return result?.carts || [];
}

/**
 * 添加商品到购物车（归属当前所属公司，不同公司购物车隔离）
 */
export async function addToCart(params: {
  skuId: number;
  quantity?: number;
}) {
  if (!userInfo.value?.id) {
    throw new Error('未登录，请先登录');
  }

  const companyId = companyInfo.value?.id;
  if (!companyId) {
    throw new Error('请先选择或进入公司');
  }

  const mutation = `
    mutation AddToCart($cart: carts_insert_input!) {
      insert_carts_one(
        object: $cart
        on_conflict: {
          constraint: carts_product_sku_product_skus_user_users_company_companies_key
          update_columns: [quantity, selected]
        }
      ) {
        id
        quantity
        selected
        product_sku {
          id
          name
          price
        }
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: {
      cart: {
        user_users: Number(userInfo.value.id),
        company_companies: Number(companyId),
        product_sku_product_skus: params.skuId,
        quantity: params.quantity || 1,
        selected: true,
      },
    },
  });

  return result?.insert_carts_one;
}

/**
 * 更新购物车商品数量
 */
export async function updateCartQuantity(cartId: number, quantity: number) {
  if (quantity <= 0) {
    throw new Error('数量必须大于0');
  }

  const mutation = `
    mutation UpdateCartQuantity($cartId: bigint!, $quantity: bigint!) {
      update_carts_by_pk(
        pk_columns: { id: $cartId }
        _set: { quantity: $quantity }
      ) {
        id
        quantity
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: {
      cartId,
      quantity,
    },
  });

  return result?.update_carts_by_pk;
}

/**
 * 切换购物车商品选中状态
 */
export async function toggleCartSelected(cartId: number, selected: boolean) {
  const mutation = `
    mutation ToggleCartSelected($cartId: bigint!, $selected: Boolean!) {
      update_carts_by_pk(
        pk_columns: { id: $cartId }
        _set: { selected: $selected }
      ) {
        id
        selected
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: {
      cartId,
      selected,
    },
  });

  return result?.update_carts_by_pk;
}

/**
 * 删除购物车商品
 */
export async function deleteCartItem(cartId: number) {
  const mutation = `
    mutation DeleteCartItem($cartId: bigint!) {
      delete_carts_by_pk(id: $cartId) {
        id
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { cartId },
  });

  return result?.delete_carts_by_pk;
}

/**
 * 批量删除购物车商品
 */
export async function deleteCartItems(cartIds: number[]) {
  const mutation = `
    mutation DeleteCartItems($cartIds: [bigint!]!) {
      delete_carts(where: { id: { _in: $cartIds } }) {
        affected_rows
      }
    }
  `;

  const result = await client.execute({
    query: mutation,
    variables: { cartIds },
  });

  return result?.delete_carts;
}
