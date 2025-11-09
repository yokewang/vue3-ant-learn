<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  ToolboxComponent,
  TitleComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import dayjs from 'dayjs'

// 按需引入 ECharts 模块
use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  ToolboxComponent,
  TitleComponent,
])

const chartRef = ref(null)
const visibleStartTime = ref('')
const visibleEndTime = ref('')
const visibleDuration = ref('') // 可视区域时长
const allData = ref([])


// 生成模拟数据：sine 曲线 + 噪音
function generateMockData() {
  const data = []
  const now = new Date()
  
  // 获取本地时区的今天0点
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayTimestamp = today.getTime()
  
  // 7天前（6天前，因为包含今天）
  const sevenDaysAgo = todayTimestamp - 6 * 24 * 60 * 60 * 1000
  
  const oneMinute = 60 * 1000
  
  // 7天 = 10,080 分钟
  for (let i = 0; i < 1440 * 7; i++) {
    const timestamp = sevenDaysAgo + i * oneMinute
    
    // sine 曲线（周期约为1天）+ 噪音
    const dayProgress = (i % 1440) / 1440 // 1440分钟 = 1天
    const sineValue = Math.sin(dayProgress * 2 * Math.PI) * 50 + 100
    const noise = (Math.random() - 0.5) * 20
    const value = Math.max(0, sineValue + noise)
    
    data.push([timestamp, Math.round(value)])
  }
  
  return data
}

// 当前刻度间隔模式（小时）
const currentIntervalHours = ref(4)
// 当前是否显示圆点
const currentShowSymbol = ref(false)

// 更新可视区域时间范围并动态调整刻度
function updateVisibleRange() {
  if (!chartRef.value?.chart || allData.value.length === 0) return
  
  const option = chartRef.value.chart.getOption()
  const dataZoom = option.dataZoom?.[0]
  
  if (!dataZoom) return
  
  const start = dataZoom.start || 0
  const end = dataZoom.end || 100
  
  const totalDataPoints = allData.value.length
  const startIndex = Math.floor((start / 100) * totalDataPoints)
  const endIndex = Math.floor((end / 100) * totalDataPoints) - 1
  
  if (allData.value[startIndex]) {
    visibleStartTime.value = dayjs(allData.value[startIndex][0]).format('YYYY-MM-DD HH:mm:ss')
  }
  
  if (allData.value[endIndex]) {
    visibleEndTime.value = dayjs(allData.value[endIndex][0] + 60 * 1000).format('YYYY-MM-DD HH:mm:ss')
  } 
  
  // 计算可视区域的时间跨度
  if (allData.value[startIndex] && allData.value[endIndex]) {
    const visibleTimeSpan = allData.value[endIndex][0] - allData.value[startIndex][0] + 60 * 1000
    const visibleDays = visibleTimeSpan / (24 * 60 * 60 * 1000)
    const visibleHours = visibleTimeSpan / (60 * 60 * 1000)
    
    // 格式化时长显示（精确到小时）
    if (visibleDays >= 1) {
      const days = Math.floor(visibleDays)
      const hours = Math.round((visibleDays - days) * 24)
      if (hours > 0) {
        visibleDuration.value = `${days}天${hours}小时`
      } else {
        visibleDuration.value = `${days}天`
      }
    } else {
      visibleDuration.value = `${Math.round(visibleHours)}小时`
    }
       
    // 根据可视区域大小动态调整是否显示圆点（小于12小时显示圆点）
    const shouldShowSymbol = visibleHours < 12
    if (currentShowSymbol.value !== shouldShowSymbol) {
      currentShowSymbol.value = shouldShowSymbol
      updateSeriesSymbol(shouldShowSymbol)
    }
  }
}

// 更新 series 的 symbol 配置
function updateSeriesSymbol(showSymbol) {
  if (!chartRef.value?.chart) return
  
  chartRef.value.chart.setOption({
    series: [{
      symbol: showSymbol ? 'circle' : 'none',
      symbolSize: showSymbol ? 4 : 0,
    }],
  })
}

// 处理 dataZoom 事件
function handleDataZoom() {
  // 使用 nextTick 和延迟确保图表更新完成后再更新信息
  // 复位操作时图表状态更新需要时间，所以延迟稍长一些
  nextTick(() => {
    setTimeout(() => {
      updateVisibleRange()
    }, 200)
  })
}

// 处理 restore 事件（复位按钮）
function handleRestore() {
  // 复位后延迟更新信息，确保图表完全恢复
  // 复位操作需要更多时间来完成状态更新
  setTimeout(() => {
    updateVisibleRange()
  }, 300)
}

// ECharts 配置
const chartOption = ref({
  title: {
    text: '最近7天时间序列数据',
    subtext: '共 10,080 个数据点（每分钟一个）',
    left: 'center',
  },
  tooltip: {
    trigger: 'axis',
    formatter: function(params) {
      try {
        if (!params || !params[0]) return ''
        const param = params[0]
        if (!param.value || !Array.isArray(param.value)) return ''
        const date = new Date(param.value[0])
        if (isNaN(date.getTime())) return ''
        return `${date.toLocaleString()}<br/>数值: <b>${param.value[1]}</b>`
      } catch (e) {
        return ''
      }
    },
  },
  grid: {
    left: '60px',
    right: '40px',
    bottom: '110px',
    top: '80px',
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
    name: '数值',
  },
  // DataZoom 组件：支持滚轮缩放和拖拽平移
  dataZoom: [
    {
      type: 'inside', // 鼠标滚轮缩放、拖拽平移
      start: 0,
      end: 100,
    },
    {
      type: 'slider', // Zoom Slider
      start: 0,
      end: 100,
      height: 50,
      bottom: 10,
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
    right: 20,
    top: 10,
  },
  series: [
    {
      name: '数值',
      type: 'line',
      smooth: true,
      symbol: 'none',
      sampling: 'lttb',
      lineStyle: {
        width: 2,
        color: '#1890ff',
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
          ],
        },
      },
      data: [],
    },
  ],
})

// 初始化数据
onMounted(async () => {
  try {
    const mockData = generateMockData()
    allData.value = mockData
    
    // 使用更安全的方式更新图表数据
    chartOption.value = {
      ...chartOption.value,
      series: [{
        ...chartOption.value.series[0],
        data: mockData,
      }],
    }
    
    // 初始化可视区域时间
    if (mockData.length > 0) {
      visibleStartTime.value = dayjs(mockData[0][0]).format('YYYY-MM-DD HH:mm:ss')
      visibleEndTime.value = dayjs(mockData[mockData.length - 1][0] + 60 * 1000).format('YYYY-MM-DD HH:mm:ss')
      
      // 初始化时长（7天）
      const timeSpan = mockData[mockData.length - 1][0] - mockData[0][0] + 60 * 1000
      const days = Math.floor(timeSpan / (24 * 60 * 60 * 1000))
      const hours = Math.round((timeSpan % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
      if (hours > 0) {
        visibleDuration.value = `${days}天${hours}小时`
      } else {
        visibleDuration.value = `${days}天`
      }
    }
    
    // 等待 DOM 更新后绑定事件
    await nextTick()
    
    setTimeout(() => {
      if (chartRef.value?.chart) {
        chartRef.value.chart.on('datazoom', handleDataZoom)
        // 监听 restore 事件（复位按钮）
        chartRef.value.chart.on('restore', handleRestore)
        // 初始化时计算一次可视区域，设置正确的间隔
        updateVisibleRange()
      }
    }, 500)
  } catch (error) {
    console.error('初始化数据失败:', error)
  }
})
</script>

<template>
  <div class="page-container">
    <a-card title="时间序列图表" :bordered="false">
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
      
      <div class="chart-wrapper">
        <v-chart
          ref="chartRef"
          class="chart"
          :option="chartOption"
          autoresize
        />
      </div>
      
      <a-divider />
      
      <!-- 特性说明 -->
      <div class="features-info">
        <a-card title="图表特性说明" size="small" :bordered="true">
          <a-descriptions :column="1" size="small" bordered>
            <a-descriptions-item label="数据范围">
              显示最近7天的时间序列数据，共 10,080 个数据点（每分钟一个数据点）
            </a-descriptions-item>
            <a-descriptions-item label="交互功能">
              支持鼠标滚轮缩放、拖拽平移、底部 Zoom Slider 滑块调整可视范围
            </a-descriptions-item>
            <a-descriptions-item label="动态刻度间隔">
              刻度间隔会根据可视区域范围自动调整，确保时间标签清晰可读
            </a-descriptions-item>
            <a-descriptions-item label="圆点显示规则">
              <ul style="margin: 0; padding-left: 20px;">
                <li>区间长度 < 12小时：曲线上显示圆点，便于查看单个数据点</li>
                <li>区间长度 ≥ 12小时：曲线不显示圆点，显示平滑曲线，界面更简洁</li>
              </ul>
            </a-descriptions-item>
            <a-descriptions-item label="时间标签">
              <ul style="margin: 0; padding-left: 20px;">
                <li>0点（每天的开始）显示日期标签，格式：月/日（如 11/03），蓝色背景粗体显示</li>
                <li>其他整点（根据刻度间隔：1小时/2小时/4小时）显示小时标签，格式：小时（如 2、4、8），灰色文字</li>
                <li>刻度间隔根据可视区域范围自动选择（1小时/2小时/4小时），确保标签清晰不重叠</li>
              </ul>
            </a-descriptions-item>
            <a-descriptions-item label="可视区域信息">
              实时显示当前可视区域的开始时间、结束时间和区间长度，精确到小时
            </a-descriptions-item>
          </a-descriptions>
        </a-card>
      </div>
      
      <a-divider style="margin: 16px 0;" />
      
      <a-descriptions title="操作说明" :column="2" size="small" bordered>
        <a-descriptions-item label="鼠标滚轮">
          缩放时间轴
        </a-descriptions-item>
        <a-descriptions-item label="拖拽平移">
          按住鼠标左键拖动
        </a-descriptions-item>
        <a-descriptions-item label="Zoom Slider">
          使用底部滑块选择范围
        </a-descriptions-item>
        <a-descriptions-item label="工具栏">
          区域缩放、恢复、保存图片
        </a-descriptions-item>
      </a-descriptions>
    </a-card>
  </div>
</template>

<style scoped>
.page-container {
  padding: 24px;
  min-height: 100vh;
  background-color: #f0f2f5;
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

.features-info {
  margin: 16px 0;
}

.features-info :deep(.ant-card-body) {
  padding: 16px;
}

.features-info :deep(.ant-descriptions-item-label) {
  font-weight: 500;
  width: 140px;
}

@media (max-width: 768px) {
  .page-container {
    padding: 12px;
  }
  
  .chart {
    height: 350px;
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
