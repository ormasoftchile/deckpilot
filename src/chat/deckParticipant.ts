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
const DECK_SYSTEM_PROMPT = `You are an expert at creating Executable Talk presentations (.deck.md files).

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
\`\`\`

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
- Write voice cues as natural spoken narration`;

/**
 * Register the @deck chat participant.
 */
export function registerDeckParticipant(context: vscode.ExtensionContext): vscode.Disposable {
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

  const messages = [
    vscode.LanguageModelChatMessage.User(DECK_SYSTEM_PROMPT),
    vscode.LanguageModelChatMessage.User(
      `Create a complete .deck.md presentation based on this description:\n\n${request.prompt}\n\n` +
      'Output ONLY the .deck.md file content — no explanations, no wrapping code fences around the entire file. ' +
      'Start directly with the YAML frontmatter (---). ' +
      'Include voice cues on every slide. Use fragments where they help build up ideas. ' +
      'Use action links and YAML action blocks for any demonstrations.',
    ),
  ];

  const response = await model.sendRequest(messages, {}, token);

  for await (const chunk of response.text) {
    stream.markdown(chunk);
  }

  stream.markdown('\n\n---\n*Save this as a `.deck.md` file and run `Executable Talk: Start Presentation`.*');

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
  // Try to get content from referenced file
  let sourceContent = '';
  for (const ref of request.references) {
    if (ref.value instanceof vscode.Uri) {
      try {
        const data = await vscode.workspace.fs.readFile(ref.value);
        sourceContent = Buffer.from(data).toString('utf-8');
        stream.progress(`Converting ${ref.value.fsPath}...`);
      } catch {
        // ignore read errors
      }
    } else if (typeof ref.value === 'string') {
      sourceContent = ref.value;
    }
  }

  // Fall back to the active editor if no file was explicitly referenced
  if (!sourceContent) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.fileName.endsWith('.md') && !editor.document.fileName.endsWith('.deck.md')) {
      sourceContent = editor.document.getText();
      stream.progress(`Converting ${vscode.workspace.asRelativePath(editor.document.uri)}...`);
    }
  }

  if (!sourceContent && request.prompt) {
    sourceContent = request.prompt;
  }

  if (!sourceContent) {
    stream.markdown(
      'Please reference the Markdown file you want to convert:\n\n' +
      '```\n@deck /convert #file:README.md\n```\n\n' +
      'Or open the Markdown file in the editor before calling `@deck /convert`.',
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

  for await (const chunk of response.text) {
    stream.markdown(chunk);
  }

  stream.markdown('\n\n---\n*Save this as a `.deck.md` file.*');

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
  // Try to get deck content from referenced file or active editor
  let deckContent = '';
  for (const ref of request.references) {
    if (ref.value instanceof vscode.Uri) {
      try {
        const data = await vscode.workspace.fs.readFile(ref.value);
        deckContent = Buffer.from(data).toString('utf-8');
        stream.progress(`Enriching ${ref.value.fsPath}...`);
      } catch {
        // ignore
      }
    } else if (typeof ref.value === 'string') {
      deckContent = ref.value;
    }
  }

  if (!deckContent) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.fileName.endsWith('.deck.md')) {
      deckContent = editor.document.getText();
      stream.progress(`Enriching ${editor.document.fileName}...`);
    }
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

  for await (const chunk of response.text) {
    stream.markdown(chunk);
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
