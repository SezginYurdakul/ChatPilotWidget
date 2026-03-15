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

    // Fetch site config and set initial admin online state.
    api.getConfig().then(data => {
      const cfg = data.data || data
      widget.setAdminOnline(Boolean(cfg.admin_online))
      widget.applySettings(cfg.settings)

      // Subscribe to admin online/offline updates for this site.
      if (cfg.site_id) {
        ws.subscribeSite(cfg.site_id)
        widget.startPresencePolling()
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
