<script setup>
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import { computed } from 'vue'

const router = useRouter()
const route = useRoute()

const links = computed(() =>
  router
    .getRoutes()
    .filter((r) => r.path && !r.path.includes(':'))
    .map((r) => ({ path: r.path, label: r.name || r.path })),
)
</script>

<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider :width="180" theme="dark">
      <nav class="sider-links">
        <RouterLink
          v-for="r in links"
          :key="r.path"
          :to="r.path"
          :class="{ active: route.path === r.path }"
        >
          {{ r.label }}
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
  padding: 12px 8px;
  gap: 8px;
}

.sider-links a {
  color: rgba(255, 255, 255, 0.95);
  text-decoration: none;
  display: block;
  padding: 6px 8px;
  border-radius: 6px;
}

.sider-links a.router-link-exact-active {
  background: rgba(255, 255, 255, 0.18);
}

.sider-links a.active {
  background: rgba(255, 255, 255, 0.18);
}

.content {
  margin: 0;
  padding: 0;
  min-height: 100vh;
}
</style>
