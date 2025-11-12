<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  ToolboxComponent,
  TitleComponent,
  LegendComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  ToolboxComponent,
  TitleComponent,
  LegendComponent,
])

const chartRef = ref(null)
const loading = ref(false)
const allData = ref([])
const visibleStartTime = ref('')
const visibleEndTime = ref('')
const visibleDuration = ref('')
const aggregationOptions = [
  { label: '1分钟', value: 1 },
  { label: '5分钟', value: 5 },
  { label: '10分钟', value: 10 },
  { label: '30分钟', value: 30 },
  { label: '1小时', value: 60 },
  { label: '2小时', value: 120 },
  { label: '3小时', value: 180 },
  { label: '6小时', value: 360 },
  { label: '12小时', value: 720 },
  { label: '24小时', value: 1440 },
]
const selectedAggregation = ref(aggregationOptions[0].value)
let resizeObserver = null

const chartOption = ref({
  title: {
    text: '告警趋势（聚合展示）',
    left: 'center',
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'cross',
    },
    formatter(params) {
      if (!params?.length) return ''
      const { value, seriesName } = params[0]
      if (!Array.isArray(value) || value.length < 2) return ''
      return `${dayjs(value[0]).format('YYYY-MM-DD HH:mm:ss')}<br/>${seriesName}: ${value[1]}`
    },
  },
  legend: {
    data: ['告警量'],
    top: 10,
  },
  grid: {
    left: '48px',
    right: '32px',
    bottom: '110px',
    top: '80px',
    containLabel: true,
  },
  xAxis: {
    type: 'time',
    boundaryGap: false,
    splitNumber: 24,
    axisTick: {
      show: true,
      length: 6,
      lineStyle: {
        color: '#666',
        width: 1,
      },
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: '#e5e5e5',
        width: 1,
        type: 'solid',
      },
    },
    axisLabel: {
      formatter(value) {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return ''
        const hour = date.getHours()
        const minutes = date.getMinutes()
        if (hour === 0 && minutes === 0) {
          return `{dateStyle|${dayjs(date).format('MM/DD')}}`
        }
        if (minutes === 0) {
          return `{hourStyle|${String(hour).padStart(2, '0')}}`
        }
        return `{minuteStyle|${String(minutes).padStart(2, '0')}}`
      },
      rich: {
        dateStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: '#1890ff',
          backgroundColor: '#e6f7ff',
          padding: [4, 8, 4, 8],
          borderRadius: 4,
          lineHeight: 22,
        },
        hourStyle: {
          fontSize: 12,
          color: '#666',
          lineHeight: 18,
        },
        minuteStyle: {
          fontSize: 9,
          color: '#999',
          lineHeight: 18,
        },
      },
      showMinLabel: true,
      showMaxLabel: true,
      hideOverlap: false,
    },
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
    minInterval: 1,
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
      height: 50,
      bottom: 16,
    },
  ],
  toolbox: {
    feature: {
      dataZoom: {
        yAxisIndex: 'none',
      },
      restore: {},
      saveAsImage: {},
    },
    right: 10,
    top: 10,
  },
  series: [
    {
      name: '告警量',
      type: 'line',
      smooth: true,
      sampling: 'lttb',
      symbol: 'none',
      lineStyle: {
        width: 2,
        color: '#ff7a45',
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(255, 122, 69, 0.35)' },
            { offset: 1, color: 'rgba(255, 122, 69, 0.05)' },
          ],
        },
      },
      data: [],
    },
  ],
})

function getIntervalMs() {
  return selectedAggregation.value * 60 * 1000
}

function getDefaultStartTime() {
  const now = Date.now()
  const sevenDaysMs = 70 * 24 * 60 * 60 * 1000
  return now - sevenDaysMs
}

function resetVisibleInfo() {
  visibleStartTime.value = ''
  visibleEndTime.value = ''
  visibleDuration.value = ''
}

function updateSeriesSymbol(showSymbol) {
  if (!chartRef.value?.chart) return
  chartRef.value.chart.setOption({
    series: [{
      symbol: showSymbol ? 'circle' : 'none',
      symbolSize: showSymbol ? 4 : 0,
    }],
  })
}

function updateVisibleRange() {
  if (!chartRef.value?.chart || allData.value.length === 0) {
    resetVisibleInfo()
    return
  }

  const option = chartRef.value.chart.getOption()
  const dataZoom = option.dataZoom?.[0]
  if (!dataZoom) return

  const { start = 0, end = 100 } = dataZoom
  const totalDataPoints = allData.value.length
  const startIndex = Math.min(
    totalDataPoints - 1,
    Math.max(0, Math.floor((start / 100) * totalDataPoints)),
  )
  const endIndex = Math.min(
    totalDataPoints - 1,
    Math.max(0, Math.floor((end / 100) * totalDataPoints) - 1),
  )

  const intervalMs = getIntervalMs()

  const startItem = allData.value[startIndex]
  const endItem = allData.value[Math.max(startIndex, endIndex)]

  if (!startItem || !endItem) {
    resetVisibleInfo()
    return
  }

  visibleStartTime.value = dayjs(startItem[0]).format('YYYY-MM-DD HH:mm:ss')
  visibleEndTime.value = dayjs(endItem[0] + intervalMs).format('YYYY-MM-DD HH:mm:ss')

  const visibleSpan = endItem[0] - startItem[0] + intervalMs
  const visibleHours = visibleSpan / (60 * 60 * 1000)
  const visibleDays = visibleSpan / (24 * 60 * 60 * 1000)

  if (visibleDays >= 1) {
    const days = Math.floor(visibleDays)
    const hours = Math.floor((visibleSpan % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    visibleDuration.value = hours > 0 ? `${days}天${hours}小时` : `${days}天`
  } else if (visibleHours >= 1) {
    const hours = Math.floor(visibleHours)
    const minutes = Math.floor((visibleSpan % (60 * 60 * 1000)) / (60 * 1000))
    visibleDuration.value = minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
  } else {
    const minutes = Math.max(1, Math.round(visibleSpan / (60 * 1000)))
    visibleDuration.value = `${minutes}分钟`
  }

  const showSymbol = visibleHours < 8
  updateSeriesSymbol(showSymbol)
}

function handleDataZoom() {
  nextTick(() => {
    setTimeout(() => {
      updateVisibleRange()
    }, 120)
  })
}

function handleRestore() {
  setTimeout(() => {
    updateVisibleRange()
  }, 200)
}

function updateChartData(data) {
  chartOption.value = {
    ...chartOption.value,
    series: [
      {
        ...chartOption.value.series[0],
        data,
      },
    ],
  }
}

async function requestAlertData(granularityMinutes) {
  const startTime = getDefaultStartTime()
  const endTime = Date.now()
  const params = new URLSearchParams({
    startTime: String(startTime),
    endTime: String(endTime),
    offset: '0',
    granularity: String(granularityMinutes),
  })

  const response = await fetch(`/api/get-alert-data?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`)
  }
  const result = await response.json()
  if (result.code !== 0) {
    const errorMsg = result.message || '接口返回错误'
    throw new Error(errorMsg)
  }
  return Array.isArray(result.data) ? result.data : []
}

async function loadData(granularityMinutes) {
  loading.value = true
  resetVisibleInfo()
  try {
    const data = await requestAlertData(granularityMinutes)
    allData.value = data
    updateChartData(data)
    await nextTick()
    setTimeout(() => {
      updateVisibleRange()
    }, 200)
  } catch (error) {
    console.error('获取告警数据失败:', error)
    message.error(error.message || '获取告警数据失败，请稍后再试')
    allData.value = []
    updateChartData([])
  } finally {
    loading.value = false
  }
}

async function handleAggregationChange(value) {
  selectedAggregation.value = value
  allData.value = []
  updateChartData([])
  await nextTick()
  loadData(value)
}

onMounted(async () => {
  await loadData(selectedAggregation.value)
  await nextTick()

  setTimeout(() => {
    if (!chartRef.value?.chart) return
    chartRef.value.chart.on('datazoom', handleDataZoom)
    chartRef.value.chart.on('restore', handleRestore)
  }, 300)

  if (chartRef.value?.$el) {
    resizeObserver = new ResizeObserver(() => {
      if (chartRef.value?.chart) {
        chartRef.value.chart.resize()
      }
    })
    resizeObserver.observe(chartRef.value.$el)
  }
})

onBeforeUnmount(() => {
  if (chartRef.value?.chart) {
    chartRef.value.chart.off('datazoom', handleDataZoom)
    chartRef.value.chart.off('restore', handleRestore)
  }

  if (resizeObserver && chartRef.value?.$el) {
    resizeObserver.unobserve(chartRef.value.$el)
  }
  resizeObserver = null
})
</script>

<template>
  <div class="page-container">
    <a-card title="告警趋势分析（可选聚合粒度）" :bordered="false">
      <template #extra>
        <a-space align="center" size="middle">
          <span>聚合粒度：</span>
          <a-select
            style="width: 180px"
            :options="aggregationOptions"
            v-model:value="selectedAggregation"
            @change="handleAggregationChange"
          />
        </a-space>
      </template>

      <div class="visible-range-info">
        <a-space size="large">
          <div class="time-label">
            <span class="label-title">可视区域开始：</span>
            <a-tag color="blue" style="font-size: 14px;">{{ visibleStartTime }}</a-tag>
          </div>
          <div class="time-label">
            <span class="label-title">可视区域结束：</span>
            <a-tag color="green" style="font-size: 14px;">{{ visibleEndTime }}</a-tag>
          </div>
          <div class="time-label">
            <span class="label-title">区间长度：</span>
            <a-tag color="orange" style="font-size: 14px;">{{ visibleDuration }}</a-tag>
          </div>
        </a-space>
      </div>

      <a-divider style="margin: 16px 0;" />

      <a-spin :spinning="loading" tip="数据加载中...">
        <div class="chart-wrapper">
          <v-chart
            ref="chartRef"
            class="chart"
            :option="chartOption"
            autoresize
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
  background-color: #f0f2f5;
  box-sizing: border-box;
}

.chart-wrapper {
  width: 100%;
  background-color: #fff;
  border-radius: 4px;
}

.chart {
  width: 100%;
  height: 500px;
}

.visible-range-info {
  padding: 12px 16px;
  background-color: #f5f5f5;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
}

.time-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label-title {
  font-weight: 500;
  color: #595959;
}

@media (max-width: 768px) {
  .page-container {
    padding: 12px;
  }

  .chart {
    height: 360px;
  }

  .visible-range-info {
    padding: 8px 12px;
  }

  .time-label {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

