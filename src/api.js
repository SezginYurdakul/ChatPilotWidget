const STORAGE_KEY = 'chatpilot_session'

export function createApiClient(apiUrl, siteKey) {
  const baseUrl = apiUrl.replace(/\/$/, '')

  function getSession() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }

  function saveSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY)
  }

  async function request(method, path, body = null) {
    const session = getSession()
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Site-Key': siteKey
    }
    if (session?.visitorToken) {
      headers['X-Visitor-Token'] = session.visitorToken
    }

    let res
    try {
      res = await fetch(`${baseUrl}/api${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
      })
    } catch {
      const error = new Error('SERVICE_UNAVAILABLE')
      error.code = 'SERVICE_UNAVAILABLE'
      throw error
    }

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}))
      const error = new Error('Rate limited')
      error.retryAfter = data.retry_after || 3
      error.code = 'RATE_LIMITED'
      throw error
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const error = new Error(data.message || `HTTP ${res.status}`)
      error.status = res.status
      throw error
    }

    return res.json()
  }

  return {
    getSession,
    saveSession,
    clearSession,

    async getConfig() {
      return request('GET', '/v1/site/config')
    },

    async createConversation(visitorName, metadata = {}) {
      const data = await request('POST', '/v1/conversations', {
        visitor_name: visitorName,
        metadata
      })
      const session = {
        conversationId: data.data?.id || data.id,
        visitorToken: data.data?.visitor_token || data.visitor_token,
        visitorName
      }
      saveSession(session)
      return session
    },

    async getMessages(conversationId, afterId = null) {
      const query = afterId ? `?after=${afterId}` : ''
      return request('GET', `/v1/conversations/${conversationId}/messages${query}`)
    },

    async sendMessage(conversationId, text, language = null) {
      const body = { text }
      if (language) body.language = language
      return request('POST', `/v1/conversations/${conversationId}/messages`, body)
    }
  }
}
