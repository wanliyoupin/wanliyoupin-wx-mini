/**
 * Companies 表 JSON 字段类型定义
 * 
 * 业务逻辑说明：
 * 1. banner_top 和 banner_bottom 是存储在 companies 表中的 JSON 数组字段
 * 2. 每个轮播图项包含：文件类型、文件URL、跳转链接、排序、标题
 */

/**
 * 轮播图项 - 标准格式
 */
export interface BannerItem {
  /** 文件类型（如：image、video） */
  file_type?: string;
  /** 文件 URL */
  file_url: string;
  /** 跳转链接（小程序路径或外部链接） */
  link?: string;
  /** 排序索引 */
  sort?: number;
  /** 标题 */
  title?: string;
}

/**
 * 轮播图数据类型
 * 可以是：
 * 1. 简单的 URL 字符串（兼容旧数据）
 * 2. 完整的 BannerItem 对象
 */
export type BannerData = string | BannerItem;

/**
 * 轮播图数组类型
 * banner_top 和 banner_bottom 都是此类型
 */
export type BannerArray = BannerData[];

/**
 * Companies 表的 JSON 字段类型
 */
export interface CompaniesJsonFields {
  /** 顶部轮播图（json数组） */
  banner_top?: BannerArray | null;
  /** 底部轮播图（json数组） */
  banner_bottom?: BannerArray | null;
}

/**
 * 从轮播图数据中提取图片 URL 的工具函数类型
 */
export type GetBannerImageUrl = (banner: BannerData) => string;

/**
 * 轮播图数据验证和转换工具
 */
export class BannerDataHelper {
  /**
   * 从轮播图数据中提取图片 URL
   * 支持字符串格式（兼容旧数据）和 BannerItem 对象格式
   */
  static getImageUrl(banner: BannerData | null | undefined): string {
    if (!banner) {
      return "/static/default-banner.png";
    }

    // 如果是字符串，直接返回（兼容旧数据格式）
    if (typeof banner === "string") {
      return banner;
    }

    // 如果是对象，使用 file_url 字段
    if (typeof banner === "object" && banner.file_url) {
      return banner.file_url;
    }

    // 默认返回占位图
    return "/static/default-banner.png";
  }

  /**
   * 验证轮播图数据格式
   */
  static isValidBanner(banner: BannerData | null | undefined): boolean {
    if (!banner) {
      return false;
    }

    if (typeof banner === "string") {
      return banner.trim().length > 0;
    }

    if (typeof banner === "object") {
      // 必须有 file_url 字段
      return !!(banner.file_url && banner.file_url.trim().length > 0);
    }

    return false;
  }

  /**
   * 标准化轮播图数据为 BannerItem 格式
   */
  static normalizeBanner(banner: BannerData): BannerItem {
    if (typeof banner === "string") {
      // 字符串格式转换为对象格式
      return {
        file_url: banner,
      };
    }

    if (typeof banner === "object") {
      // 已经是 BannerItem 格式，直接返回
      return banner;
    }

    return {
      file_url: "",
    };
  }

  /**
   * 过滤有效的轮播图并按 sort 排序
   */
  static filterValidBanners(banners: BannerArray | null | undefined): BannerItem[] {
    if (!Array.isArray(banners)) {
      return [];
    }

    return banners
      .filter((banner) => this.isValidBanner(banner))
      .map((banner) => this.normalizeBanner(banner))
      .sort((a, b) => {
        // 按 sort 字段排序，sort 越小越靠前
        const sortA = a.sort ?? 999;
        const sortB = b.sort ?? 999;
        return sortA - sortB;
      });
  }
}
