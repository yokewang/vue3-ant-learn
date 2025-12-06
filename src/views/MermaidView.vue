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
const zoomScale = ref(1) // 缩放比例，1 表示原始大小
const baseScale = ref(1) // 基础缩放比例（充满窗口的比例）
const originalSvgAttributes = ref({ width: null, height: null, styleWidth: null, styleHeight: null })

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

function saveOriginalSvgAttributes() {
  const svg = previewContainerEl.value?.querySelector('.mermaid-viewer svg')
  if (!svg) return
  
  // 保存原始属性
  originalSvgAttributes.value = {
    width: svg.getAttribute('width'),
    height: svg.getAttribute('height'),
    styleWidth: svg.style.width,
    styleHeight: svg.style.height
  }
}

function restoreOriginalSvgAttributes() {
  const svg = previewContainerEl.value?.querySelector('.mermaid-viewer svg')
  if (!svg) return
  
  // 恢复原始属性
  if (originalSvgAttributes.value.width !== null) {
    svg.setAttribute('width', originalSvgAttributes.value.width)
  } else {
    svg.removeAttribute('width')
  }
  
  if (originalSvgAttributes.value.height !== null) {
    svg.setAttribute('height', originalSvgAttributes.value.height)
  } else {
    svg.removeAttribute('height')
  }
  
  svg.style.width = originalSvgAttributes.value.styleWidth || ''
  svg.style.height = originalSvgAttributes.value.styleHeight || ''
}

function adjustSvgSize() {
  if (!previewContainerEl.value || !isFullscreen.value) return
  
  nextTick(() => {
    const svg = previewContainerEl.value?.querySelector('.mermaid-viewer svg')
    if (!svg) return
    
    // 获取全屏容器的可用尺寸（减去 padding）
    const container = previewContainerEl.value
    const availableWidth = container.clientWidth - 48 // 减去 padding 24px * 2
    const availableHeight = container.clientHeight - 48
    
    // 获取 SVG 的 viewBox 或原始尺寸
    const viewBox = svg.getAttribute('viewBox')
    let svgWidth, svgHeight
    
    if (viewBox) {
      const [, , w, h] = viewBox.split(/\s+/).map(Number)
      svgWidth = w
      svgHeight = h
    } else {
      // 使用保存的原始尺寸，如果没有则使用当前尺寸
      const originalWidth = originalSvgAttributes.value.width
      const originalHeight = originalSvgAttributes.value.height
      svgWidth = originalWidth ? parseFloat(originalWidth) : (parseFloat(svg.getAttribute('width')) || svg.clientWidth || 800)
      svgHeight = originalHeight ? parseFloat(originalHeight) : (parseFloat(svg.getAttribute('height')) || svg.clientHeight || 600)
    }
    
    // 计算基础缩放比例，使 SVG 充满可用空间
    const scaleX = availableWidth / svgWidth
    const scaleY = availableHeight / svgHeight
    const base = Math.min(scaleX, scaleY) // 使用较小的比例以保持宽高比
    baseScale.value = base
    
    // 应用用户设置的缩放比例
    const finalScale = base * zoomScale.value
    
    // 设置 SVG 的新尺寸
    const newWidth = svgWidth * finalScale
    const newHeight = svgHeight * finalScale
    
    svg.setAttribute('width', newWidth)
    svg.setAttribute('height', newHeight)
    svg.style.width = `${newWidth}px`
    svg.style.height = `${newHeight}px`
  })
}

function zoomIn() {
  zoomScale.value = Math.min(zoomScale.value + 0.1, 3) // 最大放大到 3 倍
  adjustSvgSize()
}

function zoomOut() {
  zoomScale.value = Math.max(zoomScale.value - 0.1, 0.1) // 最小缩小到 0.1 倍
  adjustSvgSize()
}

function resetZoom() {
  zoomScale.value = 1
  adjustSvgSize()
}

function handleFullscreenChange() {
  const wasFullscreen = isFullscreen.value
  isFullscreen.value = !!document.fullscreenElement
  
  if (isFullscreen.value) {
    // 进入全屏前保存原始属性
    saveOriginalSvgAttributes()
    zoomScale.value = 1
    setTimeout(() => {
      adjustSvgSize()
    }, 100)
  } else if (wasFullscreen) {
    // 退出全屏时恢复原始属性
    zoomScale.value = 1
    nextTick(() => {
      restoreOriginalSvgAttributes()
    })
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  window.addEventListener('resize', handleResize)
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
  window.removeEventListener('resize', handleResize)
})

watch(streamText, async () => {
  await nextTick()
  scrollToBottom()
})

watch(isFullscreen, () => {
  if (isFullscreen.value) {
    setTimeout(() => {
      adjustSvgSize()
    }, 100)
  }
})

function handleResize() {
  if (isFullscreen.value) {
    adjustSvgSize()
  }
}

function handleMermaidRendered() {
  if (isFullscreen.value) {
    // 全屏时，如果是第一次渲染，先保存原始属性
    if (!originalSvgAttributes.value.width && !originalSvgAttributes.value.height) {
      saveOriginalSvgAttributes()
    }
    adjustSvgSize()
  }
}

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
          <!-- 全屏时的缩放控制按钮 -->
          <div v-if="isFullscreen" class="zoom-controls">
            <a-space>
              <a-button size="small" @click="zoomOut">−</a-button>
              <a-button size="small" @click="resetZoom">{{ Math.round(zoomScale * 100) }}%</a-button>
              <a-button size="small" @click="zoomIn">+</a-button>
            </a-space>
          </div>
          <MermaidViewer :source="text" :debounce-ms="0" @rendered="handleMermaidRendered" />
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
.zoom-controls {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.preview-container:fullscreen {
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
}

.preview-container:fullscreen > :deep(.mermaid-viewer) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.compact-divider {
  margin: 12px 0;
}
</style>
