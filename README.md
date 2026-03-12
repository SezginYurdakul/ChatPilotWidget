# ChatPilot Widget

A lightweight, embeddable live chat widget for websites. Connects visitors to customer service agents in real time, with automatic AI responses when no agent is online.

## Features

- **Real-time messaging** — WebSocket support via Laravel Reverb/Pusher with REST polling fallback
- **AI assistant** — Automatic AI responses when no admin is available
- **14 languages** — English, Dutch, German, French, Spanish, Portuguese, Turkish, Chinese, Japanese, Korean, Arabic, Russian, Hindi
- **Theming** — Light and dark themes out of the box
- **Shadow DOM** — Fully encapsulated styles, no CSS conflicts with host page
- **Tiny footprint** — Single JS file (~98KB), no external CSS needed
- **Framework-agnostic** — Works with plain HTML, React, Vue, Next.js, Nuxt, WordPress, and more

## Quick Start

Add two lines to your HTML:

```html
<script
  src="https://your-domain.com/chatpilot-widget.js"
  data-site-key="sk_your_key"
  data-api="https://your-chatpilot-api.com"
></script>
```

That's it. The widget auto-initializes and appears as a floating chat button.

## Installation

### Script Tag (recommended)

```html
<script src="https://your-domain.com/chatpilot-widget.js"></script>
<script>
  ChatPilotWidget.init({
    siteKey: 'sk_your_key',
    apiUrl: 'https://your-chatpilot-api.com',
  });
</script>
```

### ES Module

```js
import ChatPilotWidget from './chatpilot-widget.esm.js';

ChatPilotWidget.init({
  siteKey: 'sk_your_key',
  apiUrl: 'https://your-chatpilot-api.com',
});
```

### Data Attributes (auto-init)

```html
<script
  src="https://your-domain.com/chatpilot-widget.js"
  data-site-key="sk_your_key"
  data-api="https://your-chatpilot-api.com"
  data-language="en"
  data-position="bottom-right"
  data-theme="light"
></script>
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `siteKey` | `string` | — | **Required.** Your site key from ChatPilot dashboard |
| `apiUrl` | `string` | — | **Required.** ChatPilot API base URL |
| `language` | `string` | `en` | Widget language (`en`, `nl`, `de`, `fr`, `es`, `pt`, `tr`, `zh`, `ja`, `ko`, `ar`, `ru`, `hi`) |
| `position` | `string` | `bottom-right` | Widget position: `bottom-right` or `bottom-left` |
| `theme` | `string` | `light` | Color theme: `light` or `dark` |
| `wsKey` | `string` | — | Pusher/Reverb app key (enables WebSocket) |
| `wsPort` | `number` | — | WebSocket server port |
| `forceTLS` | `boolean` | `true` | Force TLS for WebSocket connection |

## JavaScript API

```js
ChatPilotWidget.open();    // Open the chat window
ChatPilotWidget.close();   // Close the chat window
ChatPilotWidget.destroy(); // Remove the widget entirely
```

## Development

### Prerequisites

- Node.js 18+

### Setup

```bash
git clone https://github.com/your-org/ChatPilotWidget.git
cd ChatPilotWidget
npm install
```

### Commands

```bash
npm run dev      # Start dev server with hot reload
npm run build    # Build for production (UMD + ESM)
npm run preview  # Preview the production build
```

### Testing locally

Open `test.html` in a browser or use the Vite dev server. Update the `siteKey` and `apiUrl` values in the test page to point to a running ChatPilot backend.

## Architecture

```
src/
├── index.js       # Public API (init, open, close, destroy)
├── widget.js      # UI rendering and state management
├── api.js         # REST API client
├── websocket.js   # WebSocket/Pusher integration
├── i18n.js        # Translations for 14 languages
└── styles.css     # Shadow DOM scoped styles
```

The widget renders inside a Shadow DOM to avoid style conflicts. CSS is embedded into the JS bundle at build time. Messages are fetched via REST API and updated in real time through WebSocket events when available.

### API Endpoints

The widget communicates with a ChatPilot backend through these endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/site/config` | Fetch site settings and admin status |
| `POST` | `/api/v1/conversations` | Create a new conversation |
| `GET` | `/api/v1/conversations/{id}/messages` | Fetch messages |
| `POST` | `/api/v1/conversations/{id}/messages` | Send a message |

### WebSocket Events

| Event | Description |
|-------|-------------|
| `MessageSent` | New message received |
| `MessageRead` | Message marked as read |
| `TypingStarted` | Agent is typing |
| `AdminStatusChanged` | Agent online/offline status changed |
| `MessageTranslated` | Translation completed |

## License

All rights reserved.
