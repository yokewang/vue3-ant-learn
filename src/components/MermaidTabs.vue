<script setup>
import { ref, watch } from 'vue'
import MermaidViewer from './MermaidViewer.vue'

const props = defineProps({
  items: {
    // [{ key, label, source, options?, closable? }]
    type: Array,
    default: () => [],
  },
  activeKey: {
    type: [String, Number],
    default: undefined,
  },
  editable: {
    // when true, shows closable tabs (no add button)
    type: Boolean,
    default: false,
  },
  viewerOptions: {
    type: Object,
    default: () => ({}),
  },
  viewerDebounceMs: {
    type: Number,
    default: 200,
  },
  suppressErrorRendering: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:activeKey', 'edit'])

const currentKey = ref(
  props.activeKey ?? (props.items && props.items.length > 0 ? props.items[0].key : undefined),
)

watch(
  () => props.activeKey,
  (val) => {
    currentKey.value = val
  },
)

watch(
  () => props.items,
  (arr) => {
    if (!arr || arr.length === 0) {
      currentKey.value = undefined
      return
    }
    if (!arr.some((it) => it.key === currentKey.value)) {
      currentKey.value = arr[0].key
      emit('update:activeKey', currentKey.value)
    }
  },
  { deep: true },
)

const onChange = (key) => {
  currentKey.value = key
  emit('update:activeKey', key)
}

const onEdit = (targetKey, action) => {
  emit('edit', targetKey, action)
}
</script>

<template>
  <a-tabs
    :type="editable ? 'editable-card' : 'card'"
    v-model:activeKey="currentKey"
    :hide-add="editable"
    :animated="{ tabPane: false }"
    @change="onChange"
    @edit="editable ? onEdit : undefined"
  >
    <a-tab-pane
      v-for="item in items"
      :key="item.key"
      :tab="item.label"
      :closable="editable && (item.closable ?? true)"
    >
      <MermaidViewer
        :source="item.source"
        :options="{ ...viewerOptions, ...(item.options || {}) }"
        :debounce-ms="viewerDebounceMs"
        :suppress-error-rendering="suppressErrorRendering"
      />
    </a-tab-pane>
  </a-tabs>
</template>

<style scoped></style>
