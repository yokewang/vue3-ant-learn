<script setup>
import { ref, nextTick } from 'vue'
import { useAnalysisSampleStore } from '@/stores/analysis-sample'
import { message } from 'ant-design-vue'

const store = useAnalysisSampleStore()

// Local form state (separate from store; only Save writes to store)
const summary = ref(store.summary)
const solution = ref(store.solution)
const alertText = ref(store.alert)
const causeSummary = ref(store.causeSummary)
const causeDetail = ref(store.causeDetail)

let nextTopoKey = 1
const topoItems = ref([])
const activeTopoKey = ref('')

function syncFromStore() {
  summary.value = store.summary
  solution.value = store.solution
  alertText.value = store.alert
  causeSummary.value = store.causeSummary
  causeDetail.value = store.causeDetail
  topoItems.value = (store.topos || []).map((s, idx) => ({
    key: String(idx + 1),
    label: `Topo ${idx + 1}`,
    content: s,
  }))
  nextTopoKey = topoItems.value.length + 1
  activeTopoKey.value = topoItems.value[0]?.key || ''
}

syncFromStore()

async function addTopoTab() {
  const key = String(nextTopoKey++)
  topoItems.value.push({ key, label: `Topo ${key}`, content: 'graph TD\n  Start --> End' })
  await nextTick()
  activeTopoKey.value = key
}

function onTopoEdit(targetKey, action) {
  if (action === 'remove') {
    removeTopoTab(targetKey)
  }
}

function removeTopoTab(targetKey) {
  const idx = topoItems.value.findIndex((t) => t.key === targetKey)
  if (idx !== -1) {
    topoItems.value.splice(idx, 1)
    if (activeTopoKey.value === targetKey) {
      const next = topoItems.value[idx] || topoItems.value[idx - 1]
      activeTopoKey.value = next ? next.key : ''
    }
  }
}

function save() {
  store.summary = summary.value
  store.solution = solution.value
  store.alert = alertText.value
  store.topos = topoItems.value.map((t) => t.content)
  store.causeSummary = causeSummary.value
  store.causeDetail = causeDetail.value
  message.success('保存成功')
}

function reset() {
  store.reset()
  syncFromStore()
  message.success('已恢复默认值')
}

function download() {
  const payload = {
    summary: store.summary,
    solution: store.solution,
    alert: store.alert,
    topos: store.topos,
    causeSummary: store.causeSummary,
    causeDetail: store.causeDetail,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'store.json'
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 0)
  message.success('已开始下载 store.json')
}
</script>

<template>
  <div style="padding: 24px">
    <a-row :gutter="16">
      <a-col :span="12">
        <a-typography-title :level="4">summary</a-typography-title>
        <a-textarea v-model:value="summary" :autoSize="{ minRows: 12 }" />
      </a-col>
      <a-col :span="12">
        <a-typography-title :level="4">solution</a-typography-title>
        <a-textarea v-model:value="solution" :autoSize="{ minRows: 12 }" />
      </a-col>
    </a-row>

    <a-row :gutter="16" style="margin-top: 16px">
      <a-col :span="12">
        <a-typography-title :level="4">alert</a-typography-title>
        <a-textarea v-model:value="alertText" :autoSize="{ minRows: 12 }" />
      </a-col>
      <a-col :span="12">
        <a-typography-title :level="4">topos (mermaid)</a-typography-title>
        <div style="margin-bottom: 8px">
          <a-button size="small" @click="addTopoTab">Add Topo</a-button>
        </div>
        <a-tabs v-model:activeKey="activeTopoKey" type="editable-card" hide-add @edit="onTopoEdit">
          <a-tab-pane v-for="pane in topoItems" :key="pane.key" :tab="pane.label" closable>
            <a-textarea v-model:value="pane.content" :autoSize="{ minRows: 8 }" />
          </a-tab-pane>
        </a-tabs>
      </a-col>
    </a-row>

    <a-row :gutter="16" style="margin-top: 16px">
      <a-col :span="12">
        <a-typography-title :level="4">causeSummary</a-typography-title>
        <a-textarea v-model:value="causeSummary" :autoSize="{ minRows: 12 }" />
      </a-col>
      <a-col :span="12">
        <a-typography-title :level="4">causeDetail</a-typography-title>
        <a-textarea v-model:value="causeDetail" :autoSize="{ minRows: 14 }" />
      </a-col>
    </a-row>
  </div>

  <div style="padding: 0 24px 24px; display: flex; justify-content: center">
    <a-space>
      <a-button type="primary" @click="save">save</a-button>
      <a-button @click="reset">reset</a-button>
      <a-button @click="download">download</a-button>
    </a-space>
  </div>
</template>

<style scoped></style>
