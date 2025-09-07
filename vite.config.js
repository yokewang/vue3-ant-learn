import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { viteMockServe } from 'vite-plugin-mock'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    viteMockServe({
      mockPath: './mock', // 指定 mock 数据文件存放的目录，默认就是 './mock'
      localEnabled: true, // 开发环境启用 mock
      prodEnabled: false, // 生产环境禁用 mock（除非你有特殊需求）
      logger: true, // 在控制台输出请求日志，方便调试
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
