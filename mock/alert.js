import fs from 'node:fs'
import path from 'node:path'
import dayjs from 'dayjs'

// 缓存加载的原始数据
let cachedRawData = null

// 解析 CSV 文件并加载数据
function loadCSVData() {
  // 如果已经加载过，直接返回缓存
  if (cachedRawData !== null) {
    return cachedRawData
  }
  
  const filePath = path.resolve(process.cwd(), 'mock', 'alert', 'alert_15s.csv')
  
  try {
    if (!fs.existsSync(filePath)) {
      console.error('CSV file not found:', filePath)
      cachedRawData = []
      return []
    }
    
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n')
    
    if (lines.length <= 1) {
      console.warn('CSV file is empty or has no data rows')
      cachedRawData = []
      return []
    }
    
    // 跳过表头
    const data = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const [timeStr, cntStr] = line.split(',')
      if (!timeStr || !cntStr) continue
      
      // 解析时间：2025-10-20 00:00:00+08:00
      const timestamp = new Date(timeStr.trim()).getTime()
      const cnt = parseInt(cntStr.trim(), 10)
      
      if (!isNaN(timestamp) && !isNaN(cnt)) {
        data.push({ timestamp, cnt })
      }
    }
    
    // 按时间排序
    data.sort((a, b) => a.timestamp - b.timestamp)
    
    cachedRawData = data
    return data
  } catch (error) {
    console.error('Failed to load CSV data:', error)
    console.error('File path:', filePath)
    cachedRawData = []
    return []
  }
}

// 按指定分钟聚合数据，intervalMinutes 为正整数
// 聚合区间规则：每个区间包含 [起始时间, 起始时间 + interval) 的数据，左闭右开
// 桶对齐到自然时间边界（例如 10 分钟粒度则对齐 00、10、20 分钟）
function aggregateByInterval(data, intervalMinutes = 1) {
  const interval = Number.isInteger(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 1
  const intervalMs = interval * 60 * 1000
  const bucketMap = new Map()

  for (const item of data) {
    const bucketStart = Math.floor(item.timestamp / intervalMs) * intervalMs

    if (bucketMap.has(bucketStart)) {
      bucketMap.set(bucketStart, bucketMap.get(bucketStart) + item.cnt)
    } else {
      bucketMap.set(bucketStart, item.cnt)
    }
  }

  return Array.from(bucketMap.entries())
    .map(([timestamp, cnt]) => [timestamp, cnt])
    .sort((a, b) => a[0] - b[0])
}

export default [
  {
    url: '/api/get-alert-data',
    method: 'get',
    timeout: 1000,
    response: ({ query }) => {
      // 获取参数
      const startTimeStr = query?.startTime
      const endTimeStr = query?.endTime
      const offsetStr = query?.offset || '0'
      const granularityStr = query?.granularity || '1'
      
      // 验证必需参数
      if (!startTimeStr || !endTimeStr) {
        return {
          code: 1,
          data: [],
          message: 'startTime and endTime are required'
        }
      }
      
      // 解析参数
      // startTime 和 endTime 可能是时间戳（秒或毫秒）或 ISO 字符串
      let startTime, endTime
      
      // 尝试解析为时间戳（毫秒）
      if (/^\d+$/.test(startTimeStr)) {
        startTime = parseInt(startTimeStr, 10)
        // 如果时间戳小于 13 位，认为是秒，需要转换为毫秒
        if (startTimeStr.length <= 10) {
          startTime = startTime * 1000
        }
      } else {
        // 尝试解析为日期字符串
        startTime = new Date(startTimeStr).getTime()
        if (isNaN(startTime)) {
          return {
            code: 1,
            data: [],
            message: 'Invalid startTime format'
          }
        }
      }
      
      if (/^\d+$/.test(endTimeStr)) {
        endTime = parseInt(endTimeStr, 10)
        if (endTimeStr.length <= 10) {
          endTime = endTime * 1000
        }
      } else {
        endTime = new Date(endTimeStr).getTime()
        if (isNaN(endTime)) {
          return {
            code: 1,
            data: [],
            message: 'Invalid endTime format'
          }
        }
      }
      
      // 解析偏移天数
      const offsetDays = parseFloat(offsetStr)
      if (isNaN(offsetDays)) {
        return {
          code: 1,
          data: [],
          message: 'Invalid offset format'
        }
      }

      // 解析聚合粒度（分钟）
      let granularity = parseInt(granularityStr, 10)
      if (!Number.isInteger(granularity) || granularity <= 0) {
        granularity = 1
      }
      
      // 计算偏移量（毫秒）
      const offsetMs = offsetDays * 24 * 60 * 60 * 1000
      
      // 计算偏移后的时间范围（减去 offset 天，用于查询 CSV 数据）
      const queryStartTime = startTime - offsetMs
      const queryEndTime = endTime - offsetMs
      console.log('queryStartTime:', dayjs(queryStartTime).format('YYYY-MM-DD HH:mm:ss'))
      console.log('queryEndTime:', dayjs(queryEndTime).format('YYYY-MM-DD HH:mm:ss'))
      
      // 加载 CSV 数据
      const allData = loadCSVData()
      
      if (allData.length === 0) {
        return {
          code: 0,
          data: [],
          message: 'No data available'
        }
      }
      
      // 过滤出时间范围内的数据
      // 注意：这里使用 >= 和 <=，因为 CSV 数据的时间是精确的
      const filteredData = allData.filter(item => {
        return item.timestamp >= queryStartTime && item.timestamp <= queryEndTime
      })
      
      // 按指定粒度聚合
      const aggregatedData = aggregateByInterval(filteredData, granularity)
      
      // 将返回的时间戳加上 offset，使得与 startTime 一致
      const resultData = aggregatedData.map(([timestamp, count]) => {
        return [timestamp + offsetMs, count]
      })
      
      return {
        code: 0,
        data: resultData,
        message: 'success'
      }
    },
  },
]
