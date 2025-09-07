export default [
  {
    url: '/api/hello',
    method: 'get',
    timeout: 100,
    response: ({ query }) => {
      const name = query?.name ?? 'world'
      return { code: 0, data: `hello ${name}` }
    },
  },

  {
    url: '/api/hello',
    method: 'post',
    timeout: 150,
    response: ({ body }) => {
      const name = body?.name ?? 'world'
      return { code: 0, data: `hello ${name}` }
    },
  },

  {
    url: '/api/hello/stream',
    method: 'get',
    rawResponse: async (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')

      let id = 0
      const send = (event, data) => {
        if (event) res.write(`event: ${event}\n`)
        if (id) res.write(`id: ${id}\n`)
        res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`)
      }

      const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000)

      const text = 'Hello Event Stream!'
      const letters = text.split('')
      const timer = setInterval(() => {
        id += 1
        const ch = letters.shift()
        if (ch) {
          send('message', { delta: ch, index: id })
        } else {
          clearInterval(timer)
          send('end', '[DONE]')
          clearInterval(heartbeat)
          res.end()
        }
      }, 50)

      req.on('close', () => {
        clearInterval(timer)
        clearInterval(heartbeat)
      })
    },
  },
]

