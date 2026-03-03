import Pusher from 'pusher-js'

// Laravel broadcasts with fully-qualified class names unless broadcastAs() is defined
const EVENTS = {
  MessageSent: 'App\\Events\\MessageSent',
  MessageRead: 'App\\Events\\MessageRead',
  TypingStarted: 'App\\Events\\TypingStarted',
  AdminStatusChanged: 'App\\Events\\AdminStatusChanged',
  MessageTranslated: 'App\\Events\\MessageTranslated'
}

export function createWebSocket(config) {
  const { apiUrl, wsKey, wsPort, forceTLS = false } = config

  const url = new URL(apiUrl)
  const wsHost = url.hostname

  let pusher = null
  let conversationChannel = null
  let siteChannel = null
  let connected = false
  const listeners = {}

  function on(event, callback) {
    if (!listeners[event]) listeners[event] = []
    listeners[event].push(callback)
  }

  function emit(event, data) {
    if (listeners[event]) {
      listeners[event].forEach(cb => cb(data))
    }
  }

  function isConnected() {
    return connected
  }

  function connect() {
    if (pusher) return

    pusher = new Pusher(wsKey, {
      wsHost,
      wsPort: wsPort || (forceTLS ? 443 : parseInt(url.port) || 80),
      wssPort: wsPort || 443,
      forceTLS,
      enabledTransports: forceTLS ? ['wss'] : ['ws', 'wss'],
      disableStats: true,
      cluster: 'mt1'
    })

    pusher.connection.bind('connected', () => {
      connected = true
      emit('connected')
    })
    pusher.connection.bind('disconnected', () => {
      connected = false
      emit('disconnected')
    })
    pusher.connection.bind('error', (err) => {
      connected = false
      emit('error', err)
    })
  }

  function subscribeConversation(conversationId) {
    if (!pusher) connect()
    if (conversationChannel) conversationChannel.unbind_all()

    conversationChannel = pusher.subscribe(`conversation.${conversationId}`)

    // Listen with Laravel's fully-qualified event names
    conversationChannel.bind(EVENTS.MessageSent, (data) => emit('message', data.message))
    conversationChannel.bind(EVENTS.MessageRead, (data) => emit('read', data))
    conversationChannel.bind(EVENTS.TypingStarted, (data) => emit('typing', data))

    conversationChannel.bind(EVENTS.MessageTranslated, (data) => emit('translated', data))

    // Also listen for short event names (in case broadcastAs() is used)
    conversationChannel.bind('MessageSent', (data) => emit('message', data.message))
    conversationChannel.bind('MessageRead', (data) => emit('read', data))
    conversationChannel.bind('TypingStarted', (data) => emit('typing', data))
    conversationChannel.bind('MessageTranslated', (data) => emit('translated', data))
  }

  function subscribeSite(siteId) {
    if (!pusher) connect()
    if (siteChannel) siteChannel.unbind_all()

    siteChannel = pusher.subscribe(`admin.site.${siteId}`)
    siteChannel.bind(EVENTS.AdminStatusChanged, (data) => emit('adminStatus', data))
    siteChannel.bind('AdminStatusChanged', (data) => emit('adminStatus', data))
  }

  function disconnect() {
    if (conversationChannel) {
      conversationChannel.unbind_all()
      conversationChannel = null
    }
    if (siteChannel) {
      siteChannel.unbind_all()
      siteChannel = null
    }
    if (pusher) {
      pusher.disconnect()
      pusher = null
    }
    connected = false
  }

  return { on, connect, subscribeConversation, subscribeSite, disconnect, isConnected }
}
