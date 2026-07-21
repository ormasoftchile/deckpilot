/**
 * Monarch tokenizer for the `deck-markdown` language (MVP quality).
 *
 * Covers the Deckpilot-specific syntax on top of Markdown:
 *  - ATX headings (`#`..`######`)
 *  - `---` slide / frontmatter delimiters
 *  - fenced code blocks, with special highlighting for the Deckpilot fences:
 *    ```mermaid, ```triton, ```diagram:*, ```action
 *  - action links: `[label](action:type?param=value)`
 *  - inline code, bold, emphasis, plain links
 *
 * Token names map to standard Monaco theme scopes so the stock `vs-dark`
 * theme colours everything without a custom theme.
 */
import type { languages } from 'monaco-editor/esm/vs/editor/editor.api';

export const deckMarkdownLanguage = {
  defaultToken: '',
  tokenPostfix: '.deckmd',

  // Special fence languages that get extra emphasis.
  specialFences: ['mermaid', 'triton', 'action'],

  tokenizer: {
    root: [
      // Slide / frontmatter delimiter.
      [/^\s*---\s*$/, 'comment.delimiter'],

      // Headings: marker + text.
      [/^(#{1,6})(\s.*)$/, ['keyword.heading', 'metatag.heading']],

      // Special Deckpilot fences (mermaid / triton / action).
      [/^(```+)(\s*)(mermaid|triton|action)\b(.*)$/, ['string.fence', '', 'type.fence.special', 'comment.fence.args'], '@codeblock'],

      // Diagram fence with a subtype (diagram:sequence, diagram:flow, ...).
      [/^(```+)(\s*)(diagram)(:)([\w-]+)(.*)$/, ['string.fence', '', 'type.fence.special', 'delimiter', 'attribute.value', 'comment.fence.args'], '@codeblock'],

      // Generic fenced code block.
      [/^(```+)(.*)$/, ['string.fence', 'comment.fence.args'], '@codeblock'],

      { include: '@inline' },
    ],

    codeblock: [
      [/^\s*(```+)\s*$/, 'string.fence', '@pop'],
      [/.*$/, 'variable.source'],
    ],

    inline: [
      // Action link: [label](action:type?params)
      [/(\[)([^\]]*)(\])(\()(action:)([\w.-]+)([^)]*)(\))/,
        ['delimiter.square', 'string.link', 'delimiter.square', 'delimiter.parenthesis', 'keyword.action', 'type.action', 'attribute.value', 'delimiter.parenthesis']],

      // Generic markdown link: [text](url)
      [/(\[)([^\]]*)(\])(\()([^)]*)(\))/,
        ['delimiter.square', 'string.link', 'delimiter.square', 'delimiter.parenthesis', 'string.link.url', 'delimiter.parenthesis']],

      // Inline code.
      [/`[^`]+`/, 'variable.code'],

      // Bold and emphasis.
      [/\*\*[^*]+\*\*/, 'strong'],
      [/__[^_]+__/, 'strong'],
      [/\*[^*]+\*/, 'emphasis'],
      [/_[^_]+_/, 'emphasis'],
    ],
  },
} as languages.IMonarchLanguage;

export const deckMarkdownConfiguration: languages.LanguageConfiguration = {
  comments: {
    blockComment: ['<!--', '-->'],
  },
  brackets: [
    ['[', ']'],
    ['(', ')'],
    ['{', '}'],
  ],
  autoClosingPairs: [
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '{', close: '}' },
    { open: '`', close: '`' },
    { open: '"', close: '"' },
  ],
  surroundingPairs: [
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '`', close: '`' },
    { open: '*', close: '*' },
    { open: '_', close: '_' },
  ],
  onEnterRules: [
    {
      // Continue unordered lists.
      beforeText: /^\s*[-*+]\s+.*$/,
      action: { indentAction: 0 /* None */, appendText: '- ' },
    },
  ],
};
