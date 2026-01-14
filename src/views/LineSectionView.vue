<script setup>
import { ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, ToolboxComponent, TitleComponent, MarkAreaComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  ToolboxComponent,
  TitleComponent,
  MarkAreaComponent,
])

const chartOption = ref({
  title: {
    text: 'Distribution of Electricity',
    subtext: 'Fake Data',
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'cross',
    },
  },
  toolbox: {
    show: true,
    feature: {
      saveAsImage: {},
    },
  },
  grid: {
    left: '60px',
    right: '40px',
    top: '80px',
    bottom: '60px',
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: [
      '00:00',
      '01:15',
      '02:30',
      '03:45',
      '05:00',
      '06:15',
      '07:30',
      '08:45',
      '10:00',
      '11:15',
      '12:30',
      '13:45',
      '15:00',
      '16:15',
      '17:30',
      '18:45',
      '20:00',
      '21:15',
      '22:30',
      '23:45',
    ],
  },
  yAxis: {
    type: 'value',
    axisLabel: {
      formatter: '{value} W',
    },
    axisPointer: {
      snap: true,
    },
  },
  series: [
    {
      name: 'Electricity',
      type: 'line',
      smooth: true,
      data: [
        300, 280, 250, 260, 270, 300, 550, 500, 400, 390, 380, 390, 400, 500,
        600, 750, 800, 700, 600, 400,
      ],
      markArea: {
        silent: true,
        itemStyle: {
          color: 'rgba(255, 173, 177, 0.4)',
        },
        data: [
          [
            {
              name: 'Morning Peak',
              xAxis: '07:30',
            },
            {
              xAxis: '10:00',
            },
          ],
          [
            {
              name: 'Evening Peak',
              xAxis: '17:30',
            },
            {
              xAxis: '21:15',
            },
          ],
        ],
      },
    },
  ],
})
</script>

<template>
  <div class="page-container">
    <a-card title="Line Sections" :bordered="false">
      <div class="chart-wrapper">
        <v-chart class="chart" :option="chartOption" autoresize />
      </div>
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
</style>
