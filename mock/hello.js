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
]

