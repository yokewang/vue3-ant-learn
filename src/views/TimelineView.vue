<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';

const chartContainer = ref(null);
let myChart = null;

const jsonContent = ref('');
const availableFiles = ref([]);
const selectedFile = ref('');

// Constants for time parsing
const BASE_TIME_STR = '2026-01-01 00:00:00';
const BASE_TIME = new Date(BASE_TIME_STR).getTime();
const ABSOLUTE_THRESHOLD = 946684800000; 

const formatTime = (value) => {
    const date = new Date(value);
    const dateStr = date.getFullYear() + '-' + 
                    (date.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                    date.getDate().toString().padStart(2, '0');
    const timeStr = date.getHours().toString().padStart(2, '0') + ':' +
           date.getMinutes().toString().padStart(2, '0') + ':' +
           date.getSeconds().toString().padStart(2, '0') + '.' +
           date.getMilliseconds().toString().padStart(3, '0');
    return `${dateStr} ${timeStr}`;
};

const axisLabelFormatter = (value) => {
    const date = new Date(value);
    const dateStr = (date.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                    date.getDate().toString().padStart(2, '0');
    const timeStr = date.getHours().toString().padStart(2, '0') + ':' +
           date.getMinutes().toString().padStart(2, '0') + ':' +
           date.getSeconds().toString().padStart(2, '0') + '.' +
           date.getMilliseconds().toString().padStart(3, '0');
    
    // Check if it's 00:00:00 (start of day) or just show date on new line for all?
    // User wants date info. 
    // Let's use two lines: Time (Bold/Dark), Date (Small/Grey)
    return `{time|${timeStr}}\n{date|${dateStr}}`;
}

const processedData = ref([]);
const maxLevel = ref(0);

const fetchList = async () => {
    try {
        const res = await fetch('/api/timeline/list');
        const json = await res.json();
        if (json.code === 0) {
            availableFiles.value = json.data;
            if (availableFiles.value.length > 0) {
                selectedFile.value = availableFiles.value[0];
                await fetchDetail(selectedFile.value);
            }
        }
    } catch (e) {
        console.error("Failed to fetch timeline list:", e);
    }
};

const fetchDetail = async (filename) => {
    try {
        const res = await fetch(`/api/timeline/detail?filename=${filename}`);
        const json = await res.json();
        if (json.code === 0) {
            jsonContent.value = JSON.stringify(json.data, null, 2);
            updateChart();
        } else {
            alert("Failed to load file: " + json.message);
        }
    } catch (e) {
        console.error("Failed to fetch timeline detail:", e);
    }
};

const onFileChange = () => {
    if (selectedFile.value) {
        fetchDetail(selectedFile.value);
    }
};

const parseData = () => {
    try {
        const raw = JSON.parse(jsonContent.value);
        if (!Array.isArray(raw)) throw new Error("Data must be an array");
        
        let localMaxLevel = 0;
        processedData.value = raw.map(item => {
            if (item.level > localMaxLevel) localMaxLevel = item.level;
            
            // Hybrid Time Parsing
            let startTs = item.start_ms;
            let endTs = item.end_ms;
            
            if (startTs < ABSOLUTE_THRESHOLD) {
                startTs += BASE_TIME;
            }
            if (endTs < ABSOLUTE_THRESHOLD) {
                endTs += BASE_TIME;
            }
            
            return {
                value: [
                    item.level,
                    startTs,
                    endTs,
                    item.latency_ms
                ],
                itemStyle: {
                    color: item.servicename.includes('Cloud') ? '#e67e22' : '#4b5cc4'
                },
                name: item.servicename,
                spanId: item.span_id
            };
        });
        maxLevel.value = localMaxLevel;
        return true;
    } catch (e) {
        alert("Invalid JSON: " + e.message);
        return false;
    }
};

function renderItem(params, api) {
  const categoryIndex = api.value(0);
  const start = api.coord([api.value(1), categoryIndex]);
  const end = api.coord([api.value(2), categoryIndex]);
  const height = 4; 

  const rectShape = echarts.graphic.clipRectByRect({
    x: start[0],
    y: start[1] - height / 2, 
    width: end[0] - start[0],
    height: height
  }, {
    x: params.coordSys.x,
    y: params.coordSys.y,
    width: params.coordSys.width,
    height: params.coordSys.height
  });

  return rectShape && {
    type: 'rect',
    transition: ['shape'],
    shape: {
      x: rectShape.x,
      y: rectShape.y,
      width: rectShape.width,
      height: rectShape.height,
      r: 1
    },
    style: api.style()
  };
}

const updateChart = () => {
    if (!parseData()) return;
    if (!chartContainer.value) return;
    
    if (myChart) myChart.dispose();
    myChart = echarts.init(chartContainer.value);
    
    const levels = maxLevel.value + 1;
    const categories = Array.from({length: levels}, (_, i) => `Level ${i}`);
    
    const option = {
        title: {
            text: 'Trace Visualization',
            left: 'center',
            top: 5
        },
        toolbox: {
            feature: {
                dataZoom: {
                    yAxisIndex: 'none'
                },
                restore: {},
                saveAsImage: {}
            },
            right: 20,
            top: 5
        },
        tooltip: {
            trigger: 'item',
            formatter: function (params) {
                const startDate = new Date(params.value[1]);
                const endDate = new Date(params.value[2]);
                const duration = params.value[3];
                const raw = params.data;
                return `<div style="text-align:left;">
                            <b>${raw.name}</b> (Span: ${raw.spanId})<br/>
                            Start: ${formatTime(startDate)}<br/>
                            End:   ${formatTime(endDate)}<br/>
                            Duration: ${duration} ms
                        </div>`;
            }
        },
        grid: {
            top: 60,
            bottom: 60, // Ensure space for bottom axis
            left: 20,
            right: 20,
            containLabel: true
        },
        xAxis: [
            {
                type: 'time',
                position: 'top',
                splitLine: { 
                    show: true, 
                    lineStyle: { type: 'dashed', color: '#eee' } 
                },
                axisLabel: {
                    formatter: axisLabelFormatter,
                    rich: {
                        time: {
                            fontSize: 12,
                            color: '#333'
                        },
                        date: {
                            fontSize: 10,
                            color: '#999',
                            padding: [2, 0, 0, 0]
                        }
                    },
                    hideOverlap: true 
                },
                axisTick: { show: true },
                axisLine: { show: true }
            },
            {
                type: 'time',
                position: 'bottom',
                splitLine: { show: false },
                axisLabel: {
                    formatter: axisLabelFormatter,
                    rich: {
                        time: {
                            fontSize: 12,
                            color: '#333'
                        },
                        date: {
                            fontSize: 10,
                            color: '#999',
                            padding: [2, 0, 0, 0]
                        }
                    },
                    hideOverlap: true,
                    show: true 
                },
                axisTick: { show: true },
                axisLine: { show: true }
            }
        ],
        yAxis: {
            type: 'category',
            data: categories,
            inverse: true,
            splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.3 } },
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
                formatter: (val) => val
            }
        },
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: [0, 1],
                filterMode: 'weakFilter'
            }
        ],
        series: [
            {
                type: 'custom',
                renderItem: renderItem,
                itemStyle: {
                    opacity: 0.9
                },
                encode: {
                    x: [1, 2],
                    y: 0,
                    tooltip: [1, 2]
                },
                data: processedData.value
            },
            {
                // Dummy series to force bottom axis to have the same range
                type: 'custom',
                xAxisIndex: 1, 
                renderItem: () => {}, // Render nothing
                data: processedData.value,
                encode: {
                    x: [1, 2],
                    y: 0
                }
            }
        ]
    };
    
    myChart.setOption(option);
};

const onUpdateClick = () => {
    updateChart();
};

onMounted(() => {
    fetchList();
    window.addEventListener('resize', () => myChart && myChart.resize());
});

onUnmounted(() => {
    window.removeEventListener('resize', () => myChart && myChart.resize());
    if (myChart) myChart.dispose();
});

</script>

<template>
  <div class="page-container">
    <div class="editor-pane">
        <div class="pane-header">
            <span>Data Editor</span>
            <div class="controls">
                 <!-- Use Ant Design Components -->
                 <a-select v-model:value="selectedFile" style="width: 200px" @change="onFileChange">
                    <a-select-option v-for="file in availableFiles" :key="file" :value="file">{{ file }}</a-select-option>
                 </a-select>
                 <a-button type="primary" @click="onUpdateClick">Update</a-button>
            </div>
        </div>
        <textarea v-model="jsonContent" class="json-editor"></textarea>
    </div>
    
    <div class="chart-pane">
        <div ref="chartContainer" class="chart"></div>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: #f5f5f5;
}

.editor-pane {
  width: 33.33%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #ddd;
  background-color: #fff;
  padding: 10px;
}

.pane-header {
    font-weight: bold;
    margin-bottom: 10px;
    color: #333;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.controls {
    display: flex;
    gap: 8px;
    align-items: center;
}

.json-editor {
    flex: 1;
    width: 100%;
    font-family: monospace;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    resize: none;
    background: #fafafa;
    color: #333;
    font-size: 12px;
}

.json-editor:focus {
    outline: none;
    border-color: #1890ff;
    background: #fff;
}

.chart-pane {
  flex: 1; 
  padding: 20px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
}

.chart {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 200px;
}
</style>
