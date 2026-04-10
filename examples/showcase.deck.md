---
title: Executable Talk - Feature Showcase
author: Executable Talk Team
description: A comprehensive demo of all extension features
basePath: ..
---

# 🎭 Executable Talk

## Transform Presentations into Live Demos

*Press `→` or `Space` to begin the journey*

---
notes: Welcome the audience. Explain that this presentation is itself built with Executable Talk - it's self-demonstrating!
---

# What is Executable Talk?

A VS Code extension that transforms **Markdown presentations** into **executable narratives**.

✨ Write slides in familiar Markdown
🎯 Embed live code demonstrations
⏪ Undo mistakes with state management
🔒 Secure with Workspace Trust

---

# Navigation Basics

Use these keys to navigate:

| Key | Action |
|-----|--------|
| `→` `↓` `Space` | Next slide |
| `←` `↑` `Backspace` | Previous slide |
| `Home` | First slide |
| `End` | Last slide |
| `Escape` | Exit presentation |

---
notes: Point out the floating toolbar in the bottom-right corner. It appears on hover!
---

# 🛠️ The Floating Toolbar

Hover over the presentation to reveal quick toggles:

| Icon | Action |
|------|--------|
| ◧ | Toggle Sidebar |
| ◫ | Toggle Panel |
| ⌨ | Toggle Terminal |
| ☰ | Toggle Activity Bar |
| ⛶ | Toggle Zen Mode |

*Try it now! Hover in the bottom-right corner →*

---

# 📂 Action: Open Files

Click to open files directly from your presentation:

[Open Extension Entry Point](action:file.open?path=src/extension.ts)

[Open the Conductor](action:file.open?path=src/conductor/conductor.ts)

[View This Presentation](action:file.open?path=examples/showcase.deck.md)

---
notes: Demonstrate that files open in the editor behind the presentation. The audience can see the code!
---

# 🔦 Action: Highlight Code

Draw attention to specific lines:

[Show Extension Activation](action:editor.highlight?path=src/extension.ts&lines=1-20)

[Highlight the Conductor Class](action:editor.highlight?path=src/conductor/conductor.ts&lines=26-40)

[See Action Registry](action:editor.highlight?path=src/actions/registry.ts&lines=1-30)

---

# 📦 Dynamic Content: Embed Files

Embed live file contents directly in slides!

**The Extension Manifest:**

[](render:file?path=package.json&lines=1-10&format=json)

*This content is read live from the file!*

---

# 📄 More File Embedding

**TypeScript Code Example:**

[](render:file?path=src/models/action.ts&lines=1-25&format=typescript)

---

# 💻 Action: Run Terminal Commands

Execute commands during your demo:

[Check Node Version](action:terminal.run?command=node%20--version)

[List Source Files](action:terminal.run?command=ls%20-la%20src/)

[Show Git Status](action:terminal.run?command=git%20status%20--short)

> ⚠️ Requires Workspace Trust

---
notes: These commands actually run in VS Code's integrated terminal. Great for live demos!
---

# 📊 Dynamic Content: Command Output

Embed command output directly in slides:

**Current Directory:**

[](render:command?cmd=pwd)

**Git Branch:**

[](render:command?cmd=git%20branch%20--show-current)

---

# 🔀 Dynamic Content: Git Diffs

Show what changed in your code:

[](render:diff?ref=HEAD~1&path=package.json)

*Perfect for code review presentations!*

---

# 🎮 Action: VS Code Commands

Execute any VS Code command:

[Open Settings](action:vscode.command?id=workbench.action.openSettings)

[Open Keyboard Shortcuts](action:vscode.command?id=workbench.action.openGlobalKeybindings)

[Toggle Minimap](action:vscode.command?id=editor.action.toggleMinimap)

[Focus Terminal](action:vscode.command?id=workbench.action.terminal.focus)

---

# 🐛 Action: Start Debugging

Launch debug sessions from your slides:

[Start Debugging](action:debug.start?config=Extension)

> ⚠️ Requires a matching launch configuration
> ⚠️ Requires Workspace Trust

---
notes: Make sure you have a launch.json with a configuration named "Extension" for this to work.
---

# 🔗 Action: Sequences

Chain multiple actions together:

[Complete Demo Setup](action:sequence?actions=%5B%7B%22type%22%3A%22file.open%22%2C%22params%22%3A%7B%22path%22%3A%22src%2Fextension.ts%22%7D%7D%2C%7B%22type%22%3A%22editor.highlight%22%2C%22params%22%3A%7B%22path%22%3A%22src%2Fextension.ts%22%2C%22lines%22%3A%221-10%22%7D%7D%5D)

This sequence:
1. Opens `src/extension.ts`
2. Highlights lines 1-10

---

# ⏪ Undo & Redo

Made a mistake? No problem!

| Shortcut | Action |
|----------|--------|
| `Cmd+Z` / `Ctrl+Z` | Undo IDE changes |
| `Cmd+Shift+Z` / `Ctrl+Y` | Redo |

The extension tracks:
- Open editors
- Terminal state
- Decorations
- Up to **50 snapshots**

---
notes: This is a killer feature for live demos - you can always recover from mistakes!
---

# 🎤 Presenter View

Open the Presenter View for speaker notes:

**Command Palette → "Executable Talk: Open Presenter View"**

Features:
- 🕐 Real-time clock
- 📝 Speaker notes (like this one!)
- 👁️ Current slide preview
- ⏭️ Next slide preview

---
notes: The presenter view shows these notes! Great for keeping track of talking points without the audience seeing them.
---

# 🔒 Workspace Trust

For security, certain actions require trust:

| Action | Requires Trust |
|--------|----------------|
| `file.open` | ❌ No |
| `editor.highlight` | ❌ No |
| `vscode.command` | ✅ Yes |
| `terminal.run` | ✅ Yes |
| `debug.start` | ✅ Yes |

---

# 📝 Slide Syntax

Slides are separated by `---`:

```markdown
---
title: My Presentation
author: Your Name
---

# First Slide

Content here...

---
notes: Speaker notes go in YAML frontmatter
---

# Second Slide

More content...
```

---

# 🎨 Action Link Syntax

```markdown
[Label](action:type?param1=value1&param2=value2)
```

**Examples:**

```markdown
[Open File](action:file.open?path=src/main.ts)

[Highlight](action:editor.highlight?path=src/main.ts&lines=5-10)

[Run](action:terminal.run?command=npm%20test)
```

---

# 📊 Render Directive Syntax

```markdown
[](render:file?path=src/main.ts&lines=1-20&format=typescript)

[](render:command?cmd=git%20status)

[](render:diff?ref=HEAD~1&path=package.json)
```

---

# 🚀 Getting Started

1. Create a `.deck.md` file
2. Write your slides in Markdown
3. Add action links and render directives
4. Run **"Executable Talk: Start Presentation"**

[Open the Demo Deck](action:file.open?path=examples/demo.deck.md)

---

# 🎉 Thank You!

**Executable Talk** transforms your presentations into unforgettable experiences.

- 📖 [View on GitHub](https://github.com/ormasoftchile/executable-talk)
- 🐛 [Report Issues](https://github.com/ormasoftchile/executable-talk/issues)
- ⭐ Star us if you find it useful!

*Press `Escape` to exit*

---
notes: Thank the audience! Invite questions. Remind them to star the repo!
---
