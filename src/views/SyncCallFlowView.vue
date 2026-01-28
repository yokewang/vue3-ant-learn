<script setup>
import { ref } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'

// Initial Nodes
const initialNodes = [
  { id: 'root', type: 'default', label: 'User Order Request', position: { x: 300, y: 0 }, data: { status: 'idle', duration: 0, progress: 0, isActive: false } },
  { id: 'auth-service', type: 'default', label: 'Auth Service', position: { x: 150, y: 150 }, data: { status: 'idle', duration: 0, progress: 0, isActive: false } },
  { id: 'order-service', type: 'default', label: 'Order Service', position: { x: 450, y: 150 }, data: { status: 'idle', duration: 0, progress: 0, isActive: false, isCloud: true } },
  { id: 'auth-db', type: 'default', label: 'Auth DB', position: { x: 150, y: 300 }, data: { status: 'idle', duration: 0, progress: 0, isActive: false } },
  { id: 'order-cache', type: 'default', label: 'Order Redis', position: { x: 350, y: 300 }, data: { status: 'idle', duration: 0, progress: 0, isActive: false } },
  { id: 'order-db', type: 'default', label: 'Order DB', position: { x: 550, y: 300 }, data: { status: 'idle', duration: 0, progress: 0, isActive: false } },
]

// Initial Edges
const initialEdges = [
  { id: 'e1-2', source: 'root', target: 'auth-service', animated: true },
  { id: 'e1-3', source: 'root', target: 'order-service', animated: true },
  { id: 'e2-4', source: 'auth-service', target: 'auth-db', animated: true },
  { id: 'e3-5', source: 'order-service', target: 'order-cache', animated: true },
  { id: 'e3-6', source: 'order-service', target: 'order-db', animated: true },
]

const { findNode, findEdge } = useVueFlow({
  nodes: initialNodes,
  edges: initialEdges,
  fitViewOnInit: true
})

const isRunning = ref(false)
const currentScenario = ref('')
const slowFactor = ref(10)

const progressIntervals = {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms * slowFactor.value))

const resetGraph = () => {
  Object.values(progressIntervals).forEach(clearInterval)
  for (const key in progressIntervals) delete progressIntervals[key]

  initialNodes.forEach(n => {
    const node = findNode(n.id)
    if (node) {
      node.data.status = 'idle'
      node.data.duration = 0
      node.data.progress = 0
      node.data.isActive = false
      updateNodeStyle(node)
    }
  })

  // Reset Edges
  initialEdges.forEach(e => {
      const edge = findEdge(e.id)
      if (edge) {
          edge.style = { stroke: '#b1b1b7', strokeWidth: 1 }
          edge.animated = true // Keep light animation or disable? Let's keep it subtle traverse
      }
  })
}

// Start progress animation
const startProgress = (id, expectedDurationMs) => {
  const node = findNode(id)
  if (!node) return

  const totalRealTime = expectedDurationMs * slowFactor.value
  const startTime = Date.now()
  const UPDATE_FREQ = 50

  if (progressIntervals[id]) clearInterval(progressIntervals[id])

  progressIntervals[id] = setInterval(() => {
    const elapsed = Date.now() - startTime

    const percent = Math.min((elapsed / totalRealTime) * 100, 99.9)
    const currentDuration = Math.min(Math.floor(elapsed / slowFactor.value), expectedDurationMs)

    if (['processing', 'retrying', 'waiting'].includes(node.data.status)) {
       node.data.progress = percent
       node.data.duration = currentDuration
    } else {
       clearInterval(progressIntervals[id])
    }
  }, UPDATE_FREQ)
}

const setActive = (id, isActive) => {
  const node = findNode(id)
  if (!node) return
  node.data.isActive = isActive
  updateNodeStyle(node)
}

// Helper to set Edge Active state
const setEdgeActive = (sourceId, targetId, isActive) => {
    const edge = initialEdges.find(e => e.source === sourceId && e.target === targetId)
    if (!edge) return
    const flowEdge = findEdge(edge.id)
    if (!flowEdge) return

    if (isActive) {
        flowEdge.style = { stroke: '#faad14', strokeWidth: 3 }
        flowEdge.animated = true
    } else {
        flowEdge.style = { stroke: '#b1b1b7', strokeWidth: 1 }
        flowEdge.animated = true
    }
}

const updateNode = (id, status, finalDuration = 0) => {
  const node = findNode(id)
  if (!node) return

  node.data.status = status

  if (['success', 'error'].includes(status)) {
    if (progressIntervals[id]) clearInterval(progressIntervals[id])
    node.data.isActive = false
    if (finalDuration > 0) node.data.duration = finalDuration
    node.data.progress = 100
  }
  updateNodeStyle(node)
}

// Optimized helper for running a node task
const runNodeTask = async (id, duration, status = 'processing') => {
  updateNode(id, status)
  setActive(id, true)
  startProgress(id, duration)
  await sleep(duration)
  updateNode(id, 'success', duration)
}

const updateNodeStyle = (node) => {
  let style = { background: '#fff', color: '#333', borderColor: '#777', borderWidth: '1px' }

  switch (node.data.status) {
    case 'processing':
      style = { background: '#e6f7ff', color: '#096dd9', borderColor: '#1890ff', borderWidth: '1px', boxShadow: '0 0 10px #1890ff' }
      break
    case 'waiting':
      style = { background: '#fff7e6', color: '#d46b08', borderColor: '#ffa940', borderWidth: '2px', borderStyle: 'dashed' }
      break
    case 'success':
      style = { background: '#f6ffed', color: '#389e0d', borderColor: '#52c41a', borderWidth: '1px' }
      break
    case 'error':
      style = { background: '#fff1f0', color: '#cf1322', borderColor: '#ff4d4f', borderWidth: '1px' }
      break
    case 'retrying':
      style = { background: '#fffbe6', color: '#d46b08', borderColor: '#faad14', borderWidth: '1px' }
      break
  }

  if (node.data.isActive) {
      style.borderColor = '#faad14'
      style.borderWidth = '3px'
      style.borderStyle = 'solid'
      style.zIndex = 10
  }

  node.style = style
}


// --- Scenarios ---

const runSuccess = async () => {
  if (isRunning.value) return
  isRunning.value = true
  currentScenario.value = 'Success (Sequential)'
  resetGraph()

  try {
    // 1. Root Starts
    updateNode('root', 'processing')
    setActive('root', true)

    // Adjusted durations:
    // Pre-Auth: 50
    // Auth: 160
    // Gap: 100
    // Pre-Order: 0
    // Order: 260
    // Post-Order: 50
    // Total = 50 + 160 + 100 + 260 + 50 = 620
    startProgress('root', 620)

    await sleep(50)

    // --- Call Auth ---
    setActive('root', false)
    updateNode('root', 'waiting')
    setEdgeActive('root', 'auth-service', true) // Highlight Edge

    const runAuthService = async () => {
      updateNode('auth-service', 'processing')
      setActive('auth-service', true)

      startProgress('auth-service', 160)

      await sleep(30)

      setActive('auth-service', false)
      updateNode('auth-service', 'waiting')
      setEdgeActive('auth-service', 'auth-db', true)
      await runNodeTask('auth-db', 100)
      setEdgeActive('auth-service', 'auth-db', false)
      setActive('auth-service', true)
      updateNode('auth-service', 'processing')

      await sleep(30)
      return 160
    }

    const authTime = await runAuthService()
    updateNode('auth-service', 'success', authTime)
    setEdgeActive('root', 'auth-service', false) // Unhighlight

    // Resume Root
    setActive('root', true)
    updateNode('root', 'processing')

    await sleep(100)

    setActive('root', false)
    updateNode('root', 'waiting')
    setEdgeActive('root', 'order-service', true) // Highlight

    // --- Call Order ---
    const runOrderService = async () => {
      updateNode('order-service', 'processing')
      setActive('order-service', true)
      startProgress('order-service', 260)

      await sleep(30)

      setActive('order-service', false)
      updateNode('order-service', 'waiting')
      setEdgeActive('order-service', 'order-cache', true)
      await runNodeTask('order-cache', 20)
      setEdgeActive('order-service', 'order-cache', false)
      setActive('order-service', true)
      updateNode('order-service', 'processing')

      await sleep(30)

      setActive('order-service', false)
      updateNode('order-service', 'waiting')
      setEdgeActive('order-service', 'order-db', true)
      await runNodeTask('order-db', 150)
      setEdgeActive('order-service', 'order-db', false)
      setActive('order-service', true)
      updateNode('order-service', 'processing')

      await sleep(30)
      return 260
    }

    const orderTime = await runOrderService()
    updateNode('order-service', 'success', orderTime)
    setEdgeActive('root', 'order-service', false) // Unhighlight

    // Finish Root
    setActive('root', true)
    updateNode('root', 'processing')

    await sleep(50)

    const rootTotal = 50 + authTime + 100 + orderTime + 50
    updateNode('root', 'success', rootTotal)

  } finally {
    isRunning.value = false
  }
}


const runFailEarly = async () => {
  if (isRunning.value) return
  isRunning.value = true
  currentScenario.value = 'Fail Early (Sequential)'
  resetGraph()

  try {
    updateNode('root', 'processing')
    setActive('root', true)

    startProgress('root', 130)
    await sleep(50)

    setActive('root', false)
    updateNode('root', 'waiting')
    setEdgeActive('root', 'auth-service', true)

    try {
        updateNode('auth-service', 'processing')
        setActive('auth-service', true)
        startProgress('auth-service', 80)
        await sleep(80)
        throw new Error('Auth Failed')
    } catch {
        updateNode('auth-service', 'error', 80)
        setEdgeActive('root', 'auth-service', false)
        setActive('root', true)
        updateNode('root', 'processing')
        await sleep(20)
        updateNode('root', 'error', 150)
    }

  } finally {
    isRunning.value = false
  }
}


const runRetry = async () => {
  if (isRunning.value) return
  isRunning.value = true
  currentScenario.value = 'Retry (Sequential)'
  resetGraph()

  try {
    updateNode('root', 'processing')
    setActive('root', true)
    startProgress('root', 720)

    await sleep(50)
    setActive('root', false)
    updateNode('root', 'waiting')
    setEdgeActive('root', 'auth-service', true)

    // 1. Auth (Success)
    const runAuthService = async () => {
      updateNode('auth-service', 'processing')
      setActive('auth-service', true)
      startProgress('auth-service', 160)

      await sleep(30)

      setActive('auth-service', false)
      updateNode('auth-service', 'waiting')
      setEdgeActive('auth-service', 'auth-db', true)

      updateNode('auth-db', 'processing')
      setActive('auth-db', true)
      startProgress('auth-db', 100)
      await sleep(100)
      updateNode('auth-db', 'success', 100)

      setEdgeActive('auth-service', 'auth-db', false)
      setActive('auth-service', true)
      updateNode('auth-service', 'processing')

      await sleep(30)
      return 160
    }

    await runAuthService()
    updateNode('auth-service', 'success', 160)
    setEdgeActive('root', 'auth-service', false)

    setActive('root', true)
    updateNode('root', 'processing')
    await sleep(100)

    setActive('root', false)
    updateNode('root', 'waiting')
    setEdgeActive('root', 'order-service', true)

    // 2. Order (Retry)
    const runOrderServiceRetry = async () => {
      updateNode('order-service', 'processing')
      setActive('order-service', true)
      startProgress('order-service', 360)

      await sleep(30)

      setActive('order-service', false)
      updateNode('order-service', 'waiting')
      setEdgeActive('order-service', 'order-cache', true)
      await runNodeTask('order-cache', 20)
      setEdgeActive('order-service', 'order-cache', false)
      setActive('order-service', true)
      updateNode('order-service', 'processing')

      await sleep(30)

      setActive('order-service', false)
      updateNode('order-service', 'waiting')
      setEdgeActive('order-service', 'order-db', true)

      // DB (Retry)
      const runOrderDbRetry = async () => {
        updateNode('order-db', 'processing')
        setActive('order-db', true)

        // 1. Fail
        startProgress('order-db', 50)
        await sleep(50)
        updateNode('order-db', 'error', 50)

        // Backoff
        updateNode('order-db', 'retrying')
        setActive('order-db', true)

        await sleep(100)

        // 2. Retry Success
        startProgress('order-db', 100)
        await sleep(100)

        updateNode('order-db', 'success', 250)
        return 250
      }

      const dbTime = await runOrderDbRetry()
      setEdgeActive('order-service', 'order-db', false)
      setActive('order-service', true)
      updateNode('order-service', 'processing')

      await sleep(30)

      const total = 30 + 20 + 30 + dbTime + 30
      updateNode('order-service', 'success', total)
      return total
    }

    await runOrderServiceRetry()
    setEdgeActive('root', 'order-service', false)

    setActive('root', true)
    updateNode('root', 'processing')

    await sleep(50)
    updateNode('root', 'success', 720)

  } finally {
    isRunning.value = false
  }
}

</script>

<template>
  <div class="layout">
    <div class="sidebar">
      <h3>Sync Call Flow</h3>

      <div class="control-group">
        <label>Slow Factor: {{ slowFactor }}x</label>
        <input
          type="range"
          v-model.number="slowFactor"
          min="5"
          max="50"
          step="5"
          :disabled="isRunning"
        />
        <div class="slider-help">Faster (Left) &lt;---&gt; Slower (Right)</div>
      </div>

      <div class="controls">
        <button @click="runSuccess" :disabled="isRunning" class="btn success">Run Success</button>
        <button @click="runFailEarly" :disabled="isRunning" class="btn error">Run Fail Early</button>
        <button @click="runRetry" :disabled="isRunning" class="btn warning">Run Retry</button>
      </div>

      <div class="status-panel" v-if="currentScenario">
        <p>Scenario: <strong>{{ currentScenario }}</strong></p>
        <p>Status: <span :class="isRunning ? 'running' : 'idle'">{{ isRunning ? 'Running...' : 'Done' }}</span></p>
      </div>
    </div>
    <div class="graph-container">
      <VueFlow>
        <Background />
        <Controls />
        <template #node-default="{ data, label }">
          <div class="custom-node" :class="{ 'is-active': data.isActive }">
            <div class="cloud-badge" v-if="data.isCloud" title="Cloud Service">
               <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
              </svg>
            </div>
            <div class="node-label">{{ label }}</div>
            <div class="node-duration" v-if="data.duration > 0 || ['processing', 'waiting', 'retrying'].includes(data.status)">{{ data.duration }}ms</div>
            <div class="progress-bar-container">
               <div class="progress-bar" :style="{ width: data.progress + '%' }"></div>
            </div>
            <div class="node-status" v-if="data.status !== 'idle'">{{ data.status }}</div>
            <div class="active-badge" v-if="data.isActive">Running</div>
          </div>
        </template>
      </VueFlow>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100%;
  width: 100%;
}

.sidebar {
  width: 250px;
  background: #f0f2f5;
  padding: 20px;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.graph-container {
  flex: 1;
  height: 100%;
}

/* Speed Slider */
.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ddd;
}
.control-group label {
  font-weight: bold;
  font-size: 0.9em;
  color: #555;
}
.slider-help {
  font-size: 0.7em;
  color: #888;
  display: flex;
  justify-content: space-between;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.success { background: #52c41a; color: white; }
.btn.success:hover:not(:disabled) { background: #73d13d; }

.btn.error { background: #ff4d4f; color: white; }
.btn.error:hover:not(:disabled) { background: #ff7875; }

.btn.warning { background: #faad14; color: white; }
.btn.warning:hover:not(:disabled) { background: #ffc53d; }

.custom-node {
  padding: 10px;
  border-radius: 4px;
  text-align: center;
  min-width: 140px;
  position: relative;
  transition: all 0.2s;
}

.node-label {
  font-weight: bold;
}

.node-duration {
  font-size: 0.8em;
  color: #666;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}

.progress-bar-container {
  width: 100%;
  height: 4px;
  background: rgba(0,0,0,0.1);
  margin-top: 8px;
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #1890ff;
  transition: width 0.05s linear;
}

.node-status {
  font-size: 0.7em;
  text-transform: uppercase;
  margin-top: 2px;
  opacity: 0.8;
}

.cloud-badge {
    position: absolute;
    top: -8px;
    left: -8px;
    background: #1890ff;
    color: white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    z-index: 5;
}

.active-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #faad14;
    color: white;
    font-size: 0.6em;
    padding: 2px 4px;
    border-radius: 4px;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.status-panel {
  padding: 10px;
  background: white;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.running { color: #1890ff; font-weight: bold; }
.idle { color: #52c41a; font-weight: bold; }
</style>
