import fs from 'node:fs'
import path from 'node:path'

export default [
  {
    url: '/api/chain/list',
    method: 'get',
    response: () => {
      try {
        const dir = path.resolve(process.cwd(), 'mock/chain/json')
        if (!fs.existsSync(dir)) {
          return { code: 0, data: [] }
        }
        const files = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.json'))
          .sort()
        return {
          code: 0,
          data: files,
        }
      } catch (e) {
        console.error('Failed to list chain files:', e)
        return { code: 1, message: e.message, data: [] }
      }
    },
  },
  {
    url: '/api/chain/detail',
    method: 'get',
    response: ({ query }) => {
      try {
        const filename = query.filename
        if (!filename) {
          return { code: 1, message: 'Filename required' }
        }
        if (filename.includes('..') || filename.includes('/')) {
          return { code: 1, message: 'Invalid filename' }
        }

        const filepath = path.resolve(process.cwd(), 'mock/chain/json', filename)
        if (!fs.existsSync(filepath)) {
          return { code: 1, message: 'File not found' }
        }

        const content = fs.readFileSync(filepath, 'utf-8')
        return {
          code: 0,
          data: JSON.parse(content),
        }
      } catch (e) {
        console.error('Failed to read chain file:', e)
        return { code: 1, message: e.message }
      }
    },
  },
]
