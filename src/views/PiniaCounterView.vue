<script setup>
import { useCounterStore } from '@/stores/counter'
const counter = useCounterStore()
</script>

<template>
  <div style="padding: 24px">
    <a-typography-title :level="3">Pinia Counter</a-typography-title>
    <a-typography-paragraph>
      当前计数：<strong>{{ counter.count }}</strong>（双倍：{{ counter.doubleCount }}）
    </a-typography-paragraph>
    <a-space>
      <a-button type="primary" @click="counter.increment">increment</a-button>
      <a-button danger @click="counter.reset">reset</a-button>
    </a-space>
  </div>
</template>

<style scoped>
</style>


