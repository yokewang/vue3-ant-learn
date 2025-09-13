<script setup>
import { ref, computed, nextTick, onBeforeUnmount, watch } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'
import { useAnalysisSampleStore } from '@/stores/analysis-sample'
import MarkedViewer from '@/components/MarkedViewer.vue'
import MermaidTabs from '@/components/MermaidTabs.vue'

// This view demonstrates two streaming ways to fill the `analysis` store:
// 1) "stream" button simulates typing from local sample data
// 2) "sse stream" consumes a real SSE endpoint and updates the store live
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

// Streaming state for the two modes
const streaming = ref(false)
let streamTimer = null
const sseStreaming = ref(false)
let esClient = null

// Resets the analysis store to an empty state for a new stream session
function resetAnalysisState() {
  analysis.summary = ''
  analysis.solution = ''
  analysis.alert = ''
  analysis.causeSummary = ''
  analysis.causeDetail = ''
  analysis.topos = []
}

// Ensure EventSource is properly closed
function closeEventSource() {
  if (esClient) {
    esClient.close()
    esClient = null
  }
}

// Simulate streaming by typing characters from local sample data
async function streamFill() {
  if (streaming.value) return
  streaming.value = true

  resetAnalysisState()

  // Types text into a reactive target character-by-character
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
  closeEventSource()
})

// Auto-scroll helpers (keep each panel scrolled to the bottom when updating)
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

// Register an auto-scroll watcher for a reactive source
function useAutoScroll(sourceGetter, elRef) {
  watch(sourceGetter, async () => {
    await nextTick()
    scrollToBottom(elRef)
  })
}

useAutoScroll(() => analysis.summary, summaryEl)
useAutoScroll(() => analysis.solution, solutionEl)
useAutoScroll(() => analysis.alert, alertEl)
useAutoScroll(() => analysis.causeSummary, causeSummaryEl)
useAutoScroll(() => analysis.causeDetail, causeDetailEl)

// Concatenate SSE tokens verbatim to preserve formatting (spaces/newlines)
function appendTokenText(current, token) {
  return (current || '') + (token || '')
}

// Consume SSE stream and incrementally fill the analysis store
function sseStream() {
  if (sseStreaming.value) return
  sseStreaming.value = true

  // reset state
  resetAnalysisState()
  activeKey.value = ''

  esClient = new EventSource('/analysis/stream')

  esClient.addEventListener('segment_start', (e) => {
    try {
      const payload = JSON.parse(e.data)
      const field = payload.field
      if (field === 'topos') {
        const idx = typeof payload.index === 'number' ? payload.index : analysis.topos.length
        // ensure index exists
        while (analysis.topos.length <= idx) {
          analysis.topos = [...analysis.topos, '']
        }
        activeKey.value = String(idx + 1)
      } else if (field && field in analysis) {
        analysis[field] = ''
      }
    } catch {}
  })

  esClient.addEventListener('segment_data', (e) => {
    try {
      const payload = JSON.parse(e.data)
      const field = payload.field
      const text = payload.text || ''
      if (field === 'topos') {
        const idx = typeof payload.index === 'number' ? payload.index : analysis.topos.length - 1
        const arr = analysis.topos.slice()
        const current = arr[idx] || ''
        arr[idx] = appendTokenText(current, text)
        analysis.topos = arr
      } else if (field && typeof analysis[field] === 'string') {
        analysis[field] = appendTokenText(analysis[field], text)
      }
    } catch {}
  })

  esClient.addEventListener('segment_end', (e) => {
    try {
      const payload = JSON.parse(e.data)
      if (payload.field === 'causeDetail') {
        sseStreaming.value = false
        closeEventSource()
      }
    } catch {}
  })

  esClient.onerror = () => {
    sseStreaming.value = false
    closeEventSource()
  }
}
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
      <a-button :loading="sseStreaming" @click="sseStream">{{
        sseStreaming ? 'sse...' : 'sse stream'
      }}</a-button>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  padding: 24px;
  min-height: 100vh;
  box-sizing: border-box;
  overflow-y: auto;
}
.grid-3x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: repeat(3, minmax(260px, auto));
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
  gap: 12px;
}
</style>
