<script setup>
import { ref, computed, nextTick, onBeforeUnmount, watch } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'
import { useAnalysisSampleStore } from '@/stores/analysis-sample'
import MarkedViewer from '@/components/MarkedViewer.vue'
import MermaidTabs from '@/components/MermaidTabs.vue'

const analysis = useAnalysisStore()
const sample = useAnalysisSampleStore()

// Ensure topos starts empty in view (display)
if (Array.isArray(analysis.topos) && analysis.topos.length > 0) {
  analysis.topos = []
}

const panelHeight = 260

const items = computed(() =>
  (analysis.topos || []).map((s, idx) => ({
    key: String(idx + 1),
    label: `Topo ${idx + 1}`,
    source: s,
  })),
)
const activeKey = ref(items.value[0]?.key || '')

// Streaming logic
const streaming = ref(false)
let streamTimer = null

async function streamFill() {
  if (streaming.value) return
  streaming.value = true

  analysis.summary = ''
  analysis.solution = ''
  analysis.alert = ''
  analysis.causeSummary = ''
  analysis.causeDetail = ''
  analysis.topos = []

  async function typeInto(setter, content) {
    const text = content || ''
    let i = 0
    let acc = ''
    return new Promise((resolve) => {
      clearInterval(streamTimer)
      streamTimer = setInterval(() => {
        if (i >= text.length) {
          clearInterval(streamTimer)
          streamTimer = null
          resolve()
          return
        }
        acc += text[i]
        setter(acc)
        i++
      }, 10)
    })
  }

  await typeInto((v) => (analysis.summary = v), sample.summary || '')
  await typeInto((v) => (analysis.solution = v), sample.solution || '')
  await typeInto((v) => (analysis.alert = v), sample.alert || '')

  const topoSources = Array.isArray(sample.topos) ? sample.topos : []
  for (let idx = 0; idx < topoSources.length; idx++) {
    const src = topoSources[idx] || ''
    analysis.topos = [...analysis.topos, '']
    await nextTick()
    const currentIndex = analysis.topos.length - 1
    // Switch to the newly added tab
    activeKey.value = String(currentIndex + 1)
    await typeInto((v) => {
      const arr = analysis.topos.slice()
      arr[currentIndex] = v
      analysis.topos = arr
    }, src)
    await new Promise((r) => setTimeout(r, 400))
  }

  await typeInto((v) => (analysis.causeSummary = v), sample.causeSummary || '')
  await typeInto((v) => (analysis.causeDetail = v), sample.causeDetail || '')

  streaming.value = false
}

onBeforeUnmount(() => {
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
})

// Auto-scroll containers to bottom on update
const summaryEl = ref(null)
const solutionEl = ref(null)
const alertEl = ref(null)
const causeSummaryEl = ref(null)
const causeDetailEl = ref(null)

function scrollToBottom(elRef) {
  const el = elRef?.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
}

watch(
  () => analysis.summary,
  async () => {
    await nextTick()
    scrollToBottom(summaryEl)
  },
)
watch(
  () => analysis.solution,
  async () => {
    await nextTick()
    scrollToBottom(solutionEl)
  },
)
watch(
  () => analysis.alert,
  async () => {
    await nextTick()
    scrollToBottom(alertEl)
  },
)
watch(
  () => analysis.causeSummary,
  async () => {
    await nextTick()
    scrollToBottom(causeSummaryEl)
  },
)
watch(
  () => analysis.causeDetail,
  async () => {
    await nextTick()
    scrollToBottom(causeDetailEl)
  },
)
</script>

<template>
  <div class="page-container">
    <div class="grid-3x2">
      <div class="cell">
        <a-typography-title :level="4">summary</a-typography-title>
        <div ref="summaryEl" class="panel" :style="{ height: panelHeight + 'px' }">
          <MarkedViewer :source="analysis.summary" />
        </div>
      </div>
      <div class="cell">
        <a-typography-title :level="4">solution</a-typography-title>
        <div ref="solutionEl" class="panel" :style="{ height: panelHeight + 'px' }">
          <MarkedViewer :source="analysis.solution" />
        </div>
      </div>

      <div class="cell">
        <a-typography-title :level="4">alert</a-typography-title>
        <div ref="alertEl" class="panel" :style="{ height: panelHeight + 'px' }">
          <MarkedViewer :source="analysis.alert" />
        </div>
      </div>
      <div class="cell">
        <a-typography-title :level="4">topos (mermaid)</a-typography-title>
        <div class="panel" :style="{ height: panelHeight + 'px' }">
          <MermaidTabs
            :items="items"
            v-model:activeKey="activeKey"
            :editable="false"
            :viewer-debounce-ms="200"
          />
        </div>
      </div>

      <div class="cell">
        <a-typography-title :level="4">causeSummary</a-typography-title>
        <div ref="causeSummaryEl" class="panel" :style="{ height: panelHeight + 'px' }">
          <MarkedViewer :source="analysis.causeSummary" />
        </div>
      </div>
      <div class="cell">
        <a-typography-title :level="4">causeDetail</a-typography-title>
        <div class="collapse-wrapper" :style="{ height: panelHeight + 'px' }">
          <a-collapse :bordered="false" style="height: 100%">
            <a-collapse-panel key="detail" header="Detail" :show-arrow="true">
              <div ref="causeDetailEl" class="panel" style="height: 100%">
                <MarkedViewer :source="analysis.causeDetail" />
              </div>
            </a-collapse-panel>
          </a-collapse>
        </div>
      </div>
    </div>

    <div class="actions">
      <a-button type="primary" :loading="streaming" @click="streamFill">{{
        streaming ? 'streaming...' : 'stream'
      }}</a-button>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  padding: 24px;
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
}
.grid-3x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: repeat(3, auto);
  gap: 12px;
}
.cell {
  min-height: 0;
}
.panel {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 12px;
  box-sizing: border-box;
  overflow: auto;
}
.collapse-wrapper :deep(.ant-collapse) {
  height: 100%;
}
.collapse-wrapper :deep(.ant-collapse-item) {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.collapse-wrapper :deep(.ant-collapse-content) {
  height: calc(100% - 44px); /* header approx 44px */
  overflow: hidden;
}
.collapse-wrapper :deep(.ant-collapse-content > .ant-collapse-content-box) {
  height: 100%;
  padding: 0; /* remove extra padding to fit height */
}
.actions {
  display: flex;
  justify-content: center;
  padding-top: 12px;
}
</style>
