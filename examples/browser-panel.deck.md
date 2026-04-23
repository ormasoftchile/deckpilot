---
title: "Browser Panel Demo"
---

<!-- id: intro -->

# Browser Panel

Deckpilot can open a live web browser **inside VS Code** — side by side with your slides.

Click the button below to try it:

[Open example.com](action:browser.open?url=https://example.com&title=Example&column=2)

---

<!-- id: navigate -->

# Navigating the Browser

Once the panel is open, you can navigate it to a new URL without closing and re-opening it.

[Go to GitHub](action:browser.navigate?url=https://github.com)

---

<!-- id: localhost -->

# Local Servers Too

The browser panel supports `https://` and `http://localhost` / `http://127.0.0.1` URLs.

<!-- layout: columns -->

```bash
# Start a local server
python3 -m http.server 8080
```

[Open localhost:8080](action:browser.open?url=http://localhost:8080&title=Local+Server)
