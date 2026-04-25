/**
 * @deck Chat Participant — generates and converts .deck.md presentations.
 *
 * Slash commands:
 *   /create  — generate a new deck from a description
 *   /convert — convert an existing .md file into a .deck.md
 *   /enrich  — add voice cues, fragments, and actions to an existing deck
 *   (no command) — freeform deck-related questions and generation
 */

import * as vscode from 'vscode';

const PARTICIPANT_ID = 'executableTalk.deck';

/**
 * System prompt that teaches the LLM the .deck.md format.
 */
const DECK_SYSTEM_PROMPT = `You are an expert at creating Deckpilot presentations (.deck.md files).

## Format Rules

A .deck.md file is a Markdown file with these conventions:

### Frontmatter (YAML at the top)
\`\`\`yaml
---
title: Presentation Title
author: Author Name
basePath: ..          # optional — resolves relative paths from deck's directory
options:
  zenMode: false      # optional — enter VS Code Zen Mode on start
---
\`\`\`

### Slides
Slides are separated by \`---\` on its own line (horizontal rule).

### Speaker Notes
Notes go in a frontmatter block before the slide content:
\`\`\`
---
notes: These are speaker notes for the next slide.
---

# Slide Title
\`\`\`
The notes block merges into the following slide automatically.

### Action Links (inline)
\`[Label](action:type?param=value)\`

Action types:
- \`file.open\` — opens a file: \`[Open main.ts](action:file.open?path=src/main.ts)\`
- \`editor.highlight\` — highlights lines: \`[Show lines](action:editor.highlight?path=src/main.ts&lines=10-20)\`
- \`terminal.run\` — runs a command: \`[Run build](action:terminal.run?command=npm%20run%20build)\`
- \`vscode.command\` — executes VS Code command: \`[Settings](action:vscode.command?id=workbench.action.openSettings)\`
- \`sequence\` — multiple actions in order
- \`debug.start\` — starts debug session

URL-encode special characters in params (%20 for space, %26 for &, etc.)

### YAML Action Blocks (human-readable alternative)
\`\`\`
\`\`\`action
type: file.open
path: src/main.ts
label: Open main.ts
\`\`\`
\`\`\`

For cross-platform terminal commands:
\`\`\`
\`\`\`action
type: terminal.run
label: List files
command:
  win32: dir
  darwin: ls -la
  linux: ls -la
\`\`\`
\`\`\`

### Fragments (progressive reveal)
Add \`<!-- .fragment -->\` after an element to reveal it on click:
\`\`\`markdown
- First point <!-- .fragment -->
- Second point <!-- .fragment -->
- Third point <!-- .fragment -->

**Key takeaway:** shown after all bullets <!-- .fragment -->
\`\`\`

**IMPORTANT**: Once any element on a slide is a fragment, every element that comes after it must also be a fragment. Non-fragment content after a fragment list renders immediately — before any fragment is revealed — which breaks the reveal order.

For action blocks, wrap in a div:
\`\`\`markdown
<div class="fragment"> <!-- .fragment -->

\`\`\`action
type: terminal.run
command: echo "revealed!"
label: Run
\`\`\`

</div>
\`\`\`

### Voice-Over Cues (for recording mode)
Slide-level: \`<!-- voice: What to say on this slide -->\`
Fragment-level: \`<!-- voice[1]: What to say when fragment 1 reveals -->\`

Voice cues are invisible during presentation. They appear in the exported
voice-over script and SRT captions when recording mode is used.

### Render Directives (embed live content)
- File: \`[](render:file?path=package.json&lines=1-10)\`
- Command output: \`[](render:command?cmd=npm%20--version)\`
- Git diff: \`[](render:diff?path=src/main.ts&before=HEAD~1)\`

## Guidelines for Creating Decks

1. Start with a title slide (first slide, uses deck frontmatter title)
2. One concept per slide — keep slides focused
3. Use fragments to build up complex ideas step by step
4. Add action links for live demonstrations — don't just describe, show
5. Use voice cues on every slide — they drive the narration script
6. Use speaker notes for presenter reminders (not shown to audience)
7. End with a summary or closing slide
8. Terminal commands should use cross-platform YAML blocks when possible
9. Use \`basePath: ..\` when the deck is in a subdirectory but references root files
10. Keep slide text concise — the actions and demos are the star

## When Converting Markdown to Deck

- Split on natural heading boundaries (# and ##)
- Convert code blocks into action links or render directives where appropriate
- Convert bullet lists into fragments for progressive reveal
- **Fragment consistency rule**: once a slide uses \`<!-- .fragment -->\`, ALL content that appears AFTER the first fragment marker must also be a fragment. Non-fragment content (paragraphs, bold text, callouts) that follows a fragment list would appear on screen BEFORE the fragments are revealed, which is confusing. Mark them with \`<!-- .fragment -->\` too.
- Add voice cues that paraphrase each slide's content in spoken language
- Add a frontmatter block with title and author
- Keep the original content structure but make it presentation-friendly

## When Creating from Description

- Ask about the target audience and platform if not specified
- Create a logical flow: intro → prerequisites → steps → verification → summary
- Include terminal commands for installation/build steps
- Include file.open actions for config files and code
- Include editor.highlight for key code sections
- Use fragments to reveal steps progressively
- Write voice cues as natural spoken narration

### Sidecar File (.deck.yaml)
A companion file (same name, .deck.yaml extension) stores operational metadata separately from content:
\`\`\`yaml
deck:
  title: Presentation Title
  theme: dark          # optional: light | dark

slides:
  - id: slide-slug    # matches <!-- id: slide-slug --> in the .deck.md
    cues:
      - "What to say when this slide appears"
    duration: 10s
    actions:
      - type: terminal.run
        cmd: npm start
    notes: "Presenter reminder (optional)"

recording:
  autoStart: false
  format: mp4

export:
  subtitles: true
  video: true
  srtFormat: srt
\`\`\`

To link slides to sidecar entries, add \`<!-- id: slug -->\` comments in the markdown, one per slide, right after the \`---\` slide separator.`;

/**
 * URI of the last .md file that had editor focus.
 * Updated whenever the active editor changes so that when the chat panel
 * steals focus (setting activeTextEditor to undefined) we still know which
 * file the user was working on.
 */
let lastActiveMdUri: vscode.Uri | undefined;

/**
 * Best-effort: return the URI of the most recently focused .md (non-deck) file.
 *
 * `vscode.window.activeTextEditor` returns undefined once the chat panel
 * steals focus. `tabGroups.activeTabGroup.activeTab` persists the last active
 * text tab even after a webview/panel opens — this is the reliable source.
 */
function resolveActiveMdUri(): vscode.Uri | undefined {
  // 1. Active tab in current editor tab group
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (activeTab?.input instanceof vscode.TabInputText) {
    const uri = activeTab.input.uri;
    if (isConvertibleMd(uri.fsPath)) {
      return uri;
    }
  }

  // 2. Last known active .md file (persisted across panel focus changes)
  if (lastActiveMdUri) {
    return lastActiveMdUri;
  }

  // 3. Scan all editor tab groups — find any open convertible .md file
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputText) {
        const uri = tab.input.uri;
        if (isConvertibleMd(uri.fsPath)) {
          return uri;
        }
      }
    }
  }

  return undefined;
}

/**
 * Best-effort: return the URI of the most recently focused .deck.md file.
 */
function resolveActiveDeckUri(): vscode.Uri | undefined {
  // 1. Active tab in current editor tab group
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (activeTab?.input instanceof vscode.TabInputText) {
    const uri = activeTab.input.uri;
    if (uri.fsPath.endsWith('.deck.md')) {
      return uri;
    }
  }

  // 2. Scan all editor tab groups — find any open .deck.md file
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputText) {
        const uri = tab.input.uri;
        if (uri.fsPath.endsWith('.deck.md')) {
          return uri;
        }
      }
    }
  }

  return undefined;
}

/**
 * Register the @deck chat participant.
 */
export function registerDeckParticipant(context: vscode.ExtensionContext): vscode.Disposable {
  // Seed with current editor in case extension activates while a .md file is open
  const current = vscode.window.activeTextEditor;
  if (current && isConvertibleMd(current.document.uri.fsPath)) {
    lastActiveMdUri = current.document.uri;
  }

  // Also seed from all currently visible editors (covers case where extension
  // activates while chat is focused and activeTextEditor is undefined)
  for (const editor of vscode.window.visibleTextEditors) {
    if (isConvertibleMd(editor.document.uri.fsPath)) {
      lastActiveMdUri = editor.document.uri;
      break;
    }
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isConvertibleMd(editor.document.uri.fsPath)) {
        lastActiveMdUri = editor.document.uri;
      }
    }),
  );

  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handleRequest);

  participant.iconPath = new vscode.ThemeIcon('file-media');

  participant.followupProvider = {
    provideFollowups(result: DeckChatResult, _context, _token) {
      const followups: vscode.ChatFollowup[] = [];
      if (result.command === 'create') {
        followups.push({
          prompt: 'Add voice cues to this deck',
          command: 'enrich',
          label: 'Add voice cues',
        });
        followups.push({
          prompt: 'Add more fragments for progressive reveal',
          command: 'enrich',
          label: 'Add fragments',
        });
      }
      if (result.command === 'convert') {
        followups.push({
          prompt: 'Enrich with actions and voice cues',
          command: 'enrich',
          label: 'Enrich this deck',
        });
      }
      return followups;
    },
  };

  context.subscriptions.push(participant);
  return participant;
}

interface DeckChatResult extends vscode.ChatResult {
  command?: string;
}

/**
 * Main request handler for the @deck participant.
 */
async function handleRequest(
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<DeckChatResult> {
  const command = request.command;

  // Select model
  const [model] = await vscode.lm.selectChatModels({
    vendor: 'copilot',
    family: 'gpt-4o',
  });

  if (!model) {
    stream.markdown('No language model available. Make sure GitHub Copilot is active.');
    return {};
  }

  switch (command) {
    case 'create':
      return handleCreate(request, context, stream, model, token);
    case 'convert':
      return handleConvert(request, context, stream, model, token);
    case 'enrich':
      return handleEnrich(request, context, stream, model, token);
    default:
      return handleFreeform(request, context, stream, model, token);
  }
}

/**
 * /create — Generate a new deck from a description.
 */
async function handleCreate(
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
): Promise<DeckChatResult> {
  stream.progress('Designing your presentation...');

  // --- parse meta-preferences from prompt ---
  const rawPrompt = request.prompt;

  // Filename: "name it foo.deck.md" / "call it foo" / "save as foo.deck.md"
  const filenameMatch =
    rawPrompt.match(/\bname\s+it\s+([\w.\-]+(?:\.deck\.md)?)/i) ||
    rawPrompt.match(/\bcall\s+it\s+([\w.\-]+(?:\.deck\.md)?)/i) ||
    rawPrompt.match(/\bsave\s+(?:as|to)\s+([\w.\-]+(?:\.deck\.md)?)/i);
  let userFilename = filenameMatch?.[1];
  if (userFilename && !userFilename.endsWith('.deck.md')) {
    userFilename += '.deck.md';
  }

  // Feature preferences
  const wantsSidecar = /\bwith\s+sidecar\b/i.test(rawPrompt);
  const wantsZenMode = /\bzen\s+mode\b/i.test(rawPrompt);

  // Strip meta-instructions — leave only the content description
  const contentDescription = rawPrompt
    .replace(/\bname\s+it\s+[\w.\-]+(?:\.deck\.md)?/gi, '')
    .replace(/\bcall\s+it\s+[\w.\-]+(?:\.deck\.md)?/gi, '')
    .replace(/\bsave\s+(?:as|to)\s+[\w.\-]+(?:\.deck\.md)?/gi, '')
    .replace(/\bwith\s+sidecar\b/gi, '')
    .replace(/\bwithout\s+sidecar\b/gi, '')
    .replace(/\bzen\s+mode\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const zenModeInstruction = wantsZenMode
    ? 'Include `options:\\n  zenMode: true` in the deck frontmatter. '
    : '';

  const messages = [
    vscode.LanguageModelChatMessage.User(DECK_SYSTEM_PROMPT),
    vscode.LanguageModelChatMessage.User(
      `Create a complete .deck.md presentation based on this description:\n\n${contentDescription}\n\n` +
      'Output ONLY the .deck.md file content — no explanations, no wrapping code fences around the entire file. ' +
      'Start directly with the YAML frontmatter (---). ' +
      zenModeInstruction +
      'Include voice cues on every slide. Use fragments where they help build up ideas. ' +
      'Use action links and YAML action blocks for any demonstrations.',
    ),
  ];

  const response = await model.sendRequest(messages, {}, token);

  let deckContent = '';
  for await (const chunk of response.text) {
    deckContent += chunk;
  }

  // Strip accidental wrapping code fences the model may have added
  deckContent = deckContent
    .replace(/^```(?:markdown|deck-markdown|yaml|md)?\r?\n/, '')
    .replace(/\r?\n```\s*$/, '')
    .trim();

  const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
  let defaultUri: vscode.Uri | undefined;
  if (userFilename) {
    defaultUri = ws ? vscode.Uri.joinPath(ws, userFilename) : vscode.Uri.file(userFilename);
  } else {
    const slug = contentDescription.trim().split(/\s+/).slice(0, 5).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'presentation';
    defaultUri = ws ? vscode.Uri.joinPath(ws, `${slug}.deck.md`) : undefined;
  }

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri,
    filters: { 'Deckpilot Presentation': ['deck.md'] },
    saveLabel: 'Save Deck',
  });

  if (saveUri) {
    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(deckContent, 'utf-8'));
    await vscode.window.showTextDocument(saveUri, { preview: false });
    const slideCount = (deckContent.match(/^---$/gm) ?? []).length + 1;
    stream.markdown(`✅ Created \`${vscode.workspace.asRelativePath(saveUri)}\` — **${slideCount} slides**.\n`);
    stream.anchor(saveUri, 'Open deck file');
    stream.button({ command: 'executableTalk.openPresentation', title: '▶ Start Presentation' });

    if (wantsSidecar) {
      stream.progress('Generating sidecar...');
      const sidecarMessages = [
        vscode.LanguageModelChatMessage.User(DECK_SYSTEM_PROMPT),
        vscode.LanguageModelChatMessage.User(
          `Here is a .deck.md file:\n\n\`\`\`\n${deckContent}\n\`\`\`\n\n` +
          'Generate a companion .deck.yaml sidecar file for this deck. ' +
          'Include a slides array where each entry has an id (matching a <!-- id: slug --> marker you would add to the markdown), ' +
          'cues (1-2 sentence spoken narration), and estimated duration. ' +
          'Include a recording section with autoStart: false. ' +
          'Output ONLY the YAML — no explanations, no code fences.',
        ),
      ];
      const sidecarResponse = await model.sendRequest(sidecarMessages, {}, token);
      let sidecarContent = '';
      for await (const chunk of sidecarResponse.text) {
        sidecarContent += chunk;
      }
      sidecarContent = sidecarContent
        .replace(/^```(?:yaml)?\r?\n/, '')
        .replace(/\r?\n```\s*$/, '')
        .trim();
      const sidecarUri = vscode.Uri.file(saveUri.fsPath.replace(/\.deck\.md$/, '.deck.yaml'));
      await vscode.workspace.fs.writeFile(sidecarUri, Buffer.from(sidecarContent, 'utf-8'));
      stream.markdown(`✅ Created sidecar \`${vscode.workspace.asRelativePath(sidecarUri)}\`.\n`);
      stream.anchor(sidecarUri, 'Open sidecar file');
    }
  } else {
    // User cancelled the save dialog — fall back to showing in chat
    stream.markdown(deckContent);
    stream.markdown('\n\n---\n*Save this as a `.deck.md` file and run `Deckpilot: Start Presentation`.*');
  }

  return { command: 'create' };
}

/**
 * /convert — Convert an existing Markdown file into a .deck.md.
 */
async function handleConvert(
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
): Promise<DeckChatResult> {
  // Prefer explicit #file references (range defined) over implicit active-editor injection
  let sourceContent = '';
  let sourceUri: vscode.Uri | undefined;

  const resolved = await resolveMarkdownReference(
    request.references,
    p => p.endsWith('.md') && !p.endsWith('.deck.md'),
  );

  if (resolved) {
    sourceContent = resolved.content;
    sourceUri = resolved.uri;
    // If content came from a string ref (no URI), try active editor as URI
    if (!sourceUri) {
      const activeUri = resolveActiveMdUri();
      if (activeUri) {
        sourceUri = activeUri;
      }
    }
  } else {
    // Fall back to the active tab — reliable even after chat panel steals focus
    const fallbackUri = resolveActiveMdUri();
    if (fallbackUri) {
      try {
        const data = await vscode.workspace.fs.readFile(fallbackUri);
        sourceContent = Buffer.from(data).toString('utf-8');
        sourceUri = fallbackUri;
      } catch {
        // file may have been closed/deleted
      }
    }
  }

  if (sourceUri) {
    const label = vscode.workspace.asRelativePath(sourceUri);
    stream.progress(`Converting ${label}...`);
    stream.markdown(`📄 Converting **${label}**\n\n`);
  }

  if (!sourceContent) {
    stream.markdown(
      'No Markdown file found. Please reference it explicitly:\n\n' +
      '```\n@deck /convert #file:README.md\n```',
    );
    return { command: 'convert' };
  }

  stream.progress('Converting to deck format...');

  const messages = [
    vscode.LanguageModelChatMessage.User(DECK_SYSTEM_PROMPT),
    vscode.LanguageModelChatMessage.User(
      'Convert this Markdown content into a .deck.md presentation:\n\n' +
      '```markdown\n' + sourceContent + '\n```\n\n' +
      'Output ONLY the .deck.md file content — no explanations, no wrapping code fences around the entire file. ' +
      'Start directly with the YAML frontmatter (---). ' +
      'Split on natural heading boundaries. Add voice cues on every slide. ' +
      'Convert code references into action links. Add fragments for lists. ' +
      'Keep the original content and structure but make it presentation-friendly.',
    ),
  ];

  const response = await model.sendRequest(messages, {}, token);

  let deckContent = '';
  for await (const chunk of response.text) {
    deckContent += chunk;
  }

  // Strip accidental wrapping code fences the model may have added
  deckContent = deckContent
    .replace(/^```(?:markdown|deck-markdown|yaml|md)?\r?\n/, '')
    .replace(/\r?\n```\s*$/, '')
    .trim();

  // Strip stray ``` that the model sometimes inserts right after the deck frontmatter
  // e.g.  ---\n(frontmatter)\n---\n```\n# Slide → renders first slide as a code block
  deckContent = deckContent.replace(/(^---\n[\s\S]*?\n---)\n```\n/, '$1\n\n');

  if (sourceUri) {
    const outputUri = vscode.Uri.file(sourceUri.fsPath.replace(/\.md$/, '.deck.md'));
    await vscode.workspace.fs.writeFile(outputUri, Buffer.from(deckContent, 'utf-8'));
    await vscode.window.showTextDocument(outputUri, { preview: false });
    const slideCount = (deckContent.match(/^---$/gm) ?? []).length + 1;
    stream.markdown(`✅ Created \`${vscode.workspace.asRelativePath(outputUri)}\` — **${slideCount} slides**.\n`);
    stream.anchor(outputUri, 'Open deck file');
    stream.button({ command: 'executableTalk.openPresentation', title: '▶ Start Presentation' });
  } else {
    // No source URI tracked (shouldn't happen) — fall back to showing in chat
    stream.markdown(deckContent);
    stream.markdown('\n\n---\n*Save this as a `.deck.md` file.*');
  }

  return { command: 'convert' };
}

/**
 * /enrich — Add voice cues, fragments, and actions to an existing deck.
 */
async function handleEnrich(
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
): Promise<DeckChatResult> {
  // Prefer explicit #file references (range defined) over implicit active-editor injection
  let deckContent = '';
  let deckUri: vscode.Uri | undefined;

  const resolved = await resolveMarkdownReference(
    request.references,
    p => p.endsWith('.deck.md'),
  );

  if (resolved) {
    deckContent = resolved.content;
    deckUri = resolved.uri;
    if (!deckUri) {
      const activeUri = resolveActiveDeckUri();
      if (activeUri) {
        deckUri = activeUri;
      }
    }
  } else {
    const fallbackUri = resolveActiveDeckUri();
    if (fallbackUri) {
      try {
        const data = await vscode.workspace.fs.readFile(fallbackUri);
        deckContent = Buffer.from(data).toString('utf-8');
        deckUri = fallbackUri;
      } catch {
        // ignore
      }
    }
  }

  if (deckUri) {
    const label = vscode.workspace.asRelativePath(deckUri);
    stream.progress(`Enriching ${label}...`);
    stream.markdown(`📄 Enriching **${label}**\n\n`);
  }

  if (!deckContent) {
    stream.markdown('Please reference a `.deck.md` file with `#file` or have one open in the editor.');
    return { command: 'enrich' };
  }

  const enrichPrompt = request.prompt || 'Add voice cues, fragments for progressive reveal, and any missing action links';

  stream.progress('Enriching deck...');

  const messages = [
    vscode.LanguageModelChatMessage.User(DECK_SYSTEM_PROMPT),
    vscode.LanguageModelChatMessage.User(
      `Here is an existing .deck.md file:\n\n\`\`\`\n${deckContent}\n\`\`\`\n\n` +
      `Enrich this deck: ${enrichPrompt}\n\n` +
      'Output ONLY the complete updated .deck.md file content — no explanations. ' +
      'Start directly with the YAML frontmatter (---). ' +
      'Preserve all existing content and structure. Add what was requested.',
    ),
  ];

  const response = await model.sendRequest(messages, {}, token);

  let enrichedContent = '';
  for await (const chunk of response.text) {
    enrichedContent += chunk;
  }

  // Strip accidental wrapping code fences the model may have added
  enrichedContent = enrichedContent
    .replace(/^```(?:markdown|deck-markdown|yaml|md)?\r?\n/, '')
    .replace(/\r?\n```\s*$/, '')
    .trim();

  if (deckUri) {
    await vscode.workspace.fs.writeFile(deckUri, Buffer.from(enrichedContent, 'utf-8'));
    await vscode.window.showTextDocument(deckUri, { preview: false });
    stream.markdown(`✅ Enriched \`${vscode.workspace.asRelativePath(deckUri)}\` — saved to disk.\n`);
    stream.button({ command: 'executableTalk.openPresentation', title: '▶ Start Presentation' });
  } else {
    // No deckUri tracked — fall back to showing in chat
    stream.markdown(enrichedContent);
    stream.markdown('\n\n---\n*Save this as a `.deck.md` file.*');
  }

  return { command: 'enrich' };
}

/**
 * Freeform — no slash command, handle general deck questions.
 */
async function handleFreeform(
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
): Promise<DeckChatResult> {
  stream.progress('Thinking...');

  const messages = [
    vscode.LanguageModelChatMessage.User(DECK_SYSTEM_PROMPT),
    vscode.LanguageModelChatMessage.User(request.prompt),
  ];

  const response = await model.sendRequest(messages, {}, token);

  for await (const chunk of response.text) {
    stream.markdown(chunk);
  }

  return {};
}

function isConvertibleMd(fsPath: string): boolean {
  return fsPath.endsWith('.md') && !fsPath.endsWith('.deck.md');
}

/**
 * Resolve the best matching Markdown reference from a list of chat prompt references.
 *
 * Explicit references (ref.range !== undefined) are tried before implicit ones
 * (VS Code automatically injects the active editor as an implicit reference).
 * If ref.value is a string it is returned directly as inline content.
 */
async function resolveMarkdownReference(
  refs: readonly vscode.ChatPromptReference[],
  filter: (path: string) => boolean,
): Promise<{ content: string; uri?: vscode.Uri } | undefined> {
  // Sort: explicit (range defined) before implicit (range undefined)
  const sorted = [...refs].sort((a, b) => {
    const aExplicit = a.range !== undefined ? 0 : 1;
    const bExplicit = b.range !== undefined ? 0 : 1;
    return aExplicit - bExplicit;
  });

  // First pass: URI-based refs (always preferred — they carry a file path)
  for (const ref of sorted) {
    let uri: vscode.Uri | undefined;
    if (ref.value instanceof vscode.Uri) {
      uri = ref.value;
    } else if (ref.value instanceof vscode.Location) {
      uri = ref.value.uri;
    }
    if (uri && uri.scheme === 'file' && filter(uri.fsPath)) {
      try {
        const data = await vscode.workspace.fs.readFile(uri);
        return { content: Buffer.from(data).toString('utf-8'), uri };
      } catch {
        // ignore read errors, try next
      }
    }
  }

  // Second pass: string refs (inline content — no URI available)
  for (const ref of sorted) {
    if (typeof ref.value === 'string' && ref.value.trim()) {
      return { content: ref.value };
    }
  }

  return undefined;
}
