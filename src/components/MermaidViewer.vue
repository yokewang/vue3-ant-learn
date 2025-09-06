<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
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
})

let mermaidInitialized = false
const containerEl = ref(null)
let renderCounter = 0
const lastSuccessfulSvg = ref('')

async function renderDiagram() {
  if (!containerEl.value) return
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
      containerEl.value.innerHTML = ''
      lastSuccessfulSvg.value = ''
      return
    }

    // Validate first; on error, keep the last successful diagram and suppress inline error
    mermaid.parse(code)
  } catch (err) {
    containerEl.value.innerHTML = lastSuccessfulSvg.value || ''
    return
  }

  try {
    const id = `mermaid-svg-${Date.now()}-${renderCounter++}`
    const { svg } = await mermaid.render(id, code)
    containerEl.value.innerHTML = svg
    lastSuccessfulSvg.value = svg
  } catch (err) {
    containerEl.value.innerHTML = lastSuccessfulSvg.value || ''
  }
}

onMounted(() => {
  renderDiagram()
})

watch(
  () => props.source,
  async () => {
    await nextTick()
    renderDiagram()
  },
)

watch(
  () => props.options,
  async () => {
    await nextTick()
    renderDiagram()
  },
  { deep: true },
)
</script>

<template>
  <div ref="containerEl" class="mermaid-viewer"></div>
</template>

<style scoped>
.mermaid-viewer {
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.88);
}
</style>
