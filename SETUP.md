# ChatPilot Widget - Setup Guide

Embeddable live chat widget for any website. Connects to a ChatPilot backend API for real-time messaging, AI responses, and auto-translation.

## Prerequisites

- A running **ChatPilot backend** instance (API URL)
- A **Site API Key** (`sk_...`) generated from the ChatPilot admin panel
- Node.js 18+ (for building from source)

## Quick Start (Script Tag)

Add these two lines before `</body>` on any HTML page:

```html
<script src="https://your-domain.com/chatpilot-widget.js"></script>
<script>
  ChatPilotWidget.init({
    siteKey: 'sk_your_site_api_key',
    apiUrl: 'https://your-chatpilot-api-domain.com'
  });
</script>
```

That's it. A floating chat button will appear in the bottom-right corner.

## Configuration Options

All options are passed to `ChatPilotWidget.init()`:

| Option | Type | Default | Description |
|---|---|---|---|
| `siteKey` | string | **required** | Site API key from ChatPilot admin panel |
| `apiUrl` | string | **required** | ChatPilot backend URL (e.g. `https://chat.example.com`) |
| `language` | string | `'en'` | Default UI language |
| `position` | string | `'bottom-right'` | Widget position: `'bottom-right'` or `'bottom-left'` |
| `theme` | string | `'light'` | Color theme: `'light'` or `'dark'` |
| `wsKey` | string | `'chatpilot-reverb-key'` | WebSocket app key (for Laravel Reverb) |
| `wsPort` | number | auto | WebSocket port (auto-detected from apiUrl) |
| `forceTLS` | boolean | auto | Force TLS for WebSocket (`true` if apiUrl is https) |

### Full Example

```html
<script src="https://your-domain.com/chatpilot-widget.js"></script>
<script>
  ChatPilotWidget.init({
    siteKey: 'sk_your_site_api_key',
    apiUrl: 'https://chat.example.com',
    language: 'nl',
    position: 'bottom-left',
    theme: 'dark'
  });
</script>
```

## Supported Languages

The widget UI is available in 14 languages. Visitors can switch languages from a dropdown inside the widget.

`en` `nl` `de` `fr` `es` `pt` `tr` `zh` `ja` `ko` `ar` `ru` `hi`

Messages are auto-translated between visitor and admin languages by the backend.

## JavaScript API

After initialization, you can control the widget programmatically:

```js
ChatPilotWidget.open()     // Open the chat window
ChatPilotWidget.close()    // Close the chat window
ChatPilotWidget.destroy()  // Remove widget from the page completely
```

## Integration Methods

### 1. Static HTML / WordPress / Any CMS

Paste the script tag into your site's footer template or use a "Custom HTML" block:

```html
<script src="https://your-domain.com/chatpilot-widget.js"></script>
<script>
  ChatPilotWidget.init({
    siteKey: 'sk_your_site_api_key',
    apiUrl: 'https://chat.example.com'
  });
</script>
```

### 2. React / Next.js

Create a component that loads the widget script dynamically:

```jsx
import { useEffect } from 'react'

const ChatPilotWidget = () => {
  useEffect(() => {
    const scriptUrl = 'https://your-domain.com/chatpilot-widget.js'
    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true

    script.onload = () => {
      if (window.ChatPilotWidget) {
        window.ChatPilotWidget.init({
          siteKey: 'sk_your_site_api_key',
          apiUrl: 'https://chat.example.com',
          language: 'en',
          position: 'bottom-right'
        })
      }
    }

    document.body.appendChild(script)

    return () => {
      if (window.ChatPilotWidget) {
        window.ChatPilotWidget.destroy()
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  return null
}

export default ChatPilotWidget
```

Then add `<ChatPilotWidget />` in your root layout or `App` component.

### 3. Vue.js / Nuxt

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  const script = document.createElement('script')
  script.src = 'https://your-domain.com/chatpilot-widget.js'
  script.async = true
  script.onload = () => {
    window.ChatPilotWidget?.init({
      siteKey: 'sk_your_site_api_key',
      apiUrl: 'https://chat.example.com'
    })
  }
  document.body.appendChild(script)
})

onUnmounted(() => {
  window.ChatPilotWidget?.destroy()
})
</script>

<template>
  <!-- Widget renders itself, no template needed -->
</template>
```

### 4. ES Module Import

If you install the widget as an npm package or bundle it:

```js
import ChatPilotWidget from './chatpilot-widget.esm.js'

ChatPilotWidget.init({
  siteKey: 'sk_your_site_api_key',
  apiUrl: 'https://chat.example.com'
})
```

## Building from Source

```bash
# Install dependencies
npm install

# Development (with hot reload)
npm run dev

# Production build
npm run build
```

Build output:
- `dist/chatpilot-widget.js` - UMD bundle (for `<script>` tags)
- `dist/chatpilot-widget.esm.js` - ES module bundle (for `import`)

## Hosting the Widget Script

The built `chatpilot-widget.js` file needs to be served from a URL accessible to your website visitors. Options:

1. **Same server as your site** - Copy `dist/chatpilot-widget.js` to your site's public/static folder
2. **CDN** - Upload to a CDN (CloudFlare R2, AWS S3 + CloudFront, etc.)
3. **ChatPilot backend** - Place in the backend's `public/` directory

### Cache Busting

Add a version query parameter to force browsers to load the latest version:

```html
<script src="https://your-domain.com/chatpilot-widget.js?v=20260304"></script>
```

## Local Testing

Open `test.html` in a browser to test the widget locally. Update the `siteKey` and `apiUrl` values in that file to point to your ChatPilot backend.

## How It Works

1. Visitor opens your website, the widget script loads
2. Visitor clicks the chat button and enters their name
3. A conversation is created on the ChatPilot backend
4. Messages are exchanged via REST API with 3-second polling fallback
5. Real-time delivery uses WebSockets (Laravel Reverb) when available
6. Admin messages are auto-translated to the visitor's selected language
7. When no admin is online, an AI assistant responds automatically

## Troubleshooting

| Problem | Solution |
|---|---|
| Widget doesn't appear | Check browser console for errors. Verify `siteKey` and `apiUrl` are correct. |
| "Chat service unavailable" | Backend is unreachable. Check if the ChatPilot API is running and CORS is configured. |
| WebSocket not connecting | Widget falls back to polling automatically. Check `wsKey`/`wsPort` if you need real-time. |
| Translations not showing | Ensure the backend queue worker is running (`php artisan queue:work`). |
| Widget appears on admin page | In React, conditionally render the component (skip on `/chat` route). |
