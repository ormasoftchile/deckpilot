---
title: Terminal Test
author: Test
basePath: ..
---

<!-- voice: This is the terminal commands test. -->

# Terminal Commands Test

---

<!-- voice: Terminal commands run directly from your slides. -->

# Terminal Commands

<!-- voice[1]: Check the installed npm version. -->
[Show npm version](action:terminal.run?command=npm%20--version) <!-- .fragment -->

<!-- voice[2]: List the files in the project directory. -->

```action
type: terminal.run
label: List files
fragment: true
command:
  windows: dir
  macos: ls -la
  linux: ls -la
```

---

<!-- voice: That's the end of the test. -->

# Done
