const translations = {
  en: {
    title: 'Live Chat',
    placeholder: 'Type a message...',
    send: 'Send',
    online: 'Online',
    offline: 'Offline',
    enterName: 'Enter your name',
    startChat: 'Start Chat',
    noMessages: 'No messages yet',
    rateLimitCooldown: 'Please wait a few seconds before sending another message.',
    rateLimitExceeded: 'You have sent too many messages. Please try again later.',
    messageTooLong: 'Message is too long. Maximum 1000 characters.',
    aiLabel: 'AI',
    aiActive: 'AI Assistant',
    aiTyping: 'AI is thinking...',
    connectionError: 'Connection lost. Reconnecting...',
    serviceUnavailable: 'Chat service is currently unavailable. Please try again later.',
    greeting: 'Hi! How can I help you today?'
  },
  nl: {
    title: 'Live Chat',
    placeholder: 'Typ een bericht...',
    send: 'Verzenden',
    online: 'Online',
    offline: 'Offline',
    enterName: 'Voer uw naam in',
    startChat: 'Start Chat',
    noMessages: 'Nog geen berichten',
    rateLimitCooldown: 'Wacht een paar seconden voordat u nog een bericht stuurt.',
    rateLimitExceeded: 'U heeft te veel berichten gestuurd. Probeer het later opnieuw.',
    messageTooLong: 'Bericht is te lang. Maximaal 1000 tekens.',
    aiLabel: 'AI',
    aiActive: 'AI-assistent',
    aiTyping: 'AI denkt na...',
    connectionError: 'Verbinding verbroken. Opnieuw verbinden...',
    serviceUnavailable: 'Chatservice is momenteel niet beschikbaar. Probeer het later opnieuw.',
    greeting: 'Hallo! Hoe kan ik u vandaag helpen?'
  }
}

export function createI18n(lang = 'en') {
  let currentLang = translations[lang] ? lang : 'en'

  return {
    t(key) {
      return translations[currentLang]?.[key] || translations.en[key] || key
    },
    setLanguage(lang) {
      if (translations[lang]) {
        currentLang = lang
      }
    },
    getLanguage() {
      return currentLang
    }
  }
}
