import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AntdView from '../views/AntdView.vue'
import PiniaCounterView from '../views/PiniaCounterView.vue'
import MarkdownItView from '../views/MarkdownItView.vue'
import MarkedView from '../views/MarkedView.vue'
import MermaidView from '../views/MermaidView.vue'
import TabsView from '../views/TabsView.vue'

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
    {
      path: '/markdown-it',
      name: 'markdown-it',
      component: MarkdownItView,
    },
    {
      path: '/marked',
      name: 'marked',
      component: MarkedView,
    },
    {
      path: '/mermaid',
      name: 'mermaid',
      component: MermaidView,
    },
    {
      path: '/tabs',
      name: 'tabs',
      component: TabsView,
    },
  ],
})

export default router
