<script setup>
import { ref, onBeforeUnmount, onMounted, watch, nextTick } from 'vue'
import MermaidViewer from '@/components/MermaidViewer.vue'

const initialText = `graph TD
  A[Start] --> B{Check}
  B -- Yes --> C[Do thing]
  B -- No --> D[Skip]
  C --> E[End]
  D --> E[End]
`

const text = ref(initialText)

const streamText = ref('')
const streaming = ref(false)
let streamTimer = null

const panelHeight = 300

const streamContainerEl = ref(null)
const previewContainerEl = ref(null)
const isFullscreen = ref(false)

function scrollToBottom() {
  const el = streamContainerEl.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
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


onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

function prefixErrorToInitial() {
  text.value = `***error***\n${initialText}`
}

function resetToInitial() {
  text.value = initialText
}

function startStream() {
  if (streaming.value) return
  streaming.value = true
  streamText.value = ''
  const content = text.value || ''
  let index = 0
  const step = () => {
    if (index >= content.length) {
      clearInterval(streamTimer)
      streamTimer = null
      streaming.value = false
      return
    }
    streamText.value += content[index]
    index += 1
  }
  streamTimer = setInterval(step, 20)
}

onBeforeUnmount(() => {
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})

watch(streamText, async () => {
  await nextTick()
  scrollToBottom()
})
</script>

<template>
  <div style="padding: 24px">
    <a-row :gutter="16">
      <a-col :span="12">
        <a-typography-title :level="4">Editor</a-typography-title>
        <a-textarea v-model:value="text" :style="{ height: panelHeight + 'px' }" />
      </a-col>
      <a-col :span="12">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
          <a-typography-title :level="4" style="margin: 0">Preview</a-typography-title>
          <a-button type="text" @click="toggleFullscreen">
            {{ isFullscreen ? '⛶ 退出全屏' : '⛶ 全屏' }}
          </a-button>
        </div>
        <div ref="previewContainerEl" class="light-border preview-container" :style="{ height: panelHeight + 'px' }">
          <MermaidViewer :source="text" :debounce-ms="0" />
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
        <a-button type="primary" @click="startStream" :loading="streaming">stream</a-button>
      </a-col>
      <a-col :span="12">
        <a-typography-title :level="4">Stream Preview</a-typography-title>
        <div ref="streamContainerEl" class="light-border" :style="{ height: panelHeight + 'px' }">
          <MermaidViewer
            :source="streamText"
            @preview="scrollToBottom"
            @rendered="scrollToBottom"
            @error="scrollToBottom"
          />
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
}
.preview-container {
  background: white;
  position: relative;
}

.preview-container:fullscreen {
  background: white;
  padding: 24px;
  overflow: auto;
}
.compact-divider {
  margin: 12px 0;
}
</style>
