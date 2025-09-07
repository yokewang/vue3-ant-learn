<script setup>
import { ref, onBeforeUnmount, computed } from 'vue'
import MermaidTabs from '@/components/MermaidTabs.vue'

const initialText = `graph TD
  A[Start] --> B{Check}
  B -- Yes --> C[Do thing]
  B -- No --> D[Skip]
  C --> E[End]
  D --> E[End]
`

const text = ref(initialText)

const streaming = ref(false)
let streamTimer = null

const panelHeight = 300
const TOTAL_TABS = 3

// Stream tabs state
const streamTabs = ref([])
const currentStreamingTabIndex = ref(-1)
const activeStreamTab = ref('')

function prefixErrorToInitial() {
  text.value = `***error***\n${initialText}`
}

function resetToInitial() {
  text.value = initialText
}

function startStream() {
  if (streaming.value) return

  streaming.value = true

  // Clear tabs first
  streamTabs.value = []
  currentStreamingTabIndex.value = 0

  // Add first tab
  const firstTab = {
    key: '1',
    label: 'Tab 1',
    source: '',
  }
  streamTabs.value.push(firstTab)
  activeStreamTab.value = '1'

  streamCurrentTab()
}

function streamCurrentTab() {
  const tabIndex = currentStreamingTabIndex.value

  if (tabIndex >= TOTAL_TABS) {
    streaming.value = false
    return
  }

  const content = text.value || ''
  let charIndex = 0

  const step = () => {
    if (charIndex >= content.length) {
      clearInterval(streamTimer)
      streamTimer = null

      // Current tab content finished, prepare for next tab
      prepareNextTab()
      return
    }

    // Update current tab's source
    const currentTab = streamTabs.value[tabIndex]
    if (currentTab) {
      currentTab.source += content[charIndex]
    }
    charIndex++
  }

  streamTimer = setInterval(step, 20)
}

function prepareNextTab() {
  // Use the debounce mechanism naturally - add next tab after current one fully renders
  const debounceTime = 200 // Match viewer-debounce-ms
  const viewTime = 300 // Time for user to see the rendered result

  setTimeout(() => {
    addNextTab()
  }, debounceTime + viewTime)
}

function addNextTab() {
  currentStreamingTabIndex.value++

  if (currentStreamingTabIndex.value < TOTAL_TABS) {
    const nextTabNum = currentStreamingTabIndex.value + 1
    const nextTab = {
      key: nextTabNum.toString(),
      label: `Tab ${nextTabNum}`,
      source: '',
    }

    // This is the key - we control exactly when streamTabs gets updated
    streamTabs.value = [...streamTabs.value, nextTab]
    activeStreamTab.value = nextTabNum.toString()

    // Continue streaming
    streamCurrentTab()
  } else {
    streaming.value = false
  }
}

onBeforeUnmount(() => {
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
})

// Static tabs for preview
const staticItems = computed(() =>
  Array.from({ length: TOTAL_TABS }, (_, i) => ({
    key: (i + 1).toString(),
    label: `Tab ${i + 1}`,
    source: text.value,
  })),
)

const activeStatic = ref('1')
</script>

<template>
  <div style="padding: 24px">
    <a-row :gutter="16">
      <a-col :span="12">
        <a-typography-title :level="4">Editor</a-typography-title>
        <a-textarea v-model:value="text" :style="{ height: panelHeight + 'px' }" />
      </a-col>
      <a-col :span="12">
        <a-typography-title :level="4">Preview (Tabs)</a-typography-title>
        <div class="light-border" :style="{ height: panelHeight + 'px' }">
          <MermaidTabs
            :items="staticItems"
            v-model:activeKey="activeStatic"
            :editable="false"
            :viewer-debounce-ms="0"
          />
        </div>
      </a-col>
    </a-row>
  </div>
  <a-divider class="compact-divider" />
  <div style="padding: 0 24px 24px">
    <a-row :gutter="16">
      <a-col :span="12">
        <div style="margin-bottom: 8px">
          <a-space>
            <a-button danger @click="prefixErrorToInitial">error</a-button>
            <a-button @click="resetToInitial">reset</a-button>
          </a-space>
        </div>
        <a-button type="primary" @click="startStream" :loading="streaming">
          {{ streaming ? 'streaming...' : 'stream' }}
        </a-button>
      </a-col>
      <a-col :span="12">
        <a-typography-title :level="4">Stream Preview (Tabs)</a-typography-title>
        <div class="light-border" :style="{ height: panelHeight + 'px' }">
          <MermaidTabs
            :items="streamTabs"
            v-model:activeKey="activeStreamTab"
            :editable="false"
            :viewer-debounce-ms="200"
          />
          <div v-if="streamTabs.length === 0" class="empty-state">
            点击 "stream" 按钮开始动态展示
          </div>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<style scoped>
.light-border {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 12px;
  box-sizing: border-box;
  overflow-y: auto;
  scrollbar-gutter: stable;
}
.compact-divider {
  margin: 12px 0;
}
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(0, 0, 0, 0.45);
  font-size: 14px;
  text-align: center;
}
</style>
