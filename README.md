# uniapp-ts-template

本项目为 uni-app + GraphQL 跨端开发模板，支持主包/分包结构，内置类型安全的 API 设计，适合团队协作开发。

---

## 快速启动项目

1. **克隆项目**
   ```bash
   git clone <your-repo-url>
   cd uniapp-ts-template
   ```
2. **安装依赖**
   ```bash
   npm install
   ```
3. **配置 GraphQL 端点**
   - 修改 `goc.config.ts`，填写你的 GraphQL 服务地址和 header。
4. **拉取 schema 并生成类型**
   ```bash
   npm run download:schema
   ```
5. **配置微信小程序（如需要）**
   - 如果运行到微信小程序，需要在 `src/manifest.json` 中配置 `mp-weixin.appid`
   - 打开 `src/manifest.json`，找到 `mp-weixin` 配置项，填写你的微信小程序 AppID
   - 如果没有 AppID，可以暂时留空，但某些功能可能会报错（不影响基本功能）
6. **运行开发环境**
   - 微信小程序：
     ```bash
     npm run dev:mp-weixin
     ```
   - H5：
     ```bash
     npm run dev:h5
     ```
6. **（可选）类型检查**
   ```bash
   npm run type-check
   ```

---

## 目录结构规范

```
uniapp-ts-template/
  src/
    api/                # 通用 API，主包/全局可用，按模块分目录
      user/
        index.ts        # 用户相关通用 API
      upload/
        index.ts        # 文件上传相关 API
    config-lib/         # 配置与工具库
      hasura-graphql-client/
        hasura-graphql-client.ts # GraphQL 客户端实例
        config.ts
      ...               # 其他配置/工具模块
    pages/              # 主包页面（如 tabbar 页面），每个页面一个子目录
      index/
        index.vue       # 首页页面
      upload/
        index.vue       # 文件上传示例页面
      home/
        ...
    subPackages/        # 分包页面及其专属 API
      admin/
        api/            # 管理端分包专属 API（如 user.ts）
        company-list/
        ...
      company/
        api/            # 公司端分包专属 API（category、product、package、company-user）
        product-list/
        ...
    static/             # 静态资源（如图片、icon 等）
      logo.png
    types/              # 全局类型定义
      graphql.ts        # GraphQL 自动生成类型
      # 建议可细分 tables/ 目录，按表拆分业务类型
    utils/              # （已废弃/仅保留极少量工具，主力已迁移到 config-lib/）
    project-config.ts   # 项目配置（如 endpoint、header，建议仅工具脚本用）
    pages.json          # uni-app 路由与页面配置
    manifest.json       # uni-app 项目配置
    uni.scss            # 全局样式
    main.ts             # 入口文件
    App.vue             # 根组件
  graphql/
    schema.graphql      # GraphQL schema 文件（自动生成）
    codegen.ts          # graphql-codegen 配置
  goc.config.ts         # GraphQL 客户端配置
  package.json
  README.md
  tsconfig.json
  vite.config.ts
  ...
```

### 目录/文件职责说明

| 目录/文件 | 说明 |
|-----------|------|
| src/api/  | 通用 API，主包/全局可用，按模块分子目录，index.ts 为模块主入口 |
| src/config-lib/ | 配置与工具库，GraphQL 客户端等 |
| src/pages/ | 主包页面，每个页面一个子目录，页面文件为 index.vue |
| src/subPackages/ | 分包页面，每个分包一个子目录，页面和专属 API 文件同级 |
| src/types/ | 全局类型定义，graphql.ts 为自动生成类型，建议 tables/ 拆分业务类型 |
| src/utils/ | （业务相关的工具库）|
| src/static/ | 静态资源，如图片、icon 等 |
| src/project-config.ts | 项目配置（如 endpoint、header，建议仅工具脚本用） |
| graphql/schema.graphql | GraphQL schema 文件，自动生成 |
| graphql/codegen.ts | graphql-codegen 配置文件 |
| goc.config.ts | GraphQL 客户端配置（endpoint、header） |
| package.json | 项目依赖与脚本配置 |
| README.md | 项目说明文档 |
| tsconfig.json | TypeScript 配置 |
| vite.config.ts | Vite 构建配置 |

---

## 目录与命名风格规范

- **页面目录与页面文件**：
  - 统一使用英文小写+中划线（-），如 `user-center/`、`order-list/`、`index.vue`。
  - 页面文件建议为 `index.vue`，页面目录名即为页面名。
- **API 相关文件**：
  - 统一使用英文小写+下划线（_），如 `api.ts`、`user_api.ts`。
  - api 目录下每个模块一个子目录，模块主入口为 `index.ts`。
  - 分包 API 文件建议为 `api.ts`，与页面同级。
- **工具库文件**：
  - 统一使用英文小写+中划线（-），如 `hasura-graphql-client.ts`。
  - 现已全部集中在 `config-lib/` 目录下。
- **类型定义文件**：
  - 统一使用英文小写+中划线或下划线，自动生成类型为 `graphql.ts`，业务类型建议细分到 `tables/` 子目录。
- **静态资源**：
  - 文件名用英文小写+中划线（-），如 `logo.png`。

#### 命名规范小结

| 类型         | 命名风格           | 示例                      |
|--------------|--------------------|---------------------------|
| 页面目录     | 小写+中划线        | user-center/              |
| 页面文件     | 小写+中划线        | index.vue                 |
| API 文件     | 小写+下划线        | api.ts, user_api.ts       |
| 工具库文件   | 小写+中划线        | hasura-graphql-client.ts  |
| 类型定义文件 | 小写+中划线/下划线 | graphql.ts, tables/user.ts|
| 静态资源     | 小写+中划线        | logo.png                  |

---

## 推荐开发流程

1. 新建页面或分包时，严格按目录规范新建目录和文件。
2. 新增 API 时，主包 API 放 api/下对应模块，分包 API 放分包目录下，命名用下划线。
3. 新增类型时，优先基于自动生成的 graphql.ts，业务类型建议细分 tables/。
4. 工具函数统一放 utils/，命名用中划线。
5. 静态资源统一放 static/，命名用中划线。
6. 每次后端 schema 变更后，务必 `npm run download:schema` 同步类型。

---

## 典型用例

### 1. API 文件用法

**优先使用 `execute` 方法**，这是 graphql-ormify-client 推荐的方式，提供最大的灵活性：

```ts
// src/api/user/index.ts
import client from '@/config-lib/hasura-graphql-client/hasura-graphql-client';
import type { Users } from '@/types/graphql';

/**
 * 获取用户列表
 * 优先使用 execute 方法执行 GraphQL 查询
 */
export const get_user_list = async (args: {
  limit?: number;
  offset?: number;
} = {}): Promise<Users[]> => {
  const query = `
    query GetUserList($limit: Int, $offset: Int) {
      users(limit: $limit, offset: $offset, order_by: { created_at: desc }) {
        id
        name
        email
        avatar_url
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
 * 通过 ID 获取用户详情
 */
export const get_user_by_id = async (id: string): Promise<Users | null> => {
  const query = `
    query GetUserById($id: uuid!) {
      users_by_pk(id: $id) {
        id
        name
        email
        avatar_url
        created_at
      }
    }
  `;
  
  const result = await client.execute<{ users_by_pk: Users | null }>({
    query,
    variables: { id },
  });
  
  return result.users_by_pk;
};
```

### 2. 类型定义用法

```ts
// src/types/tables/user.ts
import type { Users, Users_Bool_Exp } from '../graphql';

export type User = Users;
export type UserWhere = Users_Bool_Exp;
export type UserField = keyof Users;
export type UserFields = UserField[];
```

### 3. 页面用法

```vue
<script lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { get_user_list } from '@/api/user';
import type { User } from '@/types/tables/user';

export default {
  setup() {
    const users = ref<User[]>([]);
    const loading = ref(false);
    
    onLoad(async () => {
      loading.value = true;
      try {
        users.value = await get_user_list({ limit: 20 });
      } catch (error) {
        console.error('获取用户列表失败:', error);
      } finally {
        loading.value = false;
      }
    });
    
    return { users, loading };
  },
};
</script>

<template>
  <view class="container">
    <view v-if="loading">加载中...</view>
    <view v-else>
      <view v-for="user in users" :key="user.id" class="user-item">
        <text>{{ user.name }}</text>
      </view>
    </view>
  </view>
</template>
```

### 4. 文件上传用法（带进度条）

```ts
// src/api/upload/index.ts
import { get_upload_token, upload_to_qiniu } from '@/api/upload';

// 上传文件
const handleUpload = async () => {
  try {
    // 1. 获取上传凭证
    const tokenData = await get_upload_token('image.jpg', 'uploads/');
    
    // 2. 上传文件到七牛云（带进度回调）
    const result = await upload_to_qiniu(
      filePath,
      tokenData.token,
      tokenData.key,
      tokenData.uploadUrl,
      (progress) => {
        console.log('上传进度:', progress + '%');
      }
    );
    
    console.log('上传成功:', result);
  } catch (error) {
    console.error('上传失败:', error);
  }
};
```

完整的上传示例请参考 `src/pages/upload/index.vue`，包含：
- 文件选择
- 上传进度显示
- 错误处理
- 上传结果展示

---

## 常用脚本

- 拉取 schema 并生成类型：
  ```bash
  npm run download:schema
  ```
- 运行到微信小程序：
  ```bash
  npm run dev:mp-weixin
  ```
- 运行到 H5：
  ```bash
  npm run dev:h5
  ```
- 类型检查：
  ```bash
  npm run type-check
  ```

---

## 开发建议

- API、类型、工具、页面结构建议严格按本规范组织，便于团队协作和维护。
- 业务类型建议基于自动生成的 GraphQL 类型二次封装，字段名类型用 `keyof` 自动推导。
- **GraphQL 请求优先使用 `execute` 方法**，提供最大的灵活性和类型安全。
- GraphQL 客户端统一使用 config-lib/ 目录下的工具。
- 每次后端 schema 变更后，务必同步类型。

---

## 常见目录/文件 FAQ

- **api/ 下可以有多级目录吗？** 可以，建议每个业务模块一个子目录，主入口为 index.ts。
- **types/ 下如何拆分业务类型？** 建议 tables/ 下每个表一个 ts 文件，便于维护和自动补全。
- **分包页面可以有多个页面和 API 吗？** 可以，分包目录下可有多个页面和多个 API 文件。
- **静态资源如何组织？** 建议按业务或类型分子目录，如 images/、icons/。
- **工具库可以有多文件吗？** 可以，按功能拆分多个 ts 文件，命名用中划线。
- **config-lib/ 和 utils/ 有什么区别？** config-lib/ 是当前主力的配置与工具库目录，utils/ 封装轻量化的业务使用工具。
- **为什么优先使用 `execute` 方法？** `execute` 方法提供最大的灵活性，可以直接执行完整的 GraphQL 查询字符串，支持所有 GraphQL 特性，同时保持类型安全。只有在快捷方法能满足需求时才使用快捷方法。
- **微信小程序报错 `appid missing` 怎么办？** 这是微信小程序开发工具的提示，需要在 `src/manifest.json` 中配置 `mp-weixin.appid`。如果没有真实的 AppID，可以暂时留空，不影响基本功能开发，但某些需要 AppID 的功能会报错。
- **GraphQL 类型错误 `uuid!` vs `bigint!` 怎么办？** 根据你的 GraphQL schema，如果表的 id 字段是 `bigint` 类型，查询时应该使用 `bigint!` 而不是 `uuid!`。变量类型也要对应使用 `number` 而不是 `string`。

---

如有疑问或需补充，请联系项目维护者。
# wanliyoupin-wx-mini
