/**
 * 测试数据插入脚本
 * 用于在数据库中插入测试用的假数据
 * 
 * 使用方法：
 * 1. 在 GraphQL Playground 或 API 测试页面执行这些 mutation
 * 2. 或者使用后端 API 测试页面执行
 */

// ==================== 1. 插入测试公司 ====================
export const insertTestCompany = `
  mutation InsertTestCompany {
    insert_companies_one(
      object: {
        name: "测试公司"
        logo_url: "https://via.placeholder.com/200"
        banner_top: [
          {
            file_type: "image"
            file_url: "https://via.placeholder.com/750x300?text=Banner+1"
            title: "测试轮播图1"
            sort: 1
            link: "/pages/shopping/index"
          },
          {
            file_type: "image"
            file_url: "https://via.placeholder.com/750x300?text=Banner+2"
            title: "测试轮播图2"
            sort: 2
            link: "/pages/package/index"
          }
        ]
        banner_bottom: [
          {
            file_type: "image"
            file_url: "https://via.placeholder.com/750x300?text=Bottom+Banner"
            title: "底部轮播图"
            sort: 1
          }
        ]
      }
    ) {
      id
      name
    }
  }
`;

// ==================== 2. 插入测试分类 ====================
// 注意：需要先有公司ID，假设公司ID为 545
export const insertTestCategories = (companyId: number = 545) => `
  mutation InsertTestCategories {
    # 插入主分类1：家居用品
    category1: insert_categories_one(
      object: {
        name: "家居用品"
        company_companies: ${companyId}
        level: 0
        sort_order: 1
        ui_style: "categories"
        icon_url: "https://via.placeholder.com/100?text=家居"
        is_deleted: false
      }
    ) {
      id
      name
    }
    
    # 插入主分类2：食品饮料
    category2: insert_categories_one(
      object: {
        name: "食品饮料"
        company_companies: ${companyId}
        level: 0
        sort_order: 2
        ui_style: "categories"
        icon_url: "https://via.placeholder.com/100?text=食品"
        is_deleted: false
      }
    ) {
      id
      name
    }
    
    # 插入主分类3：电子产品
    category3: insert_categories_one(
      object: {
        name: "电子产品"
        company_companies: ${companyId}
        level: 0
        sort_order: 3
        ui_style: "products"
        icon_url: "https://via.placeholder.com/100?text=电子"
        is_deleted: false
      }
    ) {
      id
      name
    }
  }
`;

// ==================== 3. 插入子分类 ====================
// 需要先获取主分类ID，假设主分类ID为 parentCategoryId
export const insertTestSubCategories = (parentCategoryId: number, companyId: number = 545) => `
  mutation InsertTestSubCategories {
    insert_categories(
      objects: [
        {
          name: "沙发"
          company_companies: ${companyId}
          parent_categories: ${parentCategoryId}
          level: 1
          sort_order: 1
          ui_style: "products"
          icon_url: "https://via.placeholder.com/100?text=沙发"
          is_deleted: false
        },
        {
          name: "床具"
          company_companies: ${companyId}
          parent_categories: ${parentCategoryId}
          level: 1
          sort_order: 2
          ui_style: "products"
          icon_url: "https://via.placeholder.com/100?text=床具"
          is_deleted: false
        },
        {
          name: "桌椅"
          company_companies: ${companyId}
          parent_categories: ${parentCategoryId}
          level: 1
          sort_order: 3
          ui_style: "products"
          icon_url: "https://via.placeholder.com/100?text=桌椅"
          is_deleted: false
        },
        {
          name: "柜子"
          company_companies: ${companyId}
          parent_categories: ${parentCategoryId}
          level: 1
          sort_order: 4
          ui_style: "products"
          icon_url: "https://via.placeholder.com/100?text=柜子"
          is_deleted: false
        },
        {
          name: "装饰"
          company_companies: ${companyId}
          parent_categories: ${parentCategoryId}
          level: 1
          sort_order: 5
          ui_style: "products"
          icon_url: "https://via.placeholder.com/100?text=装饰"
          is_deleted: false
        }
      ]
    ) {
      returning {
        id
        name
      }
    }
  }
`;

// ==================== 4. 更新公司轮播图 ====================
// 用于更新已存在公司的轮播图数据
export const updateCompanyBanners = (companyId: number = 545) => `
  mutation UpdateCompanyBanners {
    update_companies_by_pk(
      pk_columns: { id: ${companyId} }
      _set: {
        banner_top: [
          {
            file_type: "image"
            file_url: "https://via.placeholder.com/750x300?text=顶部轮播图1"
            title: "促销活动"
            sort: 1
            link: "/pages/shopping/index"
          },
          {
            file_type: "image"
            file_url: "https://via.placeholder.com/750x300?text=顶部轮播图2"
            title: "新品上市"
            sort: 2
            link: "/pages/package/index"
          },
          {
            file_type: "image"
            file_url: "https://via.placeholder.com/750x300?text=顶部轮播图3"
            title: "限时优惠"
            sort: 3
            link: "/pages/shopping/index?categoryId=1"
          }
        ]
        banner_bottom: [
          {
            file_type: "image"
            file_url: "https://via.placeholder.com/750x300?text=底部轮播图1"
            title: "品牌推荐"
            sort: 1
          },
          {
            file_type: "image"
            file_url: "https://via.placeholder.com/750x300?text=底部轮播图2"
            title: "精选好物"
            sort: 2
          }
        ]
      }
    ) {
      id
      name
      banner_top
      banner_bottom
    }
  }
`;

// ==================== 5. 完整测试数据插入流程 ====================
/**
 * 完整流程：
 * 1. 先执行 insertTestCompany 获取公司ID
 * 2. 使用公司ID执行 insertTestCategories 获取分类ID
 * 3. 使用分类ID执行 insertTestSubCategories 插入子分类
 * 4. 如果需要更新轮播图，执行 updateCompanyBanners
 */
