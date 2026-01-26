import fs from 'node:fs'
import path from 'node:path'

export default [
    {
        url: '/api/timeline/list',
        method: 'get',
        response: () => {
            try {
                const dir = path.resolve(process.cwd(), 'mock/timeline');
                if (!fs.existsSync(dir)) {
                    return { code: 0, data: [] };
                }
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
                return {
                    code: 0,
                    data: files
                };
            } catch (e) {
                console.error('Failed to list timeline files:', e);
                return { code: 1, message: e.message, data: [] };
            }
        },
    },
    {
        url: '/api/timeline/detail',
        method: 'get',
        response: ({ query }) => {
            try {
                const filename = query.filename;
                if (!filename) {
                    return { code: 1, message: 'Filename required' };
                }
                // Basic security check: prevent directory traversal
                if (filename.includes('..') || filename.includes('/')) {
                    return { code: 1, message: 'Invalid filename' };
                }

                const filepath = path.resolve(process.cwd(), 'mock/timeline', filename);
                if (!fs.existsSync(filepath)) {
                    return { code: 1, message: 'File not found' };
                }

                const content = fs.readFileSync(filepath, 'utf-8');
                return {
                    code: 0,
                    data: JSON.parse(content)
                };
            } catch (e) {
                console.error('Failed to read timeline file:', e);
                return { code: 1, message: e.message };
            }
        },
    },
]
