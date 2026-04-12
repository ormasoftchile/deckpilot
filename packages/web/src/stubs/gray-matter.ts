/**
 * Browser-compatible stub for gray-matter.
 * gray-matter uses Node.js Buffer internally which is not available in browsers.
 * This stub implements just what deckParser.ts needs: YAML frontmatter extraction.
 */

export interface GrayMatterFile {
  data: Record<string, unknown>;
  content: string;
}

/**
 * Minimal YAML parser for frontmatter values only.
 * Handles: strings, numbers, booleans, nested objects (indent-based), arrays.
 */
function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');

  interface StackEntry {
    indent: number;
    obj: Record<string, unknown>;
    key?: string;
    arr?: unknown[];
  }

  const stack: StackEntry[] = [{ indent: -1, obj: result }];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trimStart();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = rawLine.length - trimmed.length;

    // Pop stack to the right indent level
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1];
    const target = current.arr !== undefined ? current.arr : current.obj;

    // Array item
    if (trimmed.startsWith('- ')) {
      const val = trimmed.slice(2).trim();
      if (Array.isArray(target)) {
        (target as unknown[]).push(parseScalar(val));
      } else {
        // Start an array for the parent key
        const parentEntry = stack[stack.length - 1];
        if (parentEntry.key && typeof parentEntry.obj === 'object') {
          const arr: unknown[] = [parseScalar(val)];
          parentEntry.obj[parentEntry.key] = arr;
          stack.push({ indent, obj: parentEntry.obj, key: parentEntry.key, arr });
        }
      }
      continue;
    }

    // Key-value
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const rest = trimmed.slice(colonIdx + 1).trim();

    if (rest === '' || rest === '{}') {
      // Nested object upcoming
      const nestedObj: Record<string, unknown> = rest === '{}' ? {} : {};
      if (Array.isArray(target)) {
        (target as unknown[]).push(nestedObj);
      } else {
        (target as Record<string, unknown>)[key] = nestedObj;
      }
      stack.push({ indent, obj: nestedObj, key });
    } else {
      const val = parseScalar(rest);
      if (Array.isArray(target)) {
        (target as unknown[]).push({ [key]: val });
      } else {
        (target as Record<string, unknown>)[key] = val;
      }
      if (stack[stack.length - 1] !== current) stack.push({ indent, obj: current.obj, key });
      else stack[stack.length - 1].key = key;
    }
  }

  return result;
}

function parseScalar(val: string): unknown {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null' || val === '~') return null;
  // Strip surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  const num = Number(val);
  if (!isNaN(num) && val !== '') return num;
  return val;
}

/**
 * Parse a markdown string that may begin with YAML frontmatter (--- blocks).
 * Returns { data, content } matching gray-matter's API.
 */
function matter(input: string): GrayMatterFile {
  const str = typeof input === 'string' ? input : String(input);

  // Must start with ---
  if (!str.startsWith('---')) {
    return { data: {}, content: str };
  }

  const afterOpen = str.slice(3);
  // Find the closing ---
  const closeIdx = afterOpen.indexOf('\n---');
  if (closeIdx === -1) {
    return { data: {}, content: str };
  }

  const yamlBody = afterOpen.slice(0, closeIdx);
  // Content is everything after the closing --- line
  let contentStart = closeIdx + 4; // skip '\n---'
  // Skip the newline right after closing ---
  if (afterOpen[contentStart] === '\n') contentStart++;
  else if (afterOpen[contentStart] === '\r' && afterOpen[contentStart + 1] === '\n') contentStart += 2;

  const content = afterOpen.slice(contentStart);

  let data: Record<string, unknown> = {};
  try {
    data = parseYaml(yamlBody);
  } catch {
    // Return empty data on parse failure
  }

  return { data, content };
}

matter.stringify = function(_content: string, _data: unknown): string {
  throw new Error('gray-matter stub: stringify not implemented');
};

export default matter;
