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
import dayjs from 'dayjs'

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
  const baseDate = new Date('2025-10-28')
  return Math.ceil((now.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000))
}

const offsetDays = ref(getDefaultOffsetDays()) // 数据偏移天数，用于调整数据的时间基准
const displayHours = ref(3) // 默认显示的小时数，控制可视区域的时间跨度
const allData = ref([]) // 所有告警数据，格式为 [[timestamp, count], ...]
const lastUpdateMinute = ref(null) // 最后一次更新的分钟时间戳，用于增量数据获取
const isUserInteracted = ref(false) // 用户是否手动操作了图表（缩放/平移），用于区分自动模式和用户交互模式
const pauseTimestamp = ref(null) // 暂停自动刷新时的时间戳，用于恢复时补齐缺失数据
const chartStartTime = ref(null) // 图表X轴的起始时间戳（毫秒），用于计算X轴范围
const viewportStartTime = ref(null) // 可视区域的开始时间戳（毫秒），用于自动模式下的可视范围管理
const viewportEndTime = ref(null) // 可视区域的结束时间戳（毫秒），用于自动模式下的可视范围管理
const visibleStartTime = ref('') // 可视区域开始时间的格式化字符串，用于顶部信息显示
const visibleEndTime = ref('') // 可视区域结束时间的格式化字符串，用于顶部信息显示
const visibleDuration = ref('') // 可视区域时长，格式化后的字符串（如"3小时"、"2小时48分钟"），用于顶部信息显示
const currentShowSymbol = ref(null) // 当前是否显示圆点

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
  
  // 获取新数据的起始时间戳（第一个数据点的时间戳）
  const newDataStartTimestamp = newDataPoints[0][0]
  
  // 从 allData 中删除时间戳 >= newDataStartTimestamp 的数据点
  // 由于 allData 是按时间戳排序的，找到第一个 >= newDataStartTimestamp 的索引
  const cutIndex = allData.value.findIndex(([timestamp]) => timestamp >= newDataStartTimestamp)
  
  // 如果找到了切分点，直接截断数组（保留前面的数据）
  if (cutIndex !== -1) {
    allData.value.length = cutIndex
  }
  
  // 直接将新数据追加到数组后面（保持数组引用不变）
  allData.value.push(...newDataPoints)
  
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
    { type: 'slider', start: clampedStart, end: clampedEnd, height: 40, bottom: 10 },
  ]
}

// 更新可视区域时间范围
function updateVisibleRangeAndInfo() {
  if (!chartRef.value?.chart) return
  
  const option = chartRef.value.chart.getOption()
  const xAxis = option.xAxis?.[0]
  const dataZoom = option.dataZoom?.[0]
  
  if (!xAxis || !dataZoom) return
  
  // 获取X轴的时间范围
  const xAxisMin = xAxis.min
  const xAxisMax = xAxis.max
  
  if (!xAxisMin || !xAxisMax) return
  
  // 获取dataZoom的start和end百分比
  const start = dataZoom.start || 0
  const end = dataZoom.end || 100
  
  // 计算可视区域的时间范围（基于X轴的时间范围）
  const totalRange = xAxisMax - xAxisMin
  const visibleStartTimestamp = xAxisMin + (totalRange * start) / 100
  const visibleEndTimestamp = xAxisMin + (totalRange * end) / 100
  //update viewportStartTime and viewportEndTime
  viewportStartTime.value = visibleStartTimestamp
  viewportEndTime.value = visibleEndTimestamp
  
  // 格式化时间显示
  visibleStartTime.value = dayjs(visibleStartTimestamp).format('YYYY-MM-DD HH:mm:ss')
  visibleEndTime.value = dayjs(visibleEndTimestamp).format('YYYY-MM-DD HH:mm:ss')
  
  // 计算可视区域的时间跨度
  const visibleTimeSpan = visibleEndTimestamp - visibleStartTimestamp
  const visibleDays = visibleTimeSpan / (24 * 60 * 60 * 1000)
  const visibleHours = visibleTimeSpan / (60 * 60 * 1000)
  const visibleMinutes = visibleTimeSpan / (60 * 1000)
  
  // 格式化时长显示（精确到分钟）
  if (visibleDays >= 1) {
    const days = Math.floor(visibleDays)
    const hours = Math.floor((visibleTimeSpan % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    if (hours > 0) {
      visibleDuration.value = `${days}天${hours}小时`
    } else {
      visibleDuration.value = `${days}天`
    }
  } else if (visibleHours >= 1) {
    const hours = Math.floor(visibleHours)
    const minutes = Math.floor((visibleTimeSpan % (60 * 60 * 1000)) / (60 * 1000))
    if (minutes > 0) {
      visibleDuration.value = `${hours}小时${minutes}分钟`
    } else {
      visibleDuration.value = `${hours}小时`
    }
  } else {
    visibleDuration.value = `${Math.round(visibleMinutes)}分钟`
  }

  // 根据可视区域大小动态调整是否显示圆点（小8小时显示圆点）
  const showSymbol = visibleHours < 8
  const targetSynmol = showSymbol ? 'circle' : 'none'
  if (chartRef.value.chart.getOption().series[0].symbol != targetSynmol){
    chartRef.value.chart.setOption({
      series: [{
        symbol: targetSynmol,
        symbolSize: showSymbol ? 4 : 0,
      }],
    })
  }
}

// 更新图表数据
function updateChartData() {
  console.log(allData.value.length)
  console.log('isUserInteracted:',isUserInteracted.value)
  const seriesConfig = {
    ...chartOption.value.series[0],
    data: allData.value,
  }
  
  if (!isUserInteracted.value && chartStartTime.value !== null) {
    console.log('自动模式下，更新可视区间')
    //自动模式下，更新图表数据
    //计算并更新可视范围（完整的N小时，从整点开始到整点结束）
    updateViewportRange()
  }
  
  //更新图表数据
  const timeRange = getXAxisTimeRange()
  console.log(timeRange.min, timeRange.max)
  // console.log(dayjs(timeRange.min).format('YYYY-MM-DD HH:mm:ss'))
  // console.log(dayjs(timeRange.max).format('YYYY-MM-DD HH:mm:ss'))
  // console.log(dayjs(viewportStartTime.value).format('YYYY-MM-DD HH:mm:ss'))
  // console.log(dayjs(viewportEndTime.value).format('YYYY-MM-DD HH:mm:ss'))
  
  const startPercent = ((viewportStartTime.value - timeRange.min) / (timeRange.max - timeRange.min)) * 100
  const endPercent = ((viewportEndTime.value - timeRange.min) / (timeRange.max - timeRange.min)) * 100
  
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
  
  // 更新可视区域信息
  nextTick(() => {
    setTimeout(() => {
      updateVisibleRangeAndInfo()
    }, 100)
  })
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
    console.log('更新最近一分钟的数据')
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
function resetToFullRange() {
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
  
  chartOption.value = {
    ...chartOption.value,
    dataZoom: createDataZoomConfig(startPercent, endPercent),
  }
  
  isUserInteracted.value = false
  showReset.value = false
  
  // 更新可视区域信息
  nextTick(() => {
    setTimeout(() => {
      updateVisibleRangeAndInfo()
    }, 300)
  })
}

// 处理用户操作图表
function handleDataZoom(params) {
  isUserInteracted.value = true
  showReset.value = true
  
  // 使用 nextTick 和延迟确保图表更新完成后再更新信息
  nextTick(() => {
    setTimeout(() => {
      // 更新可视区域信息
      updateVisibleRangeAndInfo()
    }, 200)
  })
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
    
    // 等待 DOM 更新后绑定事件（参考 TimeSeriesChartView.vue 的实现方式）
    await nextTick()
    
    setTimeout(() => {
      if (chartRef.value?.chart) {
        // 确保事件监听已绑定
        chartRef.value.chart.on('datazoom', handleDataZoom)
        
        // 监听 restore 事件（复位按钮）
        chartRef.value.chart.on('restore', handleRestore)
        
        // 初始化时计算一次可视区域
        updateVisibleRangeAndInfo()
      }
    }, 500)
  } catch (error) {
    console.error('数据初始化失败:', error)
    message.error('数据初始化失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

let pollTimer = null

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
    splitNumber: 24,
    axisTick: {
      show: true,
      length: 6,
      lineStyle: {
        color: '#666',
        width: 1,
      },
    },
    // 主刻度网格线
    splitLine: {
      show: true,
      lineStyle: {
        color: '#e5e5e5',
        width: 1,
        type: 'solid',
      },
    },
    axisLabel: {
      formatter: function(value) {
        try {
          const date = new Date(value)
          if (isNaN(date.getTime())) return ''
          
          const hour = date.getHours()
          const minutes = date.getMinutes()
          
          // 0点显示日期（使用 rich 样式）
          if (hour === 0 && minutes === 0) {
            return `{dateStyle|${dayjs(date).format('MM/DD')}}`
          }
          
          // 整点显示小时（ECharts 已按间隔筛选）
          if (minutes === 0) {
            return `{hourStyle|${String(hour).padStart(2, '0')}}`
          }
          
          // 非整点显示分钟信息（浅色）
          return `{minuteStyle|${String(minutes).padStart(2, '0')}}`
        } catch (e) {
          return ''
        }
      },
      // 使用富文本样式区分日期和小时
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
          fontWeight: 'normal',
          color: '#666',
          lineHeight: 18,
        },
        minuteStyle: {
          fontSize: 9,
          fontWeight: 'normal',
          color: '#999',
          lineHeight: 18,
        },
      },
      showMinLabel: true,
      showMaxLabel: true,
      hideOverlap: false,
    },
    // 坐标轴线
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
      height: 40,
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
    right: 0,
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

// 处理 restore 事件（图表工具栏的复位按钮）
function handleRestore() {
  // 与页面上的"复位按钮"行为保持一致，调用相同的复位函数
  resetToFullRange(true)
}

onMounted(async () => {
  await initData()
  
  if (autoRefresh.value) {
    startPolling()
  }
})

onBeforeUnmount(() => {
  stopPolling()
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
            checked-children="自动刷新（15s）"
            un-checked-children="手动"
            @change="handleAutoRefreshChange"
          />
          <a-button
            size="small"
            type="primary"
            :disabled="!showReset"
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
      <!-- 可视区域时间范围 -->
      <div class="visible-range-info">
        <a-space size="large">
          <div class="time-label">
            <span class="label-title">可视区域开始时间：</span>
            <a-tag color="blue" style="font-size: 14px;">{{ visibleStartTime }}</a-tag>
          </div>
          <div class="time-label">
            <span class="label-title">可视区域结束时间：</span>
            <a-tag color="green" style="font-size: 14px;">{{ visibleEndTime }}</a-tag>
          </div>
          <div class="time-label">
            <span class="label-title">区间长度：</span>
            <a-tag color="orange" style="font-size: 14px;">{{ visibleDuration }}</a-tag>
          </div>
        </a-space>
      </div>
      
      <a-divider style="margin: 16px 0;" />
      
      <a-spin :spinning="loading" tip="加载中...">
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

/* 响应式设计 */
@media (max-width: 768px) {
  .page-container {
    padding: 12px;
  }

  .chart {
    height: 300px;
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
