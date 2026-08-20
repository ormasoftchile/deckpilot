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
 * Matches ```diagram:<lang> <attrs?>\n...\n``` or simple ```triton / ```mermaid fences.
 * Allows up to 3 leading spaces so standard Markdown-indented fenced blocks
 * still parse as diagrams instead of falling back to plain code blocks.
 * Group 1 = explicit diagram language (e.g. "mermaid" from "diagram:mermaid")
 * Group 2 = simple fence language (e.g. "triton" or "mermaid")
 * Group 3 = rest of info string after language (e.g. " {theme: dark}")
 * Group 4 = fence body
 */
const DIAGRAM_FENCE_PATTERN =
  /^[ \t]{0,3}```(?:diagram:(\S+)|(triton|mermaid))([^\r\n]*)?\r?\n([\s\S]*?)^[ \t]{0,3}```\s*$/gm;

export interface DiagramBlockParseResult {
  /** Original content with diagram fences replaced by <!--DIAGRAM:id--> markers. */
  cleanedContent: string;
  /** Parsed diagram block references. */
  blocks: DiagramBlockRef[];
}

/**
 * Parse all diagram fences (```diagram:<lang>, ```triton, ```mermaid) from slide content.
 * Returns DiagramBlockRef[] and cleaned content (fences replaced with markers).
 *
 * @param content    Raw slide content (markdown).
 * @param slideIndex Zero-based slide index.
 */
export function parseDiagramBlocks(
  content: string,
  slideIndex: number,
): DiagramBlockParseResult {
  const blocks: DiagramBlockRef[] = [];
  let counter = 0;

  const cleanedContent = content.replace(
    DIAGRAM_FENCE_PATTERN,
    (
      fullMatch,
      explicitLang: string | undefined,
      simpleLang: string | undefined,
      infoRest: string | undefined,
      body: string,
      offset: number,
    ) => {
      const lang = (explicitLang ?? simpleLang ?? '').trim();
      const attributes = parseAttributes(infoRest ?? '');

      // Escape hatch: if explicitly marked {render: false} or {code: true}, keep as plain code fence
      if (attributes?.render === 'false' || attributes?.code === 'true') {
        return fullMatch;
      }

      const id = `diagram-${slideIndex}-${counter++}`;
      const fence: DiagramFenceInfo = {
        language: lang,
        attributes,
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
  if (!trimmed) {
    return undefined;
  }

  if (!trimmed.startsWith('{')) {
    return parseKeyValueAttributes(trimmed);
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
    const separatorIdx = pair.search(/[:=]/);
    if (separatorIdx === -1) {
      continue;
    }
    const key = pair.slice(0, separatorIdx).trim().replace(/^["']|["']$/g, '');
    const value = pair.slice(separatorIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseKeyValueAttributes(raw: string): Record<string, string> | undefined {
  const result: Record<string, string> = {};
  const pattern = /([A-Za-z0-9_-]+)\s*=\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([^\s]+))/g;

  for (const match of raw.matchAll(pattern)) {
    const key = match[1]?.trim();
    const value = (match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (key) {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
