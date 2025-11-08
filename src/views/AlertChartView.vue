<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  ToolboxComponent,
  LegendComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { message } from 'ant-design-vue'

// 按需引入 ECharts 模块
use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  ToolboxComponent,
  LegendComponent,
])

const loading = ref(false)
const autoRefresh = ref(true)
const showReset = ref(false)
const chartRef = ref(null)

// 计算默认偏移天数（当前日期减去 2025-11-04），向上取整
function getDefaultOffsetDays() {
  const now = new Date()
  const baseDate = new Date('2025-11-04')
  return Math.ceil((now.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000))
}

const offsetDays = ref(getDefaultOffsetDays())
const displayHours = ref(3)
const allData = ref([])
const lastUpdateMinute = ref(null)
const isUserInteracted = ref(false)
const pauseTimestamp = ref(null)
const chartStartTime = ref(null)
const viewportStartTime = ref(null)
const viewportEndTime = ref(null)

// 4小时时间戳常量（用于判断缩放级别）
const FOUR_HOURS_MS = 4 * 3600 * 1000

// X轴标签格式化函数
// 格式化 (Zoomed-Out, > 4h): 只显示小时
const zoomedOutFormatter = (value) => {
  const date = new Date(value)
  const minutes = date.getMinutes()
  // 只显示整点标签
  if (minutes === 0) {
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:00`
  }
  return ''
}

// 格式化 (Zoomed-In, <= 4h): 区分整点和分钟
const zoomedInFormatter = (value) => {
  const date = new Date(value)
  const minutes = date.getMinutes()
  
  if (minutes === 0) {
    // 整点, e.g., "14:00"
    return `${String(date.getHours()).padStart(2, '0')}:00`
  }
  // 非整点, e.g., "10", "20"
  return String(minutes)
}

// 时间工具函数
function getCurrentHourStart() {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  return now.getTime()
}

function getNextHourStart() {
  const now = new Date()
  now.setHours(now.getHours() + 1, 0, 0, 0)
  return now.getTime()
}

function getCurrentDayStart() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

function getCurrentMinuteStart() {
  const now = new Date()
  now.setSeconds(0, 0)
  return now.getTime()
}

function getCurrentTime() {
  const now = new Date()
  now.setMilliseconds(0)
  return now.getTime()
}

// 从 API 获取告警数据
async function fetchAlertData(startTime, endTime, offset) {
  try {
    const params = new URLSearchParams({
      startTime: startTime.toString(),
      endTime: endTime.toString(),
      offset: Math.ceil(offset).toString(),
    })
    
    const response = await fetch(`/api/get-alert-data?${params}`)
    const result = await response.json()
    
    if (result.code === 0) {
      return result.data || []
    }
    console.error('获取告警数据失败:', result.message)
    return []
  } catch (error) {
    console.error('获取告警数据出错:', error)
    return []
  }
}

// 合并新数据到现有数据
function mergeData(newDataPoints) {
  if (newDataPoints.length === 0) return
  
  const dataMap = new Map(allData.value.map(([ts, val]) => [ts, val]))
  
  for (const [timestamp, count] of newDataPoints) {
    dataMap.set(timestamp, count)
  }
  
  const merged = Array.from(dataMap.entries())
  merged.sort((a, b) => a[0] - b[0])
  
  // 只保留最近一周的数据
  const oneWeekAgo = getCurrentMinuteStart() - 7 * 24 * 3600 * 1000
  allData.value = merged.filter(([ts]) => ts >= oneWeekAgo)
  updateChartData()
}

// 补齐缺失的数据（从暂停时间到当前时间）
async function fillMissingData() {
  if (!pauseTimestamp.value) return
  const missingData = await fetchAlertData(pauseTimestamp.value, getCurrentMinuteStart(), offsetDays.value)
  mergeData(missingData)
}

// 计算并更新可视范围（完整的N小时，从整点开始到整点结束）
function updateViewportRange() {
  if (chartStartTime.value === null) return
  
  const currentHour = getCurrentHourStart()
  const nextHour = getNextHourStart()
  const newViewportStart = currentHour - (displayHours.value - 1) * 3600 * 1000
  const newViewportEnd = nextHour
  
  // 检查是否需要平移（当当前时间到达或超过结束时间时）
  if (viewportEndTime.value === null || getCurrentTime() >= viewportEndTime.value) {
    viewportStartTime.value = newViewportStart
    viewportEndTime.value = newViewportEnd
  }
}

// 创建 dataZoom 配置
function createDataZoomConfig(startPercent, endPercent) {
  const clampedStart = Math.max(0, Math.min(100, startPercent))
  const clampedEnd = Math.max(clampedStart, Math.min(100, endPercent))
  return [
    { type: 'inside', start: clampedStart, end: clampedEnd },
    { type: 'slider', start: clampedStart, end: clampedEnd, height: 20, bottom: 10 },
  ]
}

// 获取可视范围（返回时间戳范围，单位：毫秒）
function getViewportRange() {
  if (!isUserInteracted.value && viewportStartTime.value !== null && viewportEndTime.value !== null) {
    return viewportEndTime.value - viewportStartTime.value
  }
  
  if (isUserInteracted.value && chartRef.value?.chart) {
    const option = chartRef.value.chart.getOption()
    if (option?.xAxis?.[0]?.min && option?.xAxis?.[0]?.max && option?.dataZoom?.[0]) {
      const { min: xAxisMin, max: xAxisMax } = option.xAxis[0]
      const { start = 0, end = 100 } = option.dataZoom[0]
      const totalRange = xAxisMax - xAxisMin
      return (totalRange * (end - start)) / 100
    }
  }
  return 0
}

// 从 dataZoom 事件参数中获取可视时间范围
function getVisibleTimeRangeFromEvent(params) {
  let startValue, endValue
  
  // 尝试从事件参数中获取精确的 start/end 时间戳
  if (params.batch && params.batch.length > 0) {
    startValue = params.batch[0].startValue
    endValue = params.batch[0].endValue
  } else if (params.startValue !== undefined && params.endValue !== undefined) {
    startValue = params.startValue
    endValue = params.endValue
  } else {
    // 回退：从图表实例获取当前可视范围
    if (!chartRef.value?.chart) return null
    const option = chartRef.value.chart.getOption()
    if (!option?.xAxis?.[0]?.min || !option?.xAxis?.[0]?.max || !option?.dataZoom?.[0]) {
      return null
    }
    const { min: xAxisMin, max: xAxisMax } = option.xAxis[0]
    const { start = 0, end = 100 } = option.dataZoom[0]
    const totalRange = xAxisMax - xAxisMin
    startValue = xAxisMin + (totalRange * start) / 100
    endValue = xAxisMin + (totalRange * end) / 100
  }
  
  return { startValue, endValue }
}

// 根据可视时间范围动态更新 X 轴配置
function updateXAxisByVisibleRange(visibleSpan) {
  if (visibleSpan <= FOUR_HOURS_MS) {
    // --- 应用 Zoomed-In 配置 ---
    // (范围 <= 4 小时)
    chartOption.value = {
      ...chartOption.value,
      xAxis: {
        ...chartOption.value.xAxis,
        interval: 600 * 1000, // 主刻度: 10 分钟
        minInterval: 600 * 1000,
        maxInterval: 600 * 1000,
        axisLabel: {
          ...chartOption.value.xAxis.axisLabel,
          formatter: zoomedInFormatter,
        },
        minorTick: {
          ...chartOption.value.xAxis.minorTick,
          show: false, // 隐藏次刻度 (因为主刻度已是10分钟)
        },
        minorSplitLine: {
          ...chartOption.value.xAxis.minorSplitLine,
          show: false, // 隐藏次刻度线
        },
        minorTickLabel: {
          ...chartOption.value.xAxis.minorTickLabel,
          show: false, // 隐藏次刻度标签
        },
      },
    }
  } else {
    // --- 应用 Zoomed-Out 配置 ---
    // (范围 > 4 小时)
    chartOption.value = {
      ...chartOption.value,
      xAxis: {
        ...chartOption.value.xAxis,
        interval: 3600 * 1000, // 主刻度: 1 小时
        minInterval: 3600 * 1000,
        maxInterval: 3600 * 1000,
        axisLabel: {
          ...chartOption.value.xAxis.axisLabel,
          formatter: zoomedOutFormatter,
        },
        minorTick: {
          ...chartOption.value.xAxis.minorTick,
          show: true, // 显示10分钟次刻度线
        },
        minorSplitLine: {
          ...chartOption.value.xAxis.minorSplitLine,
          show: true, // 显示10分钟次网格
        },
        minorTickLabel: {
          ...chartOption.value.xAxis.minorTickLabel,
          show: false, // 次刻度不显示标签（只有线）
        },
      },
    }
  }
}

// 更新图表数据
function updateChartData() {
  const viewportRange = getViewportRange()
  // 可视范围 < 4小时时，显示圆点
  const isSmallRange = viewportRange > 0 && viewportRange < 4 * 3600 * 1000
  
  const seriesConfig = {
    ...chartOption.value.series[0],
    data: allData.value,
    symbol: isSmallRange ? 'circle' : 'none',
    symbolSize: isSmallRange ? 4 : 0,
    smooth: !isSmallRange,
    sampling: isSmallRange ? false : 'lttb',
  }
  
  if (!isUserInteracted.value && chartStartTime.value !== null) {
    updateViewportRange()
    
    if (viewportStartTime.value === null || viewportEndTime.value === null) return
    
    const timeRange = getXAxisTimeRange()
    if (!timeRange || timeRange.max - timeRange.min === 0) return
    
    const startPercent = ((viewportStartTime.value - timeRange.min) / (timeRange.max - timeRange.min)) * 100
    const endPercent = ((viewportEndTime.value - timeRange.min) / (timeRange.max - timeRange.min)) * 100
    
    // 先根据可视范围更新 X 轴配置
    if (viewportRange > 0) {
      updateXAxisByVisibleRange(viewportRange)
    }
    
    // 然后设置 X 轴的 min 和 max（保留已更新的配置）
    chartOption.value = {
      ...chartOption.value,
      xAxis: { 
        ...chartOption.value.xAxis, 
        min: timeRange.min, 
        max: timeRange.max 
      },
      dataZoom: createDataZoomConfig(startPercent, endPercent),
      series: [seriesConfig],
    }
  } else {
    // 用户操作时，也需要更新 X 轴配置和系列配置
    if (viewportRange > 0) {
      updateXAxisByVisibleRange(viewportRange)
    }
    chartOption.value = { 
      ...chartOption.value, 
      series: [seriesConfig] 
    }
  }
}

// 更新最近一分钟的数据（动态更新）
async function updateLatestMinute() {
  const currentMinute = getCurrentMinuteStart()
  const queryStartTime = lastUpdateMinute.value !== null 
    ? lastUpdateMinute.value - 60 * 1000 
    : currentMinute - 60 * 1000
  const queryEndTime = getCurrentTime()
  
  const latestData = await fetchAlertData(queryStartTime, queryEndTime, offsetDays.value)
  
  if (latestData.length > 0) {
    mergeData(latestData)
    lastUpdateMinute.value = currentMinute
  } else {
    updateChartData()
  }
}

// 检查并更新X轴范围（当到达整点时，平移可视范围）
function checkAndUpdateXAxisMax() {
  if (!isUserInteracted.value) {
    updateChartData()
  }
}

// 计算X轴时间范围
function getXAxisTimeRange() {
  if (chartStartTime.value === null) return null
  return {
    min: chartStartTime.value,
    max: getNextHourStart(),
  }
}

// 重置到显示全范围（完整的N小时，从整点开始到整点结束）
function resetToFullRange(animate = false) {
  if (chartStartTime.value === null) return
  
  viewportStartTime.value = null
  viewportEndTime.value = null
  updateViewportRange()
  
  if (viewportStartTime.value === null || viewportEndTime.value === null) return
  
  const timeRange = getXAxisTimeRange()
  if (!timeRange || timeRange.max - timeRange.min === 0) return
  
  const startPercent = ((viewportStartTime.value - timeRange.min) / (timeRange.max - timeRange.min)) * 100
  const endPercent = ((viewportEndTime.value - timeRange.min) / (timeRange.max - timeRange.min)) * 100
  const [dataZoomConfig] = createDataZoomConfig(startPercent, endPercent)
  
  chartOption.value = {
    ...chartOption.value,
    xAxis: { ...chartOption.value.xAxis, min: timeRange.min, max: timeRange.max },
  }
  
  if (animate && chartRef.value?.chart) {
    chartRef.value.chart.dispatchAction({
      type: 'dataZoom',
      start: dataZoomConfig.start,
      end: dataZoomConfig.end,
      animation: { duration: 1000, easing: 'cubicOut' },
    })
  } else {
    chartOption.value = {
      ...chartOption.value,
      dataZoom: createDataZoomConfig(startPercent, endPercent),
    }
  }
  
  isUserInteracted.value = false
  showReset.value = false
  
  // 重置后，根据新的可视范围更新 X 轴配置
  nextTick(() => {
    const viewportRange = getViewportRange()
    if (viewportRange > 0) {
      updateXAxisByVisibleRange(viewportRange)
    }
  })
}

// 处理用户操作图表
function handleDataZoom(params) {
  isUserInteracted.value = true
  showReset.value = true
  
  // 获取可视时间范围并更新 X 轴配置
  const timeRange = getVisibleTimeRangeFromEvent(params || {})
  if (timeRange) {
    const visibleSpan = timeRange.endValue - timeRange.startValue
    // 根据可视范围动态更新 X 轴配置
    updateXAxisByVisibleRange(visibleSpan)
    // 更新系列配置（显示/隐藏圆点等）
    const isSmallRange = visibleSpan < 4 * 3600 * 1000
    chartOption.value = {
      ...chartOption.value,
      series: [{
        ...chartOption.value.series[0],
        data: allData.value,
        symbol: isSmallRange ? 'circle' : 'none',
        symbolSize: isSmallRange ? 4 : 0,
        smooth: !isSmallRange,
        sampling: isSmallRange ? false : 'lttb',
      }],
    }
  } else {
    // 如果无法从事件获取，延迟一下让图表更新完成后再获取
    nextTick(() => {
      const viewportRange = getViewportRange()
      if (viewportRange > 0) {
        updateXAxisByVisibleRange(viewportRange)
        // 更新系列配置（显示/隐藏圆点等）
        const isSmallRange = viewportRange < 4 * 3600 * 1000
        chartOption.value = {
          ...chartOption.value,
          series: [{
            ...chartOption.value.series[0],
            data: allData.value,
            symbol: isSmallRange ? 'circle' : 'none',
            symbolSize: isSmallRange ? 4 : 0,
            smooth: !isSmallRange,
            sampling: isSmallRange ? false : 'lttb',
          }],
        }
      }
    })
  }
}

// 处理复位按钮点击
function handleReset() {
  resetToFullRange(true)
}

// 处理动态刷新开关变化
async function handleAutoRefreshChange(checked) {
  if (checked) {
    await fillMissingData()
    pauseTimestamp.value = null
    await updateLatestMinute()
    startPolling()
  } else {
    pauseTimestamp.value = getCurrentMinuteStart()
    stopPolling()
  }
}

// 处理偏移天数变化
function handleOffsetDaysChange() {
  initData()
}

// 处理显示小时数变化
function handleDisplayHoursChange() {
  if (!isUserInteracted.value) {
    viewportStartTime.value = null
    viewportEndTime.value = null
    resetToFullRange(false)
  }
}

// 初始化数据
async function initData() {
  loading.value = true
  try {
    const oneWeek = 7 * 24 * 60 * 60 * 1000
    const startTime = getCurrentDayStart() - oneWeek
    chartStartTime.value = startTime
    
    const initialData = await fetchAlertData(startTime, getCurrentTime(), offsetDays.value)
    
    if (initialData.length === 0) {
      message.warning('未获取到数据，请检查偏移天数设置')
      allData.value = []
    } else {
      allData.value = initialData
      if (initialData.length > 0) {
        lastUpdateMinute.value = Math.floor(initialData[initialData.length - 1][0] / 60000) * 60000
      }
    }
    
    updateChartData()
    await nextTick()
    resetToFullRange(false)
    
    if (autoRefresh.value) {
      await updateLatestMinute()
    }
  } catch (error) {
    console.error('数据初始化失败:', error)
    message.error('数据初始化失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

let pollTimer = null
let updateTimer = null

// 启动15秒轮询
function startPolling() {
  if (pollTimer) return
  
  pollTimer = setInterval(() => {
    if (autoRefresh.value) {
      updateLatestMinute().catch(err => console.error('更新数据失败:', err))
    }
  }, 15000)
}

// 停止轮询
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// 启动每秒检查（用于整点时的X轴更新）
function startUpdateTimer() {
  if (updateTimer) return
  
  updateTimer = setInterval(() => {
    if (autoRefresh.value && new Date().getSeconds() === 0) {
      checkAndUpdateXAxisMax()
    }
  }, 1000)
}

// 停止更新定时器
function stopUpdateTimer() {
  if (updateTimer) {
    clearInterval(updateTimer)
    updateTimer = null
  }
}

// ECharts 配置
const chartOption = ref({
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'cross',
    },
    formatter: (params) => {
      const param = params[0]
      const date = new Date(param.value[0])
      return `${date.toLocaleString()}<br/>${param.seriesName}: ${param.value[1]}`
    },
  },
  legend: {
    data: ['每分钟告警量'],
    top: 10,
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '15%',
    top: '15%',
    containLabel: true,
  },
  xAxis: {
    type: 'time',
    boundaryGap: false,
    minInterval: 3600000, // 主刻度间隔：1小时（3600000毫秒）
    maxInterval: 3600000, // 主刻度间隔：1小时
    splitNumber: 4, // 显示4个主刻度（从-3小时到+1小时，共4小时范围，但只显示3小时数据）
    // 主刻度网格线（每小时）
    splitLine: {
      show: true,
      lineStyle: {
        color: '#d9d9d9', // 大刻度颜色
        width: 2, // 大刻度线宽
        type: 'solid',
      },
    },
    // 主刻度标记
    axisTick: {
      show: true,
      alignWithLabel: true,
      lineStyle: {
        color: '#333',
        width: 2,
      },
      length: 8,
    },
    // 次刻度（每10分钟，每个小时之间5个次刻度）
    minorTick: {
      show: true,
      splitNumber: 6, // 每个主刻度之间5个次刻度（对应10分钟间隔：10, 20, 30, 40, 50分钟）
      length: 4,
      lineStyle: {
        color: '#999',
        width: 1,
      },
    },
    // 次刻度网格线
    minorSplitLine: {
      show: true,
      splitNumber: 6, // 每个主刻度之间5条次刻度网格线（对应10分钟间隔）
      lineStyle: {
        color: '#f0f0f0', // 小刻度颜色
        width: 1, // 小刻度线宽
        type: 'solid',
      },
    },
    // 次刻度标签（默认不显示，只在 zoomed-out 状态下显示线）
    minorTickLabel: {
      show: false, // 默认不显示标签，只有线
      splitNumber: 6, // 每个主刻度之间5个次刻度标签
      formatter: (value) => {
        const date = new Date(value)
        const minutes = date.getMinutes()
        // 只显示10分钟刻度的标签（10, 20, 30, 40, 50分钟）
        if (minutes % 10 === 0 && minutes !== 0) {
          return `${String(minutes).padStart(2, '0')}`
        }
        return ''
      },
      color: '#999',
    },
    // 主刻度标签（每小时）- 使用默认的 zoomedOutFormatter
    axisLabel: {
      formatter: zoomedOutFormatter,
      color: '#333',
    },
    // 默认使用 interval 来控制主刻度间隔
    interval: 3600 * 1000, // 默认主刻度: 1 小时
    axisLine: {
      show: true,
      lineStyle: {
        color: '#333',
        width: 2,
      },
    },
  },
  yAxis: {
    type: 'value',
    name: '告警量',
    axisLabel: {
      formatter: '{value}',
    },
  },
  dataZoom: [
    {
      type: 'inside',
      start: 0,
      end: 100,
    },
    {
      type: 'slider',
      start: 0,
      end: 100,
      height: 20,
      bottom: 10,
    },
  ],
  toolbox: {
    feature: {
      dataZoom: {
        yAxisIndex: false,
      },
      restore: {},
      saveAsImage: {},
    },
    right: 10,
    top: 10,
  },
  series: [
    {
      name: '每分钟告警量',
      type: 'line',
      symbol: 'none',
      smooth: true,
      sampling: 'lttb',
      lineStyle: {
        width: 2,
      },
      areaStyle: {
        opacity: 0.3,
      },
      data: allData.value,
    },
  ],
})

// 图表准备就绪时的回调
function onChartReady(chartInstance) {
  // 监听 dataZoom 事件
  chartInstance.on('dataZoom', (params) => {
    handleDataZoom(params)
  })
  
  // 初始加载后，手动调用一次以设置正确的初始缩放状态
  nextTick(() => {
    const viewportRange = getViewportRange()
    if (viewportRange > 0) {
      updateXAxisByVisibleRange(viewportRange)
    } else {
      // 如果没有可视范围信息，使用默认的 zoomed-out 配置
      updateXAxisByVisibleRange(FOUR_HOURS_MS + 1)
    }
  })
}

onMounted(async () => {
  await initData()
  
  if (autoRefresh.value) {
    startPolling()
  }
  
  startUpdateTimer()
})

onBeforeUnmount(() => {
  stopPolling()
  stopUpdateTimer()
})
</script>

<template>
  <div class="page-container">
    <a-card title="告警量趋势图" :bordered="false">
      <template #extra>
        <a-space>
          <a-space>
            <span>偏移天数:</span>
            <a-input-number
              v-model:value="offsetDays"
              :precision="2"
              :step="0.1"
              :min="0"
              placeholder="偏移天数"
              style="width: 100px"
              @change="handleOffsetDaysChange"
            />
          </a-space>
          <a-space>
            <span>显示小时数:</span>
            <a-input-number
              v-model:value="displayHours"
              :precision="0"
              :step="1"
              :min="1"
              placeholder="小时数"
              style="width: 80px"
              @change="handleDisplayHoursChange"
            />
          </a-space>
          <a-switch
            v-model:checked="autoRefresh"
            checked-children="自动刷新"
            un-checked-children="手动"
            @change="handleAutoRefreshChange"
          />
          <a-button
            v-if="showReset"
            size="small"
            type="primary"
            @click="handleReset"
          >
            复位
          </a-button>
          <a-button size="small" @click="initData" :loading="loading">
            <template #icon>
              <span>🔄</span>
            </template>
            刷新
          </a-button>
        </a-space>
      </template>
      <a-spin :spinning="loading" tip="加载中...">
        <div class="chart-wrapper">
          <v-chart
            ref="chartRef"
            class="chart"
            :option="chartOption"
            autoresize
            @chart-ready="onChartReady"
          />
        </div>
      </a-spin>
    </a-card>
  </div>
</template>

<style scoped>
.page-container {
  padding: 24px;
  min-height: 100vh;
  box-sizing: border-box;
}

.chart-wrapper {
  width: 100%;
  min-height: 400px;
}

.chart {
  width: 100%;
  height: 400px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .page-container {
    padding: 12px;
  }

  .chart {
    height: 300px;
  }
}
</style>
