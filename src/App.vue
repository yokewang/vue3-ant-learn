<script setup>
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import { computed, ref } from 'vue'

const router = useRouter()
const route = useRoute()

const links = computed(() =>
  router
    .getRoutes()
    .filter((r) => r.path && !r.path.includes(':'))
    .map((r) => ({ path: r.path, label: r.name || r.path })),
)

const collapsed = ref(false)
</script>

<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" collapsible :width="200" theme="dark">
      <div class="logo">
        <span v-if="!collapsed">Hello Vue3</span>
        <span v-else>V3</span>
      </div>
      <nav class="sider-links">
        <RouterLink
          v-for="r in links"
          :key="r.path"
          :to="r.path"
          :class="{ active: route.path === r.path, 'collapsed-link': collapsed }"
        >
          <span v-if="!collapsed">{{ r.label }}</span>
          <span v-else>{{ r.label.charAt(0).toUpperCase() }}</span>
        </RouterLink>
      </nav>
    </a-layout-sider>
    <a-layout>
      <a-layout-content class="content">
        <RouterView />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style scoped>
.sider-links {
  display: flex;
  flex-direction: column;
  padding: 6px 8px;
  gap: 2px;
}

.sider-links a {
  color: rgba(255, 255, 255, 0.95);
  text-decoration: none;
  display: block;
  padding: 3px 8px;
  border-radius: 6px;
}

.sider-links a.router-link-exact-active {
  background: rgba(255, 255, 255, 0.18);
}

.sider-links a.active {
  background: rgba(255, 255, 255, 0.18);
}

.collapsed-link {
  text-align: center;
  padding: 3px 0 !important;
}

.logo {
  height: 32px;
  margin: 16px;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: bold;
  font-size: 16px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
}

.content {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  overflow-y: auto;
}
</style>
