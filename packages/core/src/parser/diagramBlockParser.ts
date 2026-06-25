/**
 * Diagram Block Parser
 *
 * Detects fenced ```diagram:<language> code blocks in slide content,
 * extracts them into DiagramBlockRef records, and replaces them with
 * <!--DIAGRAM:id--> markers so markdown-it never sees them.
 *
 * Follows the same pattern as actionBlockParser.ts.
 */

import type { DiagramBlockRef, DiagramFenceInfo } from '../models/diagram';

/**
 * Matches ```diagram:<lang> <attrs?>\n...\n``` fences.
 * Allows up to 3 leading spaces so standard Markdown-indented fenced blocks
 * still parse as diagrams instead of falling back to plain code blocks.
 * Group 1 = language (e.g. "mermaid")
 * Group 2 = rest of info string after language (e.g. " {theme: dark}")
 * Group 3 = fence body
 */
const DIAGRAM_FENCE_PATTERN = /^[ \t]{0,3}```diagram:(\S+)([^\r\n]*)?\r?\n([\s\S]*?)^[ \t]{0,3}```\s*$/gm;

export interface DiagramBlockParseResult {
  /** Original content with diagram fences replaced by <!--DIAGRAM:id--> markers. */
  cleanedContent: string;
  /** Parsed diagram block references. */
  blocks: DiagramBlockRef[];
}

/**
 * Parse all diagram:* fenced blocks from slide content.
 * Returns DiagramBlockRef[] and cleaned content (fences replaced with markers).
 *
 * @param content    Raw slide content (markdown).
 * @param slideIndex Zero-based slide index.
 */
export function parseDiagramBlocks(
  content: string,
  slideIndex: number,
): DiagramBlockParseResult {
  console.log(`[DECK-DIAGRAM][diagramBlockParser] parseDiagramBlocks called. slideIndex=${slideIndex}, contentLength=${content.length}`);
  console.log(`[DECK-DIAGRAM][diagramBlockParser] content preview:`, content.substring(0, 200));
  const blocks: DiagramBlockRef[] = [];
  let counter = 0;

  const cleanedContent = content.replace(
    DIAGRAM_FENCE_PATTERN,
    (fullMatch, lang: string, infoRest: string, body: string, offset: number) => {
      const id = `diagram-${slideIndex}-${counter++}`;
      const fence: DiagramFenceInfo = {
        language: lang.trim(),
        attributes: parseAttributes(infoRest ?? ''),
      };

      blocks.push({
        id,
        slideIndex,
        source: body,
        fence,
        position: { start: offset, end: offset + fullMatch.length },
      });

      return `<!--DIAGRAM:${id}-->`;
    },
  );

  console.log(`[DECK-DIAGRAM][diagramBlockParser] found ${blocks.length} diagram blocks`);

  return { cleanedContent, blocks };
}

/**
 * Parse an optional inline attribute string into a key/value map.
 *
 * Accepts a loose JSON-like format with or without quotes:
 *   {theme: dark, caption: "My diagram", fragment: true}
 *
 * Returns undefined if the string is empty or contains no attributes.
 */
function parseAttributes(raw: string): Record<string, string> | undefined {
  const trimmed = raw.trim();
  if (!trimmed || !trimmed.startsWith('{')) {
    return undefined;
  }

  const result: Record<string, string> = {};
  // Strip braces
  const inner = trimmed.slice(1, trimmed.lastIndexOf('}')).trim();
  if (!inner) {
    return undefined;
  }

  // Split on commas not inside quotes
  const pairs = inner.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) {
      continue;
    }
    const key = pair.slice(0, colonIdx).trim().replace(/^["']|["']$/g, '');
    const value = pair.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
