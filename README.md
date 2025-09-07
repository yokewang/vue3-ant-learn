# vue3-ant-learn

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Compile and Minify for Production

```sh
pnpm build
```

### Lint with [ESLint](https://eslint.org/)

```sh
pnpm lint
```

## Tech Stack

- Framework: Vue 3 + Vite 7
- Router: Vue Router 4
- State: Pinia 3
- UI: Ant Design Vue 4
- Markdown: markdown-it, marked, highlight.js
- Diagrams: Mermaid 11
- Dev Tools: vite-plugin-vue-devtools
- Mock/Test Services: vite-plugin-mock (supports HTTP + SSE)

## Project Structure (relevant parts)

```
src/
  views/
    HomeView.vue               # Buttons to test mock GET/POST/SSE
    AnalysisStreamView.vue     # Local typing stream + SSE stream demo
  stores/
    analysis.js                # Reactive fields to be filled
    analysis-sample.js         # Sample contents used by local typing stream
mock/
  hello.js                     # /api/hello (GET/POST) and /api/hello/stream (SSE)
  analysis-stream.js           # /analysis/stream (SSE from JSON file)
  data/
    analysis-store.json        # Source data for /analysis/stream
```

## Mock & Test Services

This project uses `vite-plugin-mock` for local mock HTTP and SSE endpoints (enabled in dev).

- `mock/hello.js`:
  - `GET /api/hello?name=xxx` → `{ code, data }`
  - `POST /api/hello` with body `{ name }` → `{ code, data }`
  - `GET /api/hello/stream` → SSE stream that emits incremental JSON chunks

- `mock/analysis-stream.js`:
  - `GET /analysis/stream` → SSE stream that reads `mock/data/analysis-store.json` and emits segments in order: `summary → solution → alert → topos[] → causeSummary → causeDetail`
  - Event types:
    - `segment_start`: `{ field, index? }`
    - `segment_data`: `{ field, text, index? }` (tokens preserve spaces/newlines)
    - `segment_end`: `{ field, reason: 'end_tag', index? }`
  - Timing: token delay 20ms; gap 500ms between fields and between individual `topos` entries

Vite config snippet (already applied in this project):

```ts
// vite.config.ts/js
import { viteMockServe } from 'vite-plugin-mock'

export default defineConfig({
  plugins: [
    viteMockServe({
      mockPath: 'mock',
      localEnabled: true,
      prodEnabled: false,
    }),
  ],
})
```

## How to Test in the UI

1) Home page (`/`):
   - Click “Test GET /api/hello” and “Test POST /api/hello” to verify HTTP mock endpoints
   - Click “Test SSE /api/hello/stream” to see incremental streaming text

2) Analysis Stream page (`/analysis-stream`):
   - Click “stream” for local typing simulation from `analysis-sample`
   - Click “sse stream” to consume `/analysis/stream` and fill the analysis store live
   - To change content, edit `mock/data/analysis-store.json` and re-run the stream

## Notes for Devs

- The SSE client preserves whitespace and newlines so Markdown/Mermaid render correctly
- `MermaidTabs` renders multiple Mermaid sources; viewers are debounced for performance
- Pinia stores are plain and browser-safe; do not import `.vue` files into mock scripts

## Troubleshooting

- Mock not working? Ensure `viteMockServe` is imported and `localEnabled: true` in `vite.config.js`
- SSE not rendering properly? Verify that tokens include whitespace (server) and are concatenated verbatim (client)
- Mermaid error in a tab? Check the Mermaid syntax in the corresponding source string
