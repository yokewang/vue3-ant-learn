<template>
  <div>
    <h1>Dev Test View</h1>
    <div style="margin-top: 12px">
      <p>This is a development test view for testing various features.</p>
    </div>
    
    <div style="margin-top: 20px">
      <h2>Markdown Viewer Test</h2>
      <div style="margin-bottom: 12px">
        <a-space>
          <a-button 
            :type="currentComponent === MarkdownItViewer ? 'primary' : 'default'"
            @click="handleClick(MarkdownItViewer)"
          >
            MarkdownItViewer
          </a-button>
          <a-button 
            :type="currentComponent === MarkedViewer ? 'primary' : 'default'"
            @click="handleClick(MarkedViewer)"
          >
            MarkedViewer
          </a-button>
        </a-space>
      </div>
      
      <div style="border: 1px solid #d9d9d9; padding: 16px; border-radius: 6px; min-height: 200px;">
        <component :is="currentComponent" :source="text"></component>
      </div>
    </div>
  </div>
</template>

<script setup>
// DevTestView component logic can be added here
import { ref, shallowRef } from 'vue'
import MarkdownItViewer from '@/components/MarkdownItViewer.vue'
import MarkedViewer from '@/components/MarkedViewer.vue'

const text = ref(`# Marked Demo

Type in the editor to preview on the right.

- Ant Design Vue layout
- marked rendering
- Live preview

## Code

\`\`\`js
console.log('hello marked');
\`\`\`

[Ant Design Vue](https://antdv.com/)
`)

const currentComponent = shallowRef(MarkdownItViewer)
const handleClick = (component) => {
  console.log(component)
  currentComponent.value = component
}
</script>

<style></style>
