/**
 * Unit tests for blockElementRenderer — specifically the showCommand preview
 * injection via injectBlockElements().
 *
 * Tests exercise the internal getCommandPreview logic through the exported
 * injectBlockElements() function so the full rendering path is covered.
 */

import { expect } from 'chai';
import { injectBlockElements } from '../../../packages/core/src/renderer/blockElementRenderer';
import { Slide, InteractiveElement } from '../../../packages/core/src/models/slide';
import { createAction } from '../../../packages/core/src/models/action';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlide(elements: InteractiveElement[], existingHtml?: string): Slide {
  // Build html with one placeholder per block element (sidecar elements have no placeholder)
  const html = existingHtml ?? elements
    .filter(el => el.source === 'block')
    .map(el => `<!--ACTION:${el.id}-->`)
    .join('\n');
  return {
    index: 0,
    content: '',
    html,
    onEnterActions: [],
    interactiveElements: elements,
    renderDirectives: [],
    fragmentCount: 0,
  };
}

let elementCounter = 0;

function makeElement(
  type: string,
  params: Record<string, unknown>,
  showCommand: boolean,
): InteractiveElement {
  const id = `block-0-${elementCounter++}`;
  return {
    id,
    label: 'Run it',
    action: createAction(type as never, params, 0),
    position: { line: 1, column: 1 },
    rawLink: '',
    source: 'block',
    showCommand,
  };
}

function makeSidecarElement(
  type: string,
  params: Record<string, unknown>,
  fragment: boolean = true,
): InteractiveElement {
  const id = `sidecar-0-${elementCounter++}`;
  return {
    id,
    label: 'Run it',
    action: createAction(type as never, params, 0),
    position: { line: 9999, column: 0 },
    rawLink: '',
    source: 'sidecar',
    fragment,
  };
}

// ---------------------------------------------------------------------------
// showCommand — single-action types
// ---------------------------------------------------------------------------

describe('blockElementRenderer — showCommand preview', () => {
  beforeEach(() => { elementCounter = 0; });

  describe('terminal.run', () => {
    it('renders command string as preview', () => {
      const el = makeElement('terminal.run', { command: 'npm test' }, true);
      const slide = makeSlide([el]);
      const html = injectBlockElements(slide.html, slide);
      expect(html).to.include('class="action-preview"');
      expect(html).to.include('npm test');
    });

    it('renders cross-platform default key as preview', () => {
      const el = makeElement('terminal.run', {
        command: { default: 'make build', win32: 'nmake build' },
      }, true);
      const slide = makeSlide([el]);
      const html = injectBlockElements(slide.html, slide);
      expect(html).to.include('make build');
    });

    it('does not render preview when showCommand is false', () => {
      const el = makeElement('terminal.run', { command: 'npm test' }, false);
      const slide = makeSlide([el]);
      const html = injectBlockElements(slide.html, slide);
      expect(html).to.not.include('action-preview');
    });
  });

  describe('file.open', () => {
    it('renders path as preview', () => {
      const el = makeElement('file.open', { path: 'src/index.ts' }, true);
      const slide = makeSlide([el]);
      const html = injectBlockElements(slide.html, slide);
      expect(html).to.include('action-preview');
      expect(html).to.include('src/index.ts');
    });
  });

  describe('editor.highlight', () => {
    it('renders path with lines as preview', () => {
      const el = makeElement('editor.highlight', { path: 'src/app.ts', lines: '10-20' }, true);
      const slide = makeSlide([el]);
      const html = injectBlockElements(slide.html, slide);
      expect(html).to.include('src/app.ts');
      expect(html).to.include(':10-20');
    });
  });

  describe('debug.start', () => {
    it('renders configName as preview', () => {
      const el = makeElement('debug.start', { configName: 'Launch Extension' }, true);
      const slide = makeSlide([el]);
      const html = injectBlockElements(slide.html, slide);
      expect(html).to.include('action-preview');
      expect(html).to.include('Launch Extension');
    });
  });

  describe('vscode.command', () => {
    it('renders command id as preview', () => {
      const el = makeElement('vscode.command', { id: 'workbench.action.openSettings' }, true);
      const slide = makeSlide([el]);
      const html = injectBlockElements(slide.html, slide);
      expect(html).to.include('workbench.action.openSettings');
    });
  });

  // ---------------------------------------------------------------------------
  // showCommand — sequence (the bug fix)
  // ---------------------------------------------------------------------------

  describe('sequence', () => {
    it('renders one preview line per step', () => {
      const steps = [
        { type: 'file.open', path: 'src/index.ts' },
        { type: 'terminal.run', command: 'npm run compile' },
      ];
      const el = makeElement('sequence', { steps }, true);
      const slide = makeSlide([el]);
      const html = injectBlockElements(slide.html, slide);
      expect(html).to.include('action-preview');
      expect(html).to.include('src/index.ts');
      expect(html).to.include('npm run compile');
    });

    it('renders three-step sequence correctly', () => {
      const steps = [
        { type: 'file.open', path: 'package.json' },
        { type: 'terminal.run', command: 'npm install' },
        { type: 'terminal.run', command: 'npm run compile' },
      ];
      const el = makeElement('sequence', { steps }, true);
      const slide = makeSlide([el]);
      const html = injectBlockElements(slide.html, slide);
      expect(html).to.include('package.json');
      expect(html).to.include('npm install');
      expect(html).to.include('npm run compile');
    });

    it('falls back to step type when no meaningful preview is available', () => {
      const steps = [
        { type: 'debug.start', configName: 'Launch' },
        { type: 'vscode.command', id: 'editor.action.formatDocument' },
      ];
      const el = makeElement('sequence', { steps }, true);
      const slide = makeSlide([el]);
      const html = injectBlockElements(slide.html, slide);
      expect(html).to.include('Launch');
      expect(html).to.include('editor.action.formatDocument');
    });

    it('shows nothing when steps array is empty', () => {
      const el = makeElement('sequence', { steps: [] }, true);
      const slide = makeSlide([el]);
      const html = injectBlockElements(slide.html, slide);
      expect(html).to.not.include('action-preview');
    });

    it('shows nothing when showCommand is false on sequence', () => {
      const steps = [
        { type: 'terminal.run', command: 'npm test' },
      ];
      const el = makeElement('sequence', { steps }, false);
      const slide = makeSlide([el]);
      const html = injectBlockElements(slide.html, slide);
      expect(html).to.not.include('action-preview');
    });
  });
});

// ---------------------------------------------------------------------------
// Sidecar elements — fragment injection
// ---------------------------------------------------------------------------

describe('blockElementRenderer — sidecar fragment injection', () => {
  beforeEach(() => { elementCounter = 0; });

  it('injects a sidecar button with class="fragment" and a data-fragment index', () => {
    const el = makeSidecarElement('terminal.run', { command: 'npm install' });
    // Simulate slide HTML that has already had processFragments run
    const existingHtml = '<h1>Setup</h1>\n<p class="fragment" data-fragment="1" data-fragment-animation="fade">Install deps</p>';
    const slide = makeSlide([el], existingHtml);
    const html = injectBlockElements(slide.html, slide);
    expect(html).to.include('class="fragment"');
    expect(html).to.include('data-fragment="2"');
    expect(html).to.include('data-fragment-animation="fade"');
    expect(html).to.not.include('data-no-fragment');
  });

  it('assigns fragment index N+1 after the last existing fragment', () => {
    const el = makeSidecarElement('terminal.run', { command: 'npm test' });
    const existingHtml =
      '<p class="fragment" data-fragment="1" data-fragment-animation="fade">One</p>\n' +
      '<p class="fragment" data-fragment="2" data-fragment-animation="fade">Two</p>';
    const slide = makeSlide([el], existingHtml);
    const html = injectBlockElements(slide.html, slide);
    expect(html).to.include('data-fragment="3"');
    expect(html).to.not.include('data-fragment="4"');
  });

  it('starts at fragment index 1 when the slide has no existing fragments', () => {
    const el = makeSidecarElement('terminal.run', { command: 'echo hi' });
    const existingHtml = '<h1>Title Only</h1>';
    const slide = makeSlide([el], existingHtml);
    const html = injectBlockElements(slide.html, slide);
    expect(html).to.include('data-fragment="1"');
  });

  it('injects multiple sidecar elements as consecutive fragment steps', () => {
    const el1 = makeSidecarElement('terminal.run', { command: 'npm install' });
    const el2 = makeSidecarElement('file.open', { path: 'src/app.ts' });
    const existingHtml = '<p class="fragment" data-fragment="1" data-fragment-animation="fade">Step 1</p>';
    const slide = makeSlide([el1, el2], existingHtml);
    const html = injectBlockElements(slide.html, slide);
    expect(html).to.include('data-fragment="2"');
    expect(html).to.include('data-fragment="3"');
  });

  it('falls back to no-fragment markup when sidecar element has fragment=false', () => {
    const el = makeSidecarElement('terminal.run', { command: 'ls' }, false);
    const existingHtml = '<h1>Title</h1>';
    const slide = makeSlide([el], existingHtml);
    const html = injectBlockElements(slide.html, slide);
    expect(html).to.include('data-no-fragment');
    expect(html).to.not.include('class="fragment"');
  });
});
