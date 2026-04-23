---
title: "Browser Panel Demo"
---

<!-- id: intro -->

# Browser Panel

Deckpilot can open a live web browser **inside VS Code** — side by side with your slides.

Click the button below to try it:

[Open example.com](action:browser.open?url=https://example.com&title=Example&column=2)

> **Note:** Sites that use `X-Frame-Options: deny` (GitHub, Google, MDN…) will show
> a "can't embed" error — that's the website refusing, not a Deckpilot bug.
> Local servers (`http://localhost:PORT`) always work.

---

<!-- id: navigate -->

# Navigating the Browser

Once the panel is open, navigate it to any embeddable URL without closing and reopening.

[Open IANA example page](action:browser.navigate?url=https://example.com/index.html)

---

<!-- id: localhost -->

# Best Use Case: Local Servers

The browser panel really shines for `http://localhost` — start a dev server, open it
right next to your slides.

<!-- layout: columns -->

```bash
# Start a local server
python3 -m http.server 8080
```

[Open localhost:8080](action:browser.open?url=http://localhost:8080&title=Local+Server)
