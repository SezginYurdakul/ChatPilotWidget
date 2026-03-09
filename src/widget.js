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
  let conversationStatus = 'active'
  let greeting = ''
  const showOriginalSet = new Set() // message IDs where user toggled to see original
  const LANGUAGE_STORAGE_KEY = "chatpilot_language"
  const LANGUAGE_OPTIONS = i18n.getSupportedLanguages ? i18n.getSupportedLanguages() : ["en", "tr", "nl"]

  function getPreferredLanguage() {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      return LANGUAGE_OPTIONS.includes(saved) ? saved : i18n.getLanguage()
    } catch {
      return i18n.getLanguage()
    }
  }

  function setPreferredLanguage(lang) {
    if (!LANGUAGE_OPTIONS.includes(lang)) return
    i18n.setLanguage(lang)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    } catch {}
  }

  setPreferredLanguage(getPreferredLanguage())

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
      const data = await api.getMessages(conversationId, null, i18n.getLanguage())
      messages = (data.messages || data.data || data || []).map(normalizeMessage)
      if (data.conversation_status) {
        const wasOpen = conversationStatus === 'active'
        conversationStatus = data.conversation_status
        if (wasOpen && conversationStatus === 'closed') {
          stopPolling()
        }
      }
      updateUnread()
      render()
      scrollToBottom()
    } catch (err) {
      if (err.status === 401 || err.status === 403 || err.status === 404) {
        api.clearSession()
        hasConversation = false
        messages = []
        render()
      }
      // Network errors: silently fail, polling will retry
    }
  }

  // Poll — only re-renders if there are new messages
  async function pollMessages(conversationId) {
    try {
      const data = await api.getMessages(conversationId, null, i18n.getLanguage())
      if (data.conversation_status && data.conversation_status !== conversationStatus) {
        conversationStatus = data.conversation_status
        if (conversationStatus === 'closed') {
          stopPolling()
        }
        // Status changed — need full re-render for header + input area
        const fetched2 = (data.messages || data.data || data || []).map(normalizeMessage)
        messages = fetched2
        render()
        scrollToBottom()
        return
      }
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
      readAt: msg.read_at,
      language: msg.language || null,
      translations: msg.translations || null
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

    ws.on('translated', (data) => {
      const msg = messages.find(m => m.id === data.message_id)
      if (msg) {
        msg.translations = data.translations
        renderMessagesOnly()
      }
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
      btn.disabled = false
      errorMsg = err.code === 'SERVICE_UNAVAILABLE'
        ? i18n.t('serviceUnavailable')
        : (err.message || i18n.t('serviceUnavailable'))
      // Show error in name form area
      let errDiv = shadow.querySelector('.cp-name-form .cp-error')
      if (!errDiv) {
        errDiv = document.createElement('div')
        errDiv.className = 'cp-error'
        const form = shadow.querySelector('.cp-name-form')
        if (form) form.appendChild(errDiv)
      }
      errDiv.innerHTML = `<span>${errorMsg}</span>`
      errorMsg = null
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
      if (err.code === 'UNAUTHORIZED') {
        api.clearSession()
        hasConversation = false
        messages = []
        conversationStatus = 'active'
        errorMsg = i18n.t('conversationClosed')
        showError()
        render()
      } else if (err.code === 'RATE_LIMITED') {
        errorMsg = i18n.t('rateLimitCooldown')
        showError()
        setTimeout(() => {
          if (errorMsg === i18n.t('rateLimitCooldown')) {
            errorMsg = null
            hideError()
          }
        }, (err.retryAfter || 3) * 1000)
      } else if (err.code === 'SERVICE_UNAVAILABLE') {
        errorMsg = i18n.t('serviceUnavailable')
        showError()
      } else {
        errorMsg = err.message || i18n.t('serviceUnavailable')
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

  function handleNewChat() {
    stopPolling()
    ws.disconnect()
    api.clearSession()
    hasConversation = false
    messages = []
    conversationStatus = 'active'
    render()
  }

  function handleDismissError() {
    errorMsg = null
    hideError()
  }

  // --- Partial DOM updates (no full re-render) ---

  function renderMessageBubble(msg) {
    if (msg.sender === 'system') {
      return `<div class="cp-msg system"><div class="cp-msg-content"><p>${escapeHtml(msg.text)}</p></div></div>`
    }

    const isVisitor = msg.sender === 'visitor'
    const isAi = msg.sender === 'ai'
    const visitorLang = i18n.getLanguage()
    const hasTranslation = !isVisitor && msg.translations && msg.translations[visitorLang]
    const showingOriginal = showOriginalSet.has(msg.id)
    const displayText = (hasTranslation && !showingOriginal) ? msg.translations[visitorLang] : msg.text

    const classes = `cp-msg ${isVisitor ? 'sent' : 'received'}${isAi ? ' ai' : ''}`
    let html = `<div class="${classes}"><div class="cp-msg-content">`
    if (isAi) html += `<span class="cp-ai-badge">${i18n.t('aiLabel')}</span>`
    html += `<p>${escapeHtml(displayText)}</p>`
    if (hasTranslation) {
      const langCode = (msg.language || 'en').toUpperCase()
      const label = showingOriginal ? i18n.t('translatedFrom') : i18n.t('showOriginal')
      html += `<button class="cp-translate-toggle" data-msg-id="${msg.id}">${label}${showingOriginal ? '' : ` (${langCode})`}</button>`
    }
    html += `<div class="cp-msg-meta"><span class="cp-msg-time">${formatTime(msg.timestamp)}</span></div>`
    html += '</div></div>'
    return html
  }

  function renderMessagesOnly() {
    const msgContainer = shadow.querySelector('.cp-messages')
    if (!msgContainer) return

    let html = ''
    if (messages.length === 0) {
      html = `<div class="cp-no-messages">${i18n.t('noMessages')}</div>`
    } else {
      messages.forEach(msg => { html += renderMessageBubble(msg) })
    }

    if (isTyping) {
      html += `<div class="cp-msg received ai"><div class="cp-msg-content">
        <span class="cp-ai-badge">${i18n.t('aiLabel')}</span>
        <div class="cp-typing"><span></span><span></span><span></span></div>
      </div></div>`
    }

    msgContainer.innerHTML = html
    bindTranslateToggles()
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
    let statusClass, statusText
    if (conversationStatus === 'closed') {
      statusClass = 'offline'
      statusText = i18n.t('conversationClosed')
    } else if (isAdminOnline) {
      statusClass = 'online'
      statusText = i18n.t('online')
    } else {
      statusClass = 'ai'
      statusText = i18n.t('aiActive')
    }
    const currentLanguage = i18n.getLanguage()
    const languageOptions = LANGUAGE_OPTIONS
      .map((code) => `<option value="${code}" ${currentLanguage === code ? 'selected' : ''}>${code.toUpperCase()}</option>`)
      .join('')

    return `<div class="cp-header">
      <div class="cp-header-info">
        <h3>${i18n.t('title')}</h3>
        <div class="cp-status ${statusClass}">${statusText}</div>
      </div>
      <div class="cp-header-actions">
        <select class="cp-lang-select" aria-label="Language">${languageOptions}</select>
        <button class="cp-close">${CLOSE_ICON}</button>
      </div>
    </div>`
  }

  function renderNameForm() {
    return `<div class="cp-name-form">
      <p>${greeting || i18n.t('enterName')}</p>
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
      messages.forEach(msg => { html += renderMessageBubble(msg) })
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
    if (conversationStatus === 'closed') {
      return `<div class="cp-input-area cp-closed-area">
        <p class="cp-closed-msg">${i18n.t('conversationClosed')}</p>
        <button class="cp-new-chat-btn">${i18n.t('startNewChat')}</button>
      </div>`
    }

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

  function bindTranslateToggles() {
    shadow.querySelectorAll('.cp-translate-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const msgId = btn.dataset.msgId
        if (showOriginalSet.has(msgId)) {
          showOriginalSet.delete(msgId)
        } else {
          showOriginalSet.add(msgId)
        }
        renderMessagesOnly()
        scrollToBottom()
      })
    })
  }

  function bindEvents() {
    const closeBtn = shadow.querySelector('.cp-close')
    if (closeBtn) closeBtn.addEventListener('click', handleToggle)

    const languageSelect = shadow.querySelector('.cp-lang-select')
    if (languageSelect) {
      languageSelect.addEventListener('change', (event) => {
        setPreferredLanguage(event.target.value)
        const session = api.getSession()
        if (session?.conversationId) {
          loadMessages(session.conversationId)
        }
        render()
      })
    }

    const newChatBtn = shadow.querySelector('.cp-new-chat-btn')
    if (newChatBtn) newChatBtn.addEventListener('click', handleNewChat)

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

    bindTranslateToggles()
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
    setAdminOnline(online) {
      isAdminOnline = Boolean(online)
      if (isOpen) {
        render()
      }
    },
    destroy() {
      stopPolling()
      ws.disconnect()
      if (host && host.parentNode) host.parentNode.removeChild(host)
    },
    setTheme(theme) {
      if (theme === 'dark') host.classList.add('dark')
      else host.classList.remove('dark')
    },
    applySettings(settings) {
      if (!settings?.widget) return
      const w = settings.widget
      if (w.theme) {
        if (w.theme === 'dark') host.classList.add('dark')
        else host.classList.remove('dark')
      }
      if (w.position) {
        if (w.position === 'bottom-left') container.classList.add('left')
        else container.classList.remove('left')
      }
      if (w.greeting) {
        greeting = w.greeting
      }
    }
  }
}
