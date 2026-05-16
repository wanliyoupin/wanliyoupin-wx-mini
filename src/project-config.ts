import graphqlOrmfyClientConfig from "../goc.config";

export const graphqlOrmifyClientConfig = {
  endpoint: graphqlOrmfyClientConfig.endpoint,
  headers: graphqlOrmfyClientConfig.headers,
};

/** 生产环境后端（`npm run build` 打包小程序时使用） */
const API_BASE_PROD = 'https://wanliyoupin-backend-1.weweknow.com';

/**
 * 开发环境默认走本机 Next 后端。
 * - 微信开发者工具模拟器访问本机：用 127.0.0.1 即可（需在工具里勾选「不校验合法域名」）。
 * - 真机预览：127.0.0.1 指向手机自身，请在本仓库根目录建 `.env.development` 写：
 *   VITE_API_BASE_URL=http://你的电脑局域网IP:3000
 */
const API_BASE_DEV =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:3000';

// Vite 在构建时替换 import.meta.env；`npm run dev` 为 development，打包为 production
export const projectConfig = {
  apiBaseUrl: API_BASE_PROD//import.meta.env.DEV ? API_BASE_DEV : API_BASE_PROD,
};