/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 开发时覆盖 API 根地址，例如真机调试：http://192.168.1.5:3000 */
  readonly VITE_API_BASE_URL?: string;
}

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}
