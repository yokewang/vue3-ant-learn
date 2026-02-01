import fs from 'node:fs'
import path from 'node:path'

export default [
  {
    url: '/api/chain/mermaid/list',
    method: 'get',
    response: () => {
      try {
        const dir = path.resolve(process.cwd(), 'mock/chain/mermaid')
        if (!fs.existsSync(dir)) {
          return { code: 0, data: [] }
        }
        const files = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.mermaid') || f.endsWith('.mmd') || f.endsWith('.md'))
          .sort()
        return {
          code: 0,
          data: files,
        }
      } catch (e) {
        console.error('Failed to list chain mermaid files:', e)
        return { code: 1, message: e.message, data: [] }
      }
    },
  },
  {
    url: '/api/chain/mermaid/detail',
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

        const filepath = path.resolve(process.cwd(), 'mock/chain/mermaid', filename)
        if (!fs.existsSync(filepath)) {
          return { code: 1, message: 'File not found' }
        }

        const content = fs.readFileSync(filepath, 'utf-8')
        return {
          code: 0,
          data: {
            filename,
            content,
          },
        }
      } catch (e) {
        console.error('Failed to read chain mermaid file:', e)
        return { code: 1, message: e.message }
      }
    },
  },
]
