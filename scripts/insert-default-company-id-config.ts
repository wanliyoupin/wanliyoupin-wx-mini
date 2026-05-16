/**
 * 插入默认公司ID配置到 configs 表
 * 
 * 使用方法：
 * 1. 在 GraphQL Playground 中执行以下 mutation
 * 2. 或者在后端测试页面中执行
 * 
 * 配置说明：
 * - name: "default_company_id" (配置名称)
 * - value: 可以是数字直接值，或者 JSON 对象
 * - description: 配置描述
 */

export const insertDefaultCompanyIdConfig = `
  mutation InsertDefaultCompanyIdConfig($companyId: bigint!) {
    insert_configs_one(
      object: {
        name: "default_company_id"
        value: $companyId
        description: "小程序默认公司ID"
        is_deletable: false
      }
      on_conflict: {
        constraint: configs_name_key
        update_columns: [value, description, updated_at]
      }
    ) {
      id
      name
      value
      description
    }
  }
`;

/**
 * 示例：插入默认公司ID为 545
 * 
 * Variables:
 * {
 *   "companyId": 545
 * }
 */

/**
 * 或者使用 JSON 对象格式的 value：
 */
export const insertDefaultCompanyIdConfigWithJson = `
  mutation InsertDefaultCompanyIdConfig($companyId: bigint!) {
    insert_configs_one(
      object: {
        name: "default_company_id"
        value: { "type": "number", "content": $companyId }
        description: "小程序默认公司ID"
        is_deletable: false
      }
      on_conflict: {
        constraint: configs_name_key
        update_columns: [value, description, updated_at]
      }
    ) {
      id
      name
      value
      description
    }
  }
`;

/**
 * 查询默认公司ID配置
 */
export const getDefaultCompanyIdConfig = `
  query GetDefaultCompanyIdConfig {
    configs(where: { name: { _eq: "default_company_id" } }, limit: 1) {
      id
      name
      value
      description
      created_at
      updated_at
    }
  }
`;

/**
 * 更新默认公司ID配置
 */
export const updateDefaultCompanyIdConfig = `
  mutation UpdateDefaultCompanyIdConfig($companyId: bigint!) {
    update_configs(
      where: { name: { _eq: "default_company_id" } }
      _set: {
        value: $companyId
        updated_at: "now()"
      }
    ) {
      returning {
        id
        name
        value
        description
      }
    }
  }
`;
