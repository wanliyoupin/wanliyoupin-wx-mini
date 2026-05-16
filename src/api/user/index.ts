import client from "@/config-lib/hasura-graphql-client/hasura-graphql-client";
import type { Users } from "@/types/graphql";
import { projectConfig } from "@/project-config";

/**
 * 密码登录
 * @param params 登录参数
 * @param params.mobile 手机号
 * @param params.password 密码
 * @returns 用户信息和token
 */
export const passwordLogin = async (params: {
  mobile: string;
  password: string;
}): Promise<{ userId: number; token: string; user: any }> => {
  const response = await uni.request({
    url: `${projectConfig.apiBaseUrl}/api/auth/password-login`,
    method: 'POST',
    data: {
      mobile: params.mobile,
      password: params.password,
    },
    header: {
      'Content-Type': 'application/json',
    },
  });

  const data = response.data as Record<string, unknown> | null | undefined;
  if (response.statusCode !== 200 || !data) {
    throw new Error((data && typeof data.error === 'string' ? data.error : null) || '登录失败');
  }

  if (data.error) {
    throw new Error(String(data.error));
  }

  return data as { userId: number; token: string; user: any };
};

/**
 * 小程序静默登录（wx.login code → openid → wx_guest_user）
 */
export const wxSilentLogin = async (
  code: string
): Promise<{ userId: number; token: string; user: any }> => {
  const response = await uni.request({
    url: `${projectConfig.apiBaseUrl}/api/auth/wx-silent-login`,
    method: 'POST',
    data: { code },
    header: {
      'Content-Type': 'application/json',
    },
  });

  const data = response.data as Record<string, unknown> | null | undefined;
  if (response.statusCode !== 200 || !data) {
    throw new Error((data && typeof data.error === 'string' ? data.error : null) || '静默登录失败');
  }

  if (data.error) {
    throw new Error(String(data.error));
  }

  return data as { userId: number; token: string; user: any };
};

/**
 * 微信授权登录（手机号授权）
 * 后端不合并访客数据、不向正式用户写入 wx_mini_openid；openid 仅保留在访客行。
 */
export const wechatLogin = async (params: {
  code: string;
  codeSource: string;
}): Promise<{ userId: number; token: string; user: any }> => {
  const response = await uni.request({
    url: `${projectConfig.apiBaseUrl}/api/auth/phone-login`,
    method: 'POST',
    data: {
      code: params.code,
      codeSource: params.codeSource,
    },
    header: {
      'Content-Type': 'application/json',
    },
  });

  const data = response.data as Record<string, unknown> | null | undefined;
  if (response.statusCode !== 200 || !data) {
    throw new Error((data && typeof data.error === 'string' ? data.error : null) || '登录失败');
  }

  if (data.error) {
    throw new Error(String(data.error));
  }

  return data as { userId: number; token: string; user: any };
};

/**
 * 获取用户
 * 优先使用 execute 方法执行 GraphQL 查询
 * @param params 获取用户参数
 * @param params.userId 用户ID
 * @returns 用户
 */
export const getUser = async ({
  userId = 3,
}: {
  userId?: number;
}): Promise<Users> => {
  const query = `
    query GetUser($userId: bigint!) {
      users_by_pk(id: $userId) {
        id
        nickname
        bio
        mobile
        avatar_url
        role
      }
    }
  `;

  const result = await client.execute<{ users_by_pk: Users | null }>({
    query,
    variables: { userId },
  });

  if (!result.users_by_pk) {
    throw new Error("User not found");
  }

  return result.users_by_pk;
};

/** 更新个人资料可写字段 */
export type UpdateProfileInput = {
  nickname?: string;
  avatar_url?: string;
  bio?: string;
};

/**
 * 更新当前用户资料（昵称、头像、简介）
 * @param userId 当前用户 ID
 * @param data 要更新的字段
 * @returns 更新后的用户
 */
export const updateUserProfile = async (
  userId: number,
  data: UpdateProfileInput
): Promise<Users> => {
  const mutation = `
    mutation UpdateUserProfile($userId: bigint!, $set: users_set_input!) {
      update_users_by_pk(pk_columns: { id: $userId }, _set: $set) {
        id
        nickname
        bio
        mobile
        avatar_url
      }
    }
  `;
  const result = await client.execute<{ update_users_by_pk: Users | null }>({
    query: mutation,
    variables: {
      userId,
      set: data,
    },
  });
  if (!result.update_users_by_pk) {
    throw new Error("更新失败");
  }
  return result.update_users_by_pk;
};

/**
 * 获取用户列表
 * 优先使用 execute 方法执行 GraphQL 查询
 * @param args 查询参数
 * @param args.limit 限制数量
 * @param args.offset 偏移量
 * @returns 用户列表
 */
export const getUserList = async (args: {
  limit?: number;
  offset?: number;
} = {}): Promise<Users[]> => {
  const query = `
    query GetUserList($limit: Int, $offset: Int) {
      users(limit: $limit, offset: $offset, order_by: { created_at: desc }) {
        id
        nickname
        bio
        mobile
        created_at
      }
    }
  `;

  const result = await client.execute<{ users: Users[] }>({
    query,
    variables: {
      limit: args.limit || 10,
      offset: args.offset || 0,
    },
  });

  return result.users;
};

/**
 * 设置/修改密码
 * @param params 参数
 * @param params.oldPassword 原密码（若已设置过密码则必填）
 * @param params.newPassword 新密码（至少 6 位）
 */
export const setPassword = async (params: {
  oldPassword?: string;
  newPassword: string;
}): Promise<void> => {
  const token = uni.getStorageSync("token");
  if (!token) {
    throw new Error("请先登录");
  }
  const response = await uni.request({
    url: `${projectConfig.apiBaseUrl}/api/auth/set-password`,
    method: "POST",
    data: {
      oldPassword: params.oldPassword?.trim() || undefined,
      newPassword: params.newPassword.trim(),
    },
    header: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = response.data as Record<string, unknown> | null | undefined;
  if (response.statusCode !== 200 || !data) {
    throw new Error(
      (data && typeof data.error === "string" ? data.error : null) || "设置失败"
    );
  }
  if (data.error) {
    throw new Error(String(data.error));
  }
};
