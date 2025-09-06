<script setup>
import { ref, watch, onMounted } from 'vue'
import mermaid from 'mermaid'

const props = defineProps({
  source: {
    type: String,
    default: '',
  },
  options: {
    type: Object,
    default: () => ({}),
  },
  debounceMs: {
    type: Number,
    default: 200,
  },
})

const emit = defineEmits(['preview', 'rendered', 'error'])

let mermaidInitialized = false
const containerEl = ref(null)
let renderCounter = 0
let debounceTimer = null
const errorSummary = ref('')

function summarizeError(err) {
  return String(err?.message ?? err ?? '')
}

function escapeHtml(s) {
  return (s || '').replace(
    /[&<>"']/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m],
  )
}

async function doRender() {
  const code = props.source || ''

  try {
    const baseConfig = { startOnLoad: false, securityLevel: 'strict' }
    if (!mermaidInitialized) {
      mermaid.initialize({ ...baseConfig, ...props.options })
      mermaidInitialized = true
    } else if (props.options && Object.keys(props.options).length > 0) {
      mermaid.initialize({ ...baseConfig, ...props.options })
    }

    if (!code.trim()) {
      if (containerEl.value) containerEl.value.innerHTML = ''
      errorSummary.value = ''
      return
    }

    // Validate first
    mermaid.parse(code)
  } catch (err) {
    errorSummary.value = summarizeError(err)
    if (containerEl.value) containerEl.value.innerHTML = ''
    return
  }

  try {
    const id = `mermaid-svg-${Date.now()}-${renderCounter++}`
    const { svg } = await mermaid.render(id, code)
    if (containerEl.value) containerEl.value.innerHTML = svg
    errorSummary.value = ''
  } catch (err) {
    errorSummary.value = summarizeError(err)
    if (containerEl.value) containerEl.value.innerHTML = ''
  }
}

function scheduleRender() {
  const delay = Number(props.debounceMs ?? 200)
  if (delay <= 0) {
    clearTimeout(debounceTimer)
    debounceTimer = null
    errorSummary.value = ''
    doRender()
    return
  }
  if (containerEl.value) {
    const raw = escapeHtml(props.source || '')
    containerEl.value.innerHTML = `<pre class="mermaid-raw">${raw}</pre>`
  }
  emit('preview')
  errorSummary.value = ''
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    doRender()
      .then(() => {
        if (!errorSummary.value) emit('rendered')
      })
      .catch((err) => {
        emit('error', summarizeError(err))
      })
  }, delay)
}

onMounted(() => {
  scheduleRender()
})

watch(
  () => props.source,
  () => {
    scheduleRender()
  },
)

watch(
  () => props.options,
  () => {
    scheduleRender()
  },
  { deep: true },
)
</script>

<template>
  <div>
    <div v-if="errorSummary" class="mermaid-error">渲染失败：{{ errorSummary }}</div>
    <div ref="containerEl" class="mermaid-viewer"></div>
  </div>
</template>

<style scoped>
.mermaid-viewer {
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.88);
}
.mermaid-error {
  color: #cf1322;
  background: #fff1f0;
  border: 1px solid #ffa39e;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 12px;
}
.mermaid-raw {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
  background: #fafafa;
  color: rgba(0, 0, 0, 0.65);
  border-radius: 4px;
}
</style>
