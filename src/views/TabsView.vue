<script setup>
import { ref } from 'vue'

let nextKey = 1
const activeKey = ref(undefined)
const items = ref([])

const addTextTab = () => {
  const key = `${nextKey++}`
  items.value.push({
    key,
    label: `Tab ${key}`,
    type: 'text',
    content: `This is Tab ${key} content.`,
  })
  activeKey.value = key
}

const addInputTab = () => {
  const key = `${nextKey++}`
  items.value.push({ key, label: `Input ${key}`, type: 'input', content: '' })
  activeKey.value = key
}

const onEdit = (targetKey, action) => {
  if (action === 'remove') {
    const idx = items.value.findIndex((t) => t.key === targetKey)
    if (idx !== -1) {
      items.value.splice(idx, 1)
      if (activeKey.value === targetKey) {
        const next = items.value[idx] || items.value[idx - 1]
        activeKey.value = next ? next.key : undefined
      }
    }
  }
}
</script>

<template>
  <div style="padding: 24px">
    <a-space style="margin-bottom: 12px">
      <a-button type="primary" @click="addTextTab">addTextTab</a-button>
      <a-button @click="addInputTab">addInputTab</a-button>
    </a-space>

    <a-tabs v-model:activeKey="activeKey" type="editable-card" hide-add @edit="onEdit">
      <a-tab-pane v-for="pane in items" :key="pane.key" :tab="pane.label" closable>
        <div v-if="pane.type === 'text'">{{ pane.content }}</div>
        <div v-else>
          <a-input v-model:value="pane.content" placeholder="Type something..." />
          <div style="margin-top: 8px; color: rgba(0, 0, 0, 0.45)">Value: {{ pane.content }}</div>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped></style>
