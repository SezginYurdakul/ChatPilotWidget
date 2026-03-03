const CHAT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>'
const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'

export function createWidget({ api, ws, i18n, position = 'bottom-right' }) {
  // State
  let isOpen = false
  let hasConversation = false
  let messages = []
  let unreadCount = 0
  let isAdminOnline = false
  let isTyping = false
  let errorMsg = null
  let inputValue = ''

  // DOM references
  let host, shadow, container
  let pollInterval = null

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function init() {
    host = document.createElement('chatpilot-widget')
    shadow = host.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = __WIDGET_CSS__
    shadow.appendChild(style)

    container = document.createElement('div')
    container.className = `cp-container${position === 'bottom-left' ? ' left' : ''}`
    shadow.appendChild(container)

    document.body.appendChild(host)

    const session = api.getSession()
    if (session?.conversationId) {
      hasConversation = true
      loadMessages(session.conversationId)
      connectWebSocket(session.conversationId)
      startPolling(session.conversationId)
    }

    render()
  }

  function startPolling(conversationId) {
    stopPolling()
    pollInterval = setInterval(async () => {
      if (!ws.isConnected()) {
        await pollMessages(conversationId)
      }
    }, 3000)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  // Full load — used on init only
  async function loadMessages(conversationId) {
    try {
      const data = await api.getMessages(conversationId)
      messages = (data.messages || data.data || data || []).map(normalizeMessage)
      updateUnread()
      render()
      scrollToBottom()
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        api.clearSession()
        hasConversation = false
        messages = []
        render()
      }
    }
  }

  // Poll — only re-renders if there are new messages
  async function pollMessages(conversationId) {
    try {
      const data = await api.getMessages(conversationId)
      const fetched = (data.messages || data.data || data || []).map(normalizeMessage)
      if (fetched.length !== messages.length) {
        // Find truly new messages
        const existingIds = new Set(messages.map(m => m.id))
        const newMsgs = fetched.filter(m => !existingIds.has(m.id))
        if (newMsgs.length > 0) {
          newMsgs.forEach(msg => {
            messages.push(msg)
            if (!isOpen && msg.sender !== 'visitor') {
              unreadCount++
            }
          })
          isTyping = false
          renderMessagesOnly()
          updateBadge()
          scrollToBottom()
        }
      }
    } catch {
      // Silently fail on poll errors
    }
  }

  function normalizeMessage(msg) {
    return {
      id: msg.id,
      text: msg.text,
      sender: msg.sender_type || msg.sender,
      timestamp: msg.created_at || msg.timestamp,
      readAt: msg.read_at
    }
  }

  function connectWebSocket(conversationId) {
    ws.subscribeConversation(conversationId)

    ws.on('message', (msg) => {
      const normalized = normalizeMessage(msg)
      if (!messages.find(m => m.id === normalized.id)) {
        // Remove temp message with same text if exists
        messages = messages.filter(m => !(m.id.startsWith('temp-') && m.text === normalized.text))
        messages.push(normalized)
        if (!isOpen && normalized.sender !== 'visitor') {
          unreadCount++
        }
        isTyping = false
        renderMessagesOnly()
        updateBadge()
        scrollToBottom()
      }
    })

    ws.on('typing', (data) => {
      if (data.sender_type !== 'visitor') {
        isTyping = true
        renderMessagesOnly()
        scrollToBottom()
      }
    })

    ws.on('read', () => {
      messages.forEach(m => {
        if (m.sender === 'visitor') m.readAt = new Date().toISOString()
      })
    })

    ws.on('adminStatus', (data) => {
      isAdminOnline = data.online
      const statusEl = shadow.querySelector('.cp-status')
      if (statusEl) {
        statusEl.className = `cp-status ${isAdminOnline ? 'online' : 'ai'}`
        statusEl.textContent = isAdminOnline ? i18n.t('online') : i18n.t('aiActive')
      }
    })
  }

  function updateUnread() {
    if (isOpen) {
      unreadCount = 0
    } else {
      unreadCount = messages.filter(m => m.sender !== 'visitor' && !m.readAt).length
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const el = shadow.querySelector('.cp-messages')
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  // --- Event handlers ---

  function handleToggle() {
    isOpen = !isOpen
    if (isOpen) {
      unreadCount = 0
    }
    render()
    if (isOpen) scrollToBottom()
  }

  async function handleNameSubmit(e) {
    e.preventDefault()
    const input = shadow.querySelector('.cp-name-input')
    const name = input?.value?.trim()
    if (!name) return

    const btn = shadow.querySelector('.cp-name-btn')
    btn.disabled = true

    try {
      const session = await api.createConversation(name, {
        page_url: window.location.href,
        language: i18n.getLanguage()
      })
      hasConversation = true
      connectWebSocket(session.conversationId)
      startPolling(session.conversationId)
      render()
    } catch (err) {
      console.error('ChatPilot: Failed to start conversation', err)
      btn.disabled = false
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault()
    const input = shadow.querySelector('.cp-msg-input')
    const text = input?.value?.trim()
    if (!text) return

    if (text.length > 1000) {
      errorMsg = i18n.t('messageTooLong')
      showError()
      return
    }

    const session = api.getSession()
    if (!session?.conversationId) return

    input.value = ''
    inputValue = ''
    errorMsg = null
    hideError()

    // Optimistic add
    const tempMsg = {
      id: 'temp-' + Date.now(),
      text,
      sender: 'visitor',
      timestamp: new Date().toISOString()
    }
    messages.push(tempMsg)
    renderMessagesOnly()
    scrollToBottom()

    try {
      await api.sendMessage(session.conversationId, text, i18n.getLanguage())
    } catch (err) {
      messages = messages.filter(m => m.id !== tempMsg.id)
      if (err.code === 'RATE_LIMITED') {
        errorMsg = i18n.t('rateLimitCooldown')
        showError()
        setTimeout(() => {
          if (errorMsg === i18n.t('rateLimitCooldown')) {
            errorMsg = null
            hideError()
          }
        }, (err.retryAfter || 3) * 1000)
      } else {
        errorMsg = err.message
        showError()
      }
      renderMessagesOnly()
    }
  }

  function handleInputChange(e) {
    inputValue = e.target.value
    const counter = shadow.querySelector('.cp-char-counter')
    if (counter) {
      if (inputValue.length > 0) {
        counter.textContent = `${inputValue.length}/1000`
        counter.style.display = 'block'
        counter.className = `cp-char-counter${inputValue.length > 900 ? ' warning' : ''}`
      } else {
        counter.style.display = 'none'
      }
    }
  }

  function handleDismissError() {
    errorMsg = null
    hideError()
  }

  // --- Partial DOM updates (no full re-render) ---

  function renderMessagesOnly() {
    const msgContainer = shadow.querySelector('.cp-messages')
    if (!msgContainer) return

    let html = ''
    if (messages.length === 0) {
      html = `<div class="cp-no-messages">${i18n.t('noMessages')}</div>`
    } else {
      messages.forEach(msg => {
        const isVisitor = msg.sender === 'visitor'
        const isAi = msg.sender === 'ai'
        const classes = `cp-msg ${isVisitor ? 'sent' : 'received'}${isAi ? ' ai' : ''}`
        html += `<div class="${classes}"><div class="cp-msg-content">`
        if (isAi) html += `<span class="cp-ai-badge">${i18n.t('aiLabel')}</span>`
        html += `<p>${escapeHtml(msg.text)}</p>`
        html += `<div class="cp-msg-meta"><span class="cp-msg-time">${formatTime(msg.timestamp)}</span></div>`
        html += '</div></div>'
      })
    }

    if (isTyping) {
      html += `<div class="cp-msg received ai"><div class="cp-msg-content">
        <span class="cp-ai-badge">${i18n.t('aiLabel')}</span>
        <div class="cp-typing"><span></span><span></span><span></span></div>
      </div></div>`
    }

    msgContainer.innerHTML = html
  }

  function updateBadge() {
    const badge = shadow.querySelector('.cp-badge')
    const btn = shadow.querySelector('.cp-button')
    if (!btn) return

    if (!isOpen && unreadCount > 0) {
      if (badge) {
        badge.textContent = unreadCount
      } else {
        const span = document.createElement('span')
        span.className = 'cp-badge'
        span.textContent = unreadCount
        btn.appendChild(span)
      }
    } else if (badge) {
      badge.remove()
    }
  }

  function showError() {
    // Insert error div before input form if not exists
    const inputArea = shadow.querySelector('.cp-input-area')
    if (!inputArea || !errorMsg) return

    let errDiv = shadow.querySelector('.cp-error')
    if (!errDiv) {
      errDiv = document.createElement('div')
      errDiv.className = 'cp-error'
      inputArea.insertBefore(errDiv, inputArea.firstChild)
    }
    errDiv.innerHTML = `<span>${errorMsg}</span><button class="cp-error-dismiss">&times;</button>`
    errDiv.querySelector('.cp-error-dismiss').addEventListener('click', handleDismissError)
  }

  function hideError() {
    const errDiv = shadow.querySelector('.cp-error')
    if (errDiv) errDiv.remove()
  }

  // --- Full render (only for open/close/init) ---

  function render() {
    container.innerHTML = ''

    if (isOpen) {
      const win = document.createElement('div')
      win.className = 'cp-window'
      win.innerHTML = renderHeader() + (hasConversation ? renderMessageArea() + renderInputArea() : renderNameForm())
      container.appendChild(win)
      requestAnimationFrame(() => bindEvents())
    }

    const btn = document.createElement('button')
    btn.className = `cp-button${isOpen ? ' open' : ''}`
    btn.innerHTML = isOpen ? CLOSE_ICON : CHAT_ICON
    if (!isOpen && unreadCount > 0) {
      btn.innerHTML += `<span class="cp-badge">${unreadCount}</span>`
    }
    btn.addEventListener('click', handleToggle)
    container.appendChild(btn)
  }

  function renderHeader() {
    const statusClass = isAdminOnline ? 'online' : 'ai'
    const statusText = isAdminOnline ? i18n.t('online') : i18n.t('aiActive')
    return `<div class="cp-header">
      <div class="cp-header-info">
        <h3>${i18n.t('title')}</h3>
        <div class="cp-status ${statusClass}">${statusText}</div>
      </div>
      <button class="cp-close">${CLOSE_ICON}</button>
    </div>`
  }

  function renderNameForm() {
    return `<div class="cp-name-form">
      <p>${i18n.t('enterName')}</p>
      <form>
        <input type="text" class="cp-name-input" placeholder="${i18n.t('enterName')}" maxlength="50" required>
        <button type="submit" class="cp-name-btn">${i18n.t('startChat')}</button>
      </form>
    </div>`
  }

  function renderMessageArea() {
    let html = '<div class="cp-messages">'
    if (messages.length === 0) {
      html += `<div class="cp-no-messages">${i18n.t('noMessages')}</div>`
    } else {
      messages.forEach(msg => {
        const isVisitor = msg.sender === 'visitor'
        const isAi = msg.sender === 'ai'
        const classes = `cp-msg ${isVisitor ? 'sent' : 'received'}${isAi ? ' ai' : ''}`
        html += `<div class="${classes}"><div class="cp-msg-content">`
        if (isAi) html += `<span class="cp-ai-badge">${i18n.t('aiLabel')}</span>`
        html += `<p>${escapeHtml(msg.text)}</p>`
        html += `<div class="cp-msg-meta"><span class="cp-msg-time">${formatTime(msg.timestamp)}</span></div>`
        html += '</div></div>'
      })
    }
    if (isTyping) {
      html += `<div class="cp-msg received ai"><div class="cp-msg-content">
        <span class="cp-ai-badge">${i18n.t('aiLabel')}</span>
        <div class="cp-typing"><span></span><span></span><span></span></div>
      </div></div>`
    }
    html += '</div>'
    return html
  }

  function renderInputArea() {
    let html = '<div class="cp-input-area">'
    if (errorMsg) {
      html += `<div class="cp-error"><span>${errorMsg}</span><button class="cp-error-dismiss">&times;</button></div>`
    }
    html += `<div class="cp-char-counter" style="display:none"></div>
      <form class="cp-input-form">
        <input type="text" class="cp-msg-input" placeholder="${i18n.t('placeholder')}" maxlength="1000">
        <button type="submit">${i18n.t('send')}</button>
      </form></div>`
    return html
  }

  function bindEvents() {
    const closeBtn = shadow.querySelector('.cp-close')
    if (closeBtn) closeBtn.addEventListener('click', handleToggle)

    const nameForm = shadow.querySelector('.cp-name-form form')
    if (nameForm) nameForm.addEventListener('submit', handleNameSubmit)

    const msgForm = shadow.querySelector('.cp-input-form')
    if (msgForm) msgForm.addEventListener('submit', handleSendMessage)

    const msgInput = shadow.querySelector('.cp-msg-input')
    if (msgInput) {
      msgInput.addEventListener('input', handleInputChange)
      msgInput.focus()
    }

    const dismissBtn = shadow.querySelector('.cp-error-dismiss')
    if (dismissBtn) dismissBtn.addEventListener('click', handleDismissError)

    scrollToBottom()
  }

  function escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  return {
    init,
    open() { if (!isOpen) handleToggle() },
    close() { if (isOpen) handleToggle() },
    destroy() {
      stopPolling()
      ws.disconnect()
      if (host && host.parentNode) host.parentNode.removeChild(host)
    },
    setTheme(theme) {
      if (theme === 'dark') host.classList.add('dark')
      else host.classList.remove('dark')
    }
  }
}
