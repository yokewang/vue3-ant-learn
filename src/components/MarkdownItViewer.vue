<script setup>
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import { computed, onMounted, watch, nextTick, ref } from 'vue'

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

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  ...props.options,
})

const renderedHtml = computed(() => md.render(props.source || ''))

const containerEl = ref(null)

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
})

watch(renderedHtml, async () => {
  await nextTick()
  applyHighlight()
})
</script>

<template>
  <div ref="containerEl" class="markdown-viewer" v-html="renderedHtml"></div>
</template>

<style scoped>
.markdown-viewer {
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.88);
}
/* Headings */
.markdown-viewer :where(h1, h2, h3, h4, h5, h6) {
  margin: 0.8em 0 0.5em;
  font-weight: 600;
}
/* Code blocks */
.markdown-viewer pre {
  background-color: #f6f8fa;
  padding: 12px;
  border-radius: 6px;
  overflow: auto;
}
/* Inline code */
.markdown-viewer :not(pre) code {
  background-color: #f6f8fa;
  padding: 0 4px;
  border-radius: 4px;
}
/* Lists */
.markdown-viewer :where(ul, ol) {
  padding-left: 1.4em;
}
/* Links */
.markdown-viewer a {
  color: #1677ff;
}
</style>
