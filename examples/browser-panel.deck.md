---
title: "Browser Panel"
basePath: ..
---

<!-- id: intro -->

# Browser Panel — Side-by-Side

Open a live web page **beside** your slide — no alt-tab, no context switch.

Great for live demos, API walkthroughs, and running local apps.

---

<!-- id: open-docs -->

# Opening a URL

The `browser.open` action opens a **WebviewPanel** in column 2,
right next to your presentation.

The panel appears automatically when you enter this slide.

---

<!-- id: navigate-fetch -->

# Navigating In-Place

`browser.navigate` changes the URL **without reopening** the panel.

No flash. No new tab. The audience stays focused on your slide.

---

<!-- id: navigate-websocket -->

# Continuing the Tour

Each slide can drive the browser to the next destination.

Your deck becomes the navigation layer for the demo.

---

<!-- id: local-dev -->

# Local Dev Server

Use a `sequence` to start your app and open it in one click:

1. `terminal.run` — start the dev server in the background
2. `browser.open` — load `http://localhost:5173` in the panel

The panel opens as soon as the server is ready.

---

<!-- id: column-options -->

# Column Options

| `column` value | Panel position |
|---------------|----------------|
| `2` *(default)* | Side by side with the presentation |
| `3` | Third column |
| `-1` | Beside the currently active editor |

---

<!-- id: limitation -->

# Known Limitation

Sites that send `X-Frame-Options: DENY` — GitHub, Google, etc. —
will show a **blank panel**. This is enforced by the site and cannot be bypassed.

✅ Works great with: localhost dev servers, your own apps, API docs sites.

Use a plain link for sites that block framing:
[Open on GitHub](https://github.com)
