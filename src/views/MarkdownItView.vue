<script setup>
// 该视图演示：左侧编辑 Markdown，右侧实时预览；
// 下方通过按钮模拟“流式”追加文本，右侧自动滚动到最新内容。
// Vue 基础 API
import { ref, onBeforeUnmount, watch, nextTick } from 'vue'
// Markdown 渲染组件（基于 markdown-it + highlight.js）
import MarkdownItViewer from '@/components/MarkdownItViewer.vue'

// 编辑器双向绑定的 Markdown 文本（上方 Preview 同步渲染）
const text = ref(`# Markdown Demo

Type in the editor to preview on the right.

- Ant Design Vue layout
- markdown-it rendering
- Live preview

## Code

\`\`\`js
console.log('hello markdown-it');
\`\`\`

[Ant Design Vue](https://antdv.com/)
`)

const streamText = ref('')
// 是否处于“流式输出”中（用于控制按钮 loading 状态）
const streaming = ref(false)
// 流式追加文本的定时器句柄
let streamTimer = null

// 上方 Preview 与下方 Stream Preview 的固定高度（可按需调整）
const panelHeight = 300

// 流式预览容器的 DOM 引用，用于自动滚动到底部
const streamContainerEl = ref(null)

// 点击按钮开始“流式输出”（使用上方编辑器内容），以 20ms/字符 的节奏向右侧面板追加内容
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

// 组件卸载时清理定时器，避免内存泄漏或继续写入
onBeforeUnmount(() => {
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
})

// 监听流式文本的变化，在 DOM 更新后将容器滚动到最底部，确保总能看到最新内容
watch(streamText, async () => {
  await nextTick()
  const el = streamContainerEl.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
})
</script>

<template>
  <!-- 顶部：编辑器 + 实时预览 -->
  <div style="padding: 24px">
    <a-row :gutter="16">
      <!-- 左：编辑器（与右侧预览等高） -->
      <a-col :span="12">
        <a-typography-title :level="4">Editor</a-typography-title>
        <a-textarea v-model:value="text" :style="{ height: panelHeight + 'px' }" />
      </a-col>
      <!-- 右：实时预览（外层容器用于固定高度 + 溢出滚动） -->
      <a-col :span="12">
        <a-typography-title :level="4">Preview</a-typography-title>
        <div class="light-border" :style="{ height: panelHeight + 'px' }">
          <MarkdownItViewer :source="text" />
        </div>
      </a-col>
    </a-row>
  </div>
  <a-divider class="compact-divider" />
  <!-- 底部：流式追加控制 + 右侧流式预览（自动滚动） -->
  <div style="padding: 0 24px 24px">
    <a-row :gutter="16">
      <!-- 左：触发流式输出的按钮（loading 表示正在输出） -->
      <a-col :span="12">
        <a-button type="primary" @click="startStream" :loading="streaming">stream</a-button>
      </a-col>
      <!-- 右：流式预览（容器使用 ref 以便代码中进行滚动控制） -->
      <a-col :span="12">
        <a-typography-title :level="4">Stream Preview</a-typography-title>
        <div ref="streamContainerEl" class="light-border" :style="{ height: panelHeight + 'px' }">
          <MarkdownItViewer :source="streamText" />
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<style scoped>
/* 预览容器：浅色边框、固定高度、内容超出时出现纵向滚动条 */
.light-border {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 12px;
  box-sizing: border-box;
  overflow-y: auto;
}
/* 较紧凑的分割线（缩小默认上下间距） */
.compact-divider {
  margin: 12px 0;
}
</style>
