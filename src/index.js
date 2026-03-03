import { createApiClient } from './api.js'
import { createWebSocket } from './websocket.js'
import { createI18n } from './i18n.js'
import { createWidget } from './widget.js'

let widgetInstance = null

const ChatPilotWidget = {
  init(config = {}) {
    if (widgetInstance) {
      console.warn('ChatPilot: Widget already initialized')
      return widgetInstance
    }

    const { siteKey, apiUrl, wsKey, wsPort, language, position, theme, forceTLS } = config

    if (!siteKey || !apiUrl) {
      console.error('ChatPilot: siteKey and apiUrl are required')
      return null
    }

    const api = createApiClient(apiUrl, siteKey)
    const i18n = createI18n(language)
    const ws = createWebSocket({
      apiUrl,
      wsKey: wsKey || 'chatpilot-reverb-key',
      wsPort,
      forceTLS: forceTLS ?? apiUrl.startsWith('https')
    })

    const widget = createWidget({ api, ws, i18n, position: position || 'bottom-right' })

    if (theme === 'dark') {
      widget.init()
      widget.setTheme('dark')
    } else {
      widget.init()
    }

    // Fetch site config to get settings
    api.getConfig().then(data => {
      const cfg = data.data || data
      if (cfg.admin_online) {
        // Admin is online — widget can show status
      }
    }).catch(() => {
      // Config fetch failed — widget works without it
    })

    ws.connect()

    widgetInstance = widget
    return widget
  },

  destroy() {
    if (widgetInstance) {
      widgetInstance.destroy()
      widgetInstance = null
    }
  },

  open() {
    if (widgetInstance) widgetInstance.open()
  },

  close() {
    if (widgetInstance) widgetInstance.close()
  }
}

// Auto-expose globally for script tag usage
if (typeof window !== 'undefined') {
  window.ChatPilotWidget = ChatPilotWidget
}

export default ChatPilotWidget
