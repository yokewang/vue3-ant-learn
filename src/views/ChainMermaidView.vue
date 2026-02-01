<script setup>
import { ref, onBeforeUnmount, onMounted, watch } from 'vue'
import MermaidViewer from '@/components/MermaidViewer.vue'

const availableFiles = ref([])
const selectedFile = ref('')

const text = ref('')

const previewContainerEl = ref(null)
const isFullscreen = ref(false)

// Split pane state
const editorWidthPercent = ref(33.333)
const dragging = ref(false)
const containerEl = ref(null)

const MIN_EDITOR_PCT = 20
const MAX_EDITOR_PCT = 70

async function fetchList() {
  const res = await fetch('/api/chain/mermaid/list')
  const json = await res.json()
  if (json.code === 0) {
    availableFiles.value = json.data
    if (availableFiles.value.length > 0) {
      selectedFile.value = availableFiles.value[0]
    }
  }
}

async function fetchDetail(filename) {
  const res = await fetch(`/api/chain/mermaid/detail?filename=${filename}`)
  const json = await res.json()
  if (json.code === 0) {
    text.value = json.data?.content || ''
  }
}

async function onFileChange() {
  if (!selectedFile.value) return
  await fetchDetail(selectedFile.value)
}

function toggleFullscreen() {
  if (!previewContainerEl.value) return

  if (!isFullscreen.value) {
    previewContainerEl.value.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

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
  const el = containerEl.value
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

watch(selectedFile, async (v) => {
  if (!v) return
  await fetchDetail(v)
})

onMounted(async () => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  await fetchList()
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div class="page">
    <div class="header">
      <a-space>
        <a-typography-title :level="4" class="title">chain-mermaid</a-typography-title>
        <a-select v-model:value="selectedFile" style="width: 260px" @change="onFileChange">
          <a-select-option v-for="file in availableFiles" :key="file" :value="file">
            {{ file }}
          </a-select-option>
        </a-select>
      </a-space>
      <a-button type="text" @click="toggleFullscreen">
        {{ isFullscreen ? '⛶ 退出全屏' : '⛶ 全屏' }}
      </a-button>
    </div>

    <div ref="containerEl" class="split">
      <div class="pane pane-left" :style="{ width: editorWidthPercent + '%' }">
        <div class="pane-title">Editor</div>
        <a-textarea v-model:value="text" class="editor" />
      </div>

      <div class="resizer" @mousedown="onResizerMouseDown" />

      <div class="pane pane-right" :style="{ width: 100 - editorWidthPercent + '%' }">
        <div class="pane-title">Preview</div>
        <div ref="previewContainerEl" class="preview light-border">
          <MermaidViewer :source="text" :debounce-ms="0" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100vh;
  width: 100%;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.header {
  height: 56px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  margin: 0;
}

.split {
  flex: 1;
  min-height: 0;
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
  border-right: 1px solid #f0f0f0;
}

.pane-right {
  border-left: 1px solid #f0f0f0;
}

.pane-title {
  height: 40px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  font-weight: 600;
  color: #222;
}

.editor {
  flex: 1;
  min-height: 0;
}

.resizer {
  width: 6px;
  cursor: col-resize;
  background: transparent;
}

.resizer:hover {
  background: rgba(24, 144, 255, 0.12);
}

.light-border {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  box-sizing: border-box;
}

.preview {
  flex: 1;
  min-height: 0;
  margin: 12px;
  padding: 12px;
  overflow: auto;
  background: #fff;
}

.preview:fullscreen {
  background: white;
  padding: 24px;
  overflow: auto;
}
</style>
