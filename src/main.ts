import { createSSRApp } from "vue";
import * as Pinia from 'pinia'
import { setPinia } from '@/store/piniaInstance'
import '@/config-lib/hasura-graphql-client/hasura-graphql-client' // 初始化全局 hasuraClient
import App from "./App.vue";

// 先创建并挂载 pinia 实例，再 createApp，避免 onLaunch 里用 store 时 getPinia() 仍为 null
const pinia = Pinia.createPinia();
setPinia(pinia);

export function createApp() {
  const app = createSSRApp(App);
  app.use(pinia);
  return {
    app,
    Pinia
  };
}
