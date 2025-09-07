import fs from 'node:fs'
import path from 'node:path'

export default [
  {
    url: '/analysis/stream',
    method: 'get',
    rawResponse: async (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')

      function writeEvent(event, data) {
        res.write(`event: ${event}\n`)
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
      }

      function splitPreserveWhitespace(text) {
        if (typeof text !== 'string') return []
        // Keep both non-space chunks and whitespace (spaces/newlines/tabs) as tokens
        // so the client can concatenate tokens verbatim and preserve formatting
        return text.match(/(\s+|\S+)/g) || []
      }

      const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000)

      try {
        const filePath = path.resolve(process.cwd(), 'mock', 'data', 'analysis-store.json')
        const raw = fs.readFileSync(filePath, 'utf-8')
        const store = JSON.parse(raw || '{}')

        async function streamTextField(fieldName, text) {
          writeEvent('segment_start', { field: fieldName })
          for (const token of splitPreserveWhitespace(text || '')) {
            writeEvent('segment_data', { field: fieldName, text: token })
            await delay(20)
          }
          writeEvent('segment_end', { field: fieldName, reason: 'end_tag' })
          await delay(500)
        }

        await streamTextField('summary', store.summary)
        await streamTextField('solution', store.solution)
        await streamTextField('alert', store.alert)

        {
          const topos = Array.isArray(store.topos) ? store.topos : []
          for (let i = 0; i < topos.length; i++) {
            const topo = String(topos[i] ?? '')
            writeEvent('segment_start', { field: 'topos', index: i })
            for (const token of splitPreserveWhitespace(topo)) {
              writeEvent('segment_data', { field: 'topos', index: i, text: token })
              await delay(20)
            }
            writeEvent('segment_end', { field: 'topos', index: i, reason: 'end_tag' })
            await delay(500)
          }
          await delay(500)
        }

        await streamTextField('causeSummary', store.causeSummary)
        await streamTextField('causeDetail', store.causeDetail)

        res.end()
      } catch (err) {
        writeEvent('segment_end', { field: 'error', reason: 'read_failed' })
        res.end()
      } finally {
        clearInterval(heartbeat)
      }

      req.on('close', () => {
        clearInterval(heartbeat)
      })
    },
  },
]


