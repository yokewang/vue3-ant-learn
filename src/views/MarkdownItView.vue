<script setup>
import { ref } from 'vue'
import MarkdownItViewer from '../components/MarkdownItViewer.vue'

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
</script>

<template>
  <div style="padding: 24px">
    <a-row :gutter="16">
      <a-col :span="12">
        <a-typography-title :level="4">Editor</a-typography-title>
        <a-textarea v-model:value="text" :rows="18" />
      </a-col>
      <a-col :span="12">
        <a-typography-title :level="4">Preview</a-typography-title>
        <MarkdownItViewer :source="text" />
      </a-col>
    </a-row>
  </div>
</template>

<style scoped></style>
