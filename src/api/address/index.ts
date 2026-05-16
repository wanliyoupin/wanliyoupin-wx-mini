import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';

export interface AddressItem {
  id: number;
  user_users: number;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  receiver_province?: string | null;
  receiver_city?: string | null;
  receiver_district?: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AddressInput {
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  receiver_province?: string;
  receiver_city?: string;
  receiver_district?: string;
  is_default?: boolean;
}

/**
 * 获取当前用户的地址列表
 */
export async function getAddressList(userId: number): Promise<AddressItem[]> {
  const query = `
    query GetAddressList($userId: bigint!) {
      addresses(
        where: { user_users: { _eq: $userId } }
        order_by: [{ is_default: desc }, { created_at: desc }]
      ) {
        id
        user_users
        receiver_name
        receiver_phone
        receiver_address
        receiver_province
        receiver_city
        receiver_district
        is_default
        created_at
        updated_at
      }
    }
  `;
  const result = await client.execute({
    query,
    variables: { userId },
  });
  return (result?.addresses || []) as AddressItem[];
}

/**
 * 新增地址
 */
export async function createAddress(userId: number, data: AddressInput): Promise<AddressItem> {
  if (data.is_default) {
    await clearDefaultAddress(userId);
  }
  const mutation = `
    mutation CreateAddress($object: addresses_insert_input!) {
      insert_addresses_one(object: $object) {
        id
        user_users
        receiver_name
        receiver_phone
        receiver_address
        receiver_province
        receiver_city
        receiver_district
        is_default
        created_at
        updated_at
      }
    }
  `;
  const result = await client.execute({
    query: mutation,
    variables: {
      object: {
        user_users: userId,
        receiver_name: data.receiver_name,
        receiver_phone: data.receiver_phone,
        receiver_address: data.receiver_address,
        receiver_province: data.receiver_province || null,
        receiver_city: data.receiver_city || null,
        receiver_district: data.receiver_district || null,
        is_default: data.is_default ?? false,
      },
    },
  });
  return result?.insert_addresses_one as AddressItem;
}

/**
 * 更新地址
 */
export async function updateAddress(
  id: number,
  userId: number,
  data: Partial<AddressInput>
): Promise<AddressItem> {
  if (data.is_default) {
    await clearDefaultAddress(userId);
  }
  const mutation = `
    mutation UpdateAddress($id: bigint!, $set: addresses_set_input!) {
      update_addresses_by_pk(pk_columns: { id: $id }, _set: $set) {
        id
        user_users
        receiver_name
        receiver_phone
        receiver_address
        receiver_province
        receiver_city
        receiver_district
        is_default
        created_at
        updated_at
      }
    }
  `;
  const set: Record<string, unknown> = {};
  if (data.receiver_name !== undefined) set.receiver_name = data.receiver_name;
  if (data.receiver_phone !== undefined) set.receiver_phone = data.receiver_phone;
  if (data.receiver_address !== undefined) set.receiver_address = data.receiver_address;
  if (data.receiver_province !== undefined) set.receiver_province = data.receiver_province;
  if (data.receiver_city !== undefined) set.receiver_city = data.receiver_city;
  if (data.receiver_district !== undefined) set.receiver_district = data.receiver_district;
  if (data.is_default !== undefined) set.is_default = data.is_default;
  const result = await client.execute({
    query: mutation,
    variables: { id, set },
  });
  return result?.update_addresses_by_pk as AddressItem;
}

/**
 * 删除地址
 */
export async function deleteAddress(id: number): Promise<boolean> {
  const mutation = `
    mutation DeleteAddress($id: bigint!) {
      delete_addresses_by_pk(id: $id) {
        id
      }
    }
  `;
  await client.execute({
    query: mutation,
    variables: { id },
  });
  return true;
}

/**
 * 设为默认地址（先清除其他默认再设置）
 */
export async function setDefaultAddress(id: number, userId: number): Promise<AddressItem> {
  await clearDefaultAddress(userId);
  return updateAddress(id, userId, { is_default: true });
}

async function clearDefaultAddress(userId: number): Promise<void> {
  const mutation = `
    mutation ClearDefaultAddress($userId: bigint!) {
      update_addresses(
        where: { user_users: { _eq: $userId }, is_default: { _eq: true } }
        _set: { is_default: false }
      ) {
        affected_rows
      }
    }
  `;
  await client.execute({
    query: mutation,
    variables: { userId },
  });
}
