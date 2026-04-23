---
title: "browser panel"
basePath: ..
---

# Browser Panel — Side-by-Side

Open a live web page **beside** your slide with a single click.
Great for live demos, API docs, and running local apps.

[Open MDN Docs](action:browser.open?url=https://developer.mozilla.org/en-US/docs/Web/API&title=MDN%20Web%20APIs)

---

# Navigate Without Reopening

Once the panel is open, `browser.navigate` changes the URL **in-place** —
no flash, no new window.

[Go to Fetch API](action:browser.navigate?url=https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

[Go to WebSocket API](action:browser.navigate?url=https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

# Local Dev Server

Start your app, then open it instantly in the panel.

```action
type: sequence
label: 🚀 Start & open app
steps:
  - type: terminal.run
    command: npm run dev
    background: true
    name: Dev Server
  - type: browser.open
    url: http://localhost:5173
    title: Local App
    column: 2
```

---

# Live API Exploration

Walk your audience through an API — each slide navigates the panel.

## Slide 1 — Overview

[Open API Docs](action:browser.open?url=https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch&title=Fetch%20API)

---

## Slide 2 — Request

[→ Request object](action:browser.navigate?url=https://developer.mozilla.org/en-US/docs/Web/API/Request)

---

## Slide 3 — Response

[→ Response object](action:browser.navigate?url=https://developer.mozilla.org/en-US/docs/Web/API/Response)

---

# Inline Action Block

Use a fenced `action` block for richer control:

```action
type: browser.open
url: https://developer.mozilla.org/en-US/docs/Web/API/URL
title: URL API Reference
column: 2
```

---

# Column Options

| Value | Panel position |
|-------|---------------|
| `2` *(default)* | Side by side |
| `3` | Third column |
| `-1` | Beside active editor |

```action
type: browser.open
url: https://developer.mozilla.org/en-US/
title: MDN
column: -1
```

---

# Known Limitation

Sites that set `X-Frame-Options: DENY` (GitHub, Google) will show a blank panel.
This is enforced by the **site itself** — it cannot be bypassed.

For those, use a direct link instead:
[Open GitHub](https://github.com)

✅ Works great with: local dev servers, API docs, your own apps, localhost tools.
