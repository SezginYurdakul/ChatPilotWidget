import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const css = readFileSync(resolve(__dirname, 'src/styles.css'), 'utf-8')

// Auto-init snippet appended after the UMD wrapper
const autoInitSnippet = `;(function(){
  if(typeof window==="undefined")return;
  var s=document.currentScript||document.querySelector("script[data-site-key]");
  if(!s)return;
  var key=s.getAttribute("data-site-key"),api=s.getAttribute("data-api");
  if(!key||!api)return;
  function r(){window.ChatPilotWidget.init({siteKey:key,apiUrl:api,language:s.getAttribute("data-language")||void 0,position:s.getAttribute("data-position")||void 0,theme:s.getAttribute("data-theme")||void 0})}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",r):r();
})();`

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
        banner: `/* ChatPilot Widget v1.0.0 */`,
        footer: autoInitSnippet
      }
    }
  },
  define: {
    __WIDGET_CSS__: JSON.stringify(css)
  }
})
