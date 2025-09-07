<script setup>
import { ref, onBeforeUnmount, watch, nextTick } from 'vue'
import MarkedViewer from '../components/MarkedViewer.vue'

const text = ref(`# Marked + Collapse Demo

右侧通过 Collapse 展示内容，默认不展开。

- Ant Design Vue layout
- marked rendering
- a-collapse wrapper

## Code

\`\`\`js
console.log('hello collapse marked');
\`\`\`

[Ant Design Vue](https://antdv.com/)
`)

const streamText = ref('')
const streaming = ref(false)
let streamTimer = null

const panelHeight = 300

const streamContainerEl = ref(null)

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
})

watch(streamText, async () => {
  await nextTick()
  const el = streamContainerEl.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
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
        <a-typography-title :level="4">Preview (Collapse)</a-typography-title>
        <a-collapse :bordered="false">
          <a-collapse-panel key="static" header="Static Preview">
            <div class="light-border" :style="{ height: panelHeight + 'px' }">
              <MarkedViewer :source="text" />
            </div>
          </a-collapse-panel>
        </a-collapse>
      </a-col>
    </a-row>
  </div>
  <a-divider class="compact-divider" />
  <div style="padding: 0 24px 24px">
    <a-row :gutter="16">
      <a-col :span="12">
        <a-button type="primary" @click="startStream" :loading="streaming">stream</a-button>
      </a-col>
      <a-col :span="12">
        <a-typography-title :level="4">Stream Preview (Collapse)</a-typography-title>
        <a-collapse :bordered="false">
          <a-collapse-panel key="stream" header="Stream Preview">
            <div
              ref="streamContainerEl"
              class="light-border"
              :style="{ height: panelHeight + 'px' }"
            >
              <MarkedViewer :source="streamText" />
            </div>
          </a-collapse-panel>
        </a-collapse>
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
.compact-divider {
  margin: 12px 0;
}
</style>
