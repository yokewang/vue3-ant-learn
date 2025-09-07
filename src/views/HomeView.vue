<template>
  <div>
    <h1>This is a Home page</h1>
    <div style="margin-top: 12px">
      <a-space>
        <a-button type="primary" @click="testGet">Test GET /api/hello</a-button>
        <a-button @click="testPost">Test POST /api/hello</a-button>
        <a-button type="dashed" @click="testStream" :loading="streamLoading"
          >Test SSE /api/hello/stream</a-button
        >
      </a-space>
    </div>
    <div style="margin-top: 12px">
      <p>GET Result:</p>
      <pre>{{ getResult }}</pre>
      <p>POST Result:</p>
      <pre>{{ postResult }}</pre>
      <p>SSE Result:</p>
      <pre>{{ streamText }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { message } from 'ant-design-vue'

const getResult = ref('')
const postResult = ref('')
const streamText = ref('')
const streamLoading = ref(false)

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

function testStream() {
  streamText.value = ''
  streamLoading.value = true
  try {
    const es = new EventSource('/api/hello/stream')
    es.onmessage = (e) => {
      try {
        // console.log('e.data', e.data)  //for debugging
        // console.log('lastEventId=', e.lastEventId)  //for debugging
        const payload = JSON.parse(e.data)
        streamText.value += payload.delta
      } catch (e) {
        // ignore non-json messages
      }
    }
    es.addEventListener('end', () => {
      message.success('SSE done')
      streamLoading.value = false
      es.close()
    })
    es.onerror = () => {
      message.error('SSE error')
      streamLoading.value = false
      es.close()
    }
  } catch (e) {
    message.error('SSE init failed')
    streamLoading.value = false
  }
}
</script>

<style></style>
