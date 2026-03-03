import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const css = readFileSync(resolve(__dirname, 'src/styles.css'), 'utf-8')

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'ChatPilotWidget',
      fileName: (format) => `chatpilot-widget${format === 'es' ? '.esm' : ''}.js`,
      formats: ['umd', 'es']
    },
    rollupOptions: {
      output: {
        banner: `/* ChatPilot Widget v1.0.0 */`
      }
    }
  },
  define: {
    __WIDGET_CSS__: JSON.stringify(css)
  }
})
