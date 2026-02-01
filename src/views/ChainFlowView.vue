<script setup>
import { ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import dagre from 'dagre'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'

const { fitView } = useVueFlow()

const availableFiles = ref([])
const selectedFile = ref('')

const jsonContent = ref('')

const nodes = ref([])
const edges = ref([])

const title = ref('Chain Flow')

const layoutDirection = ref('LR') // 'LR' | 'TB'

const layoutOptions = [
  { label: '左右布局', value: 'LR' },
  { label: '上下布局', value: 'TB' },
]

// Split pane state (editor width)
const editorWidthPercent = ref(33.333)
const dragging = ref(false)
const splitContainerEl = ref(null)

const MIN_EDITOR_PCT = 20
const MAX_EDITOR_PCT = 70

// Fullscreen (right graph)
const flowFullscreenEl = ref(null)
const isFullscreen = ref(false)

const NODE_WIDTH = 180
const NODE_HEIGHT = 40

function applyHandlePositions(ns, direction) {
  return ns.map((n) => ({
    ...n,
    sourcePosition: direction === 'LR' ? 'right' : 'bottom',
    targetPosition: direction === 'LR' ? 'left' : 'top',
  }))
}

function layoutWithDagre(ns, es, direction) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))

  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 80,
  })

  for (const n of ns) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  for (const e of es) {
    if (!e?.source || !e?.target) continue
    g.setEdge(e.source, e.target)
  }

  dagre.layout(g)

  const laidOutNodes = ns.map((n) => {
    const p = g.node(n.id)
    const x = (p?.x ?? 0) - NODE_WIDTH / 2
    const y = (p?.y ?? 0) - NODE_HEIGHT / 2
    return {
      ...n,
      position: { x, y },
    }
  })

  return {
    nodes: applyHandlePositions(laidOutNodes, direction),
    edges: es,
  }
}

function normalizeFlowData(data) {
  const ns = Array.isArray(data?.nodes) ? data.nodes : []
  const es = Array.isArray(data?.edges) ? data.edges : []

  const safeNodes = ns.map((n) => ({
    ...n,
    position: n.position || { x: 0, y: 0 },
  }))

  return { nodes: safeNodes, edges: es }
}

function withAnimatedEdges(es) {
  return (es || []).map((e) => ({
    ...e,
    animated: true,
    style: {
      stroke: '#faad14',
      strokeWidth: 2,
    },
  }))
}

function rerunLayout() {
  const result = layoutWithDagre(nodes.value, edges.value, layoutDirection.value)
  nodes.value = result.nodes
  edges.value = withAnimatedEdges(result.edges)

  // keep editor as source-of-truth without persisting computed positions
  try {
    const raw = JSON.parse(jsonContent.value)
    const rawNodes = Array.isArray(raw?.nodes) ? raw.nodes : []
    const rawEdges = Array.isArray(raw?.edges) ? raw.edges : []
    jsonContent.value = JSON.stringify({ ...raw, nodes: rawNodes, edges: rawEdges }, null, 2)
  } catch {
    // ignore
  }

  requestAnimationFrame(() => {
    try {
      fitView({ padding: 0.2 })
    } catch {
      // ignore
    }
  })
}

const fetchList = async () => {
  const res = await fetch('/api/chain/list')
  const json = await res.json()
  if (json.code === 0) {
    availableFiles.value = json.data
    if (availableFiles.value.length > 0) {
      selectedFile.value = availableFiles.value[0]
    }
  } else {
    throw new Error(json.message || 'Failed to load list')
  }
}

const fetchDetail = async (filename) => {
  const res = await fetch(`/api/chain/detail?filename=${filename}`)
  const json = await res.json()
  if (json.code === 0) {
    const data = json.data
    jsonContent.value = JSON.stringify(data, null, 2)
    title.value = data?.meta?.title || 'Chain Flow'

    const normalized = normalizeFlowData(data)
    nodes.value = normalized.nodes
    edges.value = normalized.edges

    rerunLayout()
  } else {
    throw new Error(json.message || 'Failed to load detail')
  }
}

const onFileChange = async () => {
  if (!selectedFile.value) return
  await fetchDetail(selectedFile.value)
}

const onUpdateClick = () => {
  try {
    const data = JSON.parse(jsonContent.value)
    title.value = data?.meta?.title || 'Chain Flow'

    const normalized = normalizeFlowData(data)
    nodes.value = normalized.nodes
    edges.value = normalized.edges

    rerunLayout()
  } catch (e) {
    alert('Invalid JSON: ' + e.message)
  }
}

// ----- Split resize -----
function clampPct(pct) {
  return Math.max(MIN_EDITOR_PCT, Math.min(MAX_EDITOR_PCT, pct))
}

function onResizerMouseDown(e) {
  e.preventDefault()
  dragging.value = true
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
}

function onMouseMove(e) {
  if (!dragging.value) return
  const el = splitContainerEl.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  const pct = (x / rect.width) * 100
  editorWidthPercent.value = clampPct(pct)
}

function onMouseUp() {
  if (!dragging.value) return
  dragging.value = false
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

// ----- Fullscreen -----
function toggleFullscreen() {
  if (!flowFullscreenEl.value) return

  if (!isFullscreen.value) {
    flowFullscreenEl.value.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

watch(selectedFile, async (v) => {
  if (!v) return
  await fetchDetail(v)
})

watch(layoutDirection, async () => {
  rerunLayout()
})

onMounted(async () => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)

  try {
    await fetchList()
  } catch (e) {
    console.error('Failed to fetch chain list:', e)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div class="page">
    <a-layout class="layout">
      <div ref="splitContainerEl" class="split">
        <div class="pane pane-left" :style="{ width: editorWidthPercent + '%' }">
          <div class="panel-header">
            <div class="panel-title">Chain JSON</div>
            <div class="panel-actions">
              <a-select v-model:value="selectedFile" style="width: 220px" @change="onFileChange">
                <a-select-option v-for="file in availableFiles" :key="file" :value="file">
                  {{ file }}
                </a-select-option>
              </a-select>
              <a-button type="primary" @click="onUpdateClick">Update</a-button>
            </div>
          </div>
          <textarea v-model="jsonContent" class="json-editor"></textarea>
        </div>

        <div class="resizer" @mousedown="onResizerMouseDown" />

        <div class="pane pane-right" :style="{ width: 100 - editorWidthPercent + '%' }">
          <div class="content-header">
            <div class="content-title">{{ title }}</div>
            <div class="content-actions">
              <a-radio-group v-model:value="layoutDirection" button-style="solid">
                <a-radio-button v-for="opt in layoutOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </a-radio-button>
              </a-radio-group>
              <a-button type="text" @click="toggleFullscreen">
                {{ isFullscreen ? '⛶ 退出全屏' : '⛶ 全屏' }}
              </a-button>
            </div>
          </div>

          <div ref="flowFullscreenEl" class="flow-wrapper">
            <VueFlow :nodes="nodes" :edges="edges" fit-view-on-init>
              <Background pattern-color="#f0f0f0" :gap="16" />
              <Controls />
            </VueFlow>
          </div>
        </div>
      </div>
    </a-layout>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  width: 100%;
  background: #f5f5f5;
}

.layout {
  height: 100%;
  width: 100%;
}

.split {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: stretch;
}

.pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
}

.pane-left {
  border-right: 1px solid #eaeaea;
}

.pane-right {
  border-left: 1px solid #eaeaea;
}

.resizer {
  width: 6px;
  cursor: col-resize;
  background: transparent;
}

.resizer:hover {
  background: rgba(24, 144, 255, 0.12);
}

.panel-header {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
}

.panel-title {
  font-weight: 600;
  color: #222;
  margin-bottom: 10px;
}

.panel-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.json-editor {
  width: 100%;
  height: calc(100% - 82px);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  padding: 12px;
  border: none;
  outline: none;
  resize: none;
  background: #fafafa;
  color: #333;
  font-size: 12px;
  line-height: 1.4;
}

.content-header {
  height: 52px;
  padding: 0 12px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.content-title {
  font-weight: 600;
  color: #222;
}

.content-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flow-wrapper {
  flex: 1;
  min-height: 0;
}

.flow-wrapper:fullscreen {
  background: white;
  padding: 12px;
}
</style>
