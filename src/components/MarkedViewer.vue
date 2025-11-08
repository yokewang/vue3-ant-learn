<script setup>
import { computed, onMounted, onUpdated, watch, nextTick, ref } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const props = defineProps({
  source: {
    type: String,
    default: '',
  },
  options: {
    type: Object,
    default: () => ({}),
  },
})

// Configure marked with highlight.js
marked.setOptions({
  ...props.options,
  highlight(code, lang) {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      return hljs.highlightAuto(code).value
    } catch (e) {
      return code
    }
  },
})

const renderedHtml = computed(() => marked.parse(props.source || ''))

const containerEl = ref(null)
const renderCount = ref(0)

function applyHighlight() {
  if (!containerEl.value) return
  const codeBlocks = containerEl.value.querySelectorAll('pre code')
  codeBlocks.forEach((block) => {
    try {
      hljs.highlightElement(block)
    } catch (err) {
      // no-op
    }
  })
}

onMounted(() => {
  applyHighlight()
  renderCount.value = 1
})

onUpdated(() => {
  renderCount.value++
  console.log(`MarkedViewer 已更新。总渲染次数: ${renderCount.value}`)
})

watch(renderedHtml, async () => {
  console.log(`--MarkedViewer 已更新。总渲染次数: ${renderCount.value}`)

  await nextTick()
  applyHighlight()
})
</script>

<template>
  <!-- <div>renderCount: {{ renderCount }}</div> -->
  <div ref="containerEl" class="markdown-viewer" v-html="renderedHtml"></div>
</template>

<style scoped>
.markdown-viewer {
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.88);
}
.markdown-viewer :where(h1, h2, h3, h4, h5, h6) {
  margin: 0.8em 0 0.5em;
  font-weight: 600;
}
.markdown-viewer pre {
  background-color: #f6f8fa;
  padding: 12px;
  border-radius: 6px;
  overflow: auto;
}
.markdown-viewer :not(pre) code {
  background-color: #f6f8fa;
  padding: 0 4px;
  border-radius: 4px;
}
.markdown-viewer :where(ul, ol) {
  padding-left: 1.4em;
}
.markdown-viewer a {
  color: #1677ff;
}
</style>
