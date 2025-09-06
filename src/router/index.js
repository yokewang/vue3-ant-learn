import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AntdView from '../views/AntdView.vue'
import PiniaCounterView from '../views/PiniaCounterView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/ant-design-vue',
      name: 'ant-design-vue',
      component: AntdView,
    },
    {
      path: '/pinia-counter',
      name: 'pinia-counter',
      component: PiniaCounterView,
    },
  ],
})

export default router
