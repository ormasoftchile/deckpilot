/**
 * Layout comment processor — post-processes rendered HTML to transform
 * HTML comment markers into layout wrapper divs.
 *
 * Replaces the old :::directive syntax entirely.
 *
 * Supported intra-slide markers (in markdown source):
 *   <!-- center -->    ... <!-- /center -->
 *   <!-- columns -->   ... <!-- /columns -->
 *   <!-- left -->      ... <!-- /left -->
 *   <!-- right -->     ... <!-- /right -->
 *   <!-- group -->     ... <!-- /group -->
 *   <!-- advanced -->  ... <!-- /advanced -->
 *   <!-- optional -->  ... <!-- /optional -->
 */

type DirectiveName = 'center' | 'columns' | 'left' | 'right' | 'group' | 'advanced' | 'optional';

const CSS_CLASS_MAP: Record<string, string> = {
  center: 'layout-center',
  columns: 'layout-columns',
  left: 'layout-left',
  right: 'layout-right',
  group: 'slide-group',
};

function getOpenHtml(name: DirectiveName): string {
  switch (name) {
    case 'advanced':
      return '<details class="disclosure-advanced"><summary>Advanced</summary>';
    case 'optional':
      return '<div class="step-optional"><span class="optional-badge">Optional</span>';
    default:
      return `<div class="${CSS_CLASS_MAP[name]}">`;
  }
}

function getCloseHtml(name: DirectiveName): string {
  return name === 'advanced' ? '</details>' : '</div>';
}

/**
 * Scan rendered HTML for layout comment markers and replace them with
 * the corresponding HTML wrapper tags.
 *
 * @param html Rendered HTML from markdown-it
 * @returns HTML with comment markers replaced by layout div/details wrappers
 */
export function processLayoutComments(html: string): string {
  const LOOSE =
    /<!--\s*(\/?)(?:\s*)(center|columns|left|right|group|advanced|optional)(?:\s*)-->/g;

  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = LOOSE.exec(html)) !== null) {
    result += html.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;

    const isClose = match[1] === '/';
    const name = match[2] as DirectiveName;

    result += isClose ? getCloseHtml(name) : getOpenHtml(name);
  }

  result += html.slice(lastIndex);
  return result;
}
