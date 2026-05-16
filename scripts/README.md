# 测试数据插入脚本

这个目录包含用于插入测试数据的 GraphQL mutations。

## 使用方法

### 方法1：在 GraphQL Playground 中执行

1. 打开后端项目的 GraphQL Playground（通常是 `http://localhost:3000/api/graphql` 或类似地址）
2. 复制对应的 mutation 代码
3. 修改必要的参数（如 companyId）
4. 执行 mutation

### 方法2：在后端 API 测试页面执行

1. 打开 `http://localhost:3000/api-test/graphql`（或对应的测试页面）
2. 粘贴 mutation 代码并执行

### 方法3：使用 curl 命令

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { ... }"
  }'
```

## 插入顺序

1. **插入或更新公司数据**（包含轮播图）
   - 如果公司ID=545已存在，使用 `updateCompanyBanners` 更新轮播图
   - 如果不存在，使用 `insertTestCompany` 创建新公司

2. **插入主分类**
   - 执行 `insertTestCategories(545)` 获取主分类ID

3. **插入子分类**
   - 使用主分类ID执行 `insertTestSubCategories(parentCategoryId, 545)`

## 示例数据说明

### 公司数据
- 公司名称：测试公司
- 轮播图：包含顶部和底部轮播图，使用占位图URL

### 分类数据
- 主分类：家居用品、食品饮料、电子产品
- 子分类：每个主分类下5个子分类

## 注意事项

1. 所有图片URL使用占位图服务（via.placeholder.com），实际使用时需要替换为真实图片URL
2. companyId 默认为 545，请根据实际情况修改
3. 执行前请确保数据库连接正常
4. 建议在测试环境执行，避免影响生产数据
