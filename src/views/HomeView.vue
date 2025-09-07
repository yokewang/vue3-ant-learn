<template>
  <div>
    <h1>This is a Home page</h1>
    <div style="margin-top: 12px">
      <a-space>
        <a-button type="primary" @click="testGet">Test GET /api/hello</a-button>
        <a-button @click="testPost">Test POST /api/hello</a-button>
      </a-space>
    </div>
    <div style="margin-top: 12px">
      <p>GET Result:</p>
      <pre>{{ getResult }}</pre>
      <p>POST Result:</p>
      <pre>{{ postResult }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { message } from 'ant-design-vue'

const getResult = ref('')
const postResult = ref('')

async function testGet() {
  try {
    const res = await fetch('/api/hello?name=Vue')
    const data = await res.json()
    getResult.value = JSON.stringify(data)
    message.success('GET success')
  } catch (err) {
    message.error('GET failed')
  }
}

async function testPost() {
  try {
    const res = await fetch('/api/hello', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Mock' }),
    })
    const data = await res.json()
    postResult.value = JSON.stringify(data)
    message.success('POST success')
  } catch (err) {
    message.error('POST failed')
  }
}
</script>

<style></style>
