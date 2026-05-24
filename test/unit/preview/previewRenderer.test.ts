/**
 * Tests for renderPreviewHtml — pure HTML rendering of a parsed deck.
 * Verifies action links/buttons render inert and render directives become
 * "not executed in preview" cards.
 */

import { expect } from 'chai';
import * as vscode from 'vscode';
import { renderPreviewHtml, renderPreviewError } from '../../../packages/extension/src/preview/previewRenderer';
import type { Deck } from '../../../packages/core/src/models/deck';
import type { Slide } from '../../../packages/core/src/models/slide';

function makeSlide(index: number, opts: { content: string; html: string }): Slide {
  return {
    index,
    content: opts.content,
    html: opts.html,
    onEnterActions: [],
    interactiveElements: [],
    renderDirectives: opts.content.includes('render:')
      ? [{ id: `r-${index}`, type: 'file', rawDirective: '', position: { start: 0, end: 0 } }]
      : [],
    fragmentCount: 0,
  };
}

function makeDeck(slides: Slide[]): Deck {
  return {
    filePath: '/tmp/x.deck.md',
    title: 'Demo Deck',
    slides,
    currentSlideIndex: 0,
    metadata: { title: 'Demo Deck' },
    state: 'active',
    envDeclarations: [],
  };
}

const opts = {
  webview: {} as vscode.Webview,
  cspSource: 'vscode-resource:',
  nonce: 'abc123',
  cssUri: vscode.Uri.file('/x/preview.css'),
  deckPath: '/tmp/x.deck.md',
};

describe('renderPreviewHtml', () => {
  it('renders deck title and slide count in the header', () => {
    const html = renderPreviewHtml(
      makeDeck([makeSlide(0, { content: '', html: '<p>Hi</p>' })]),
      opts,
    );
    expect(html).to.include('Demo Deck');
    expect(html).to.include('1 slide');
  });

  it('uses plural when more than one slide', () => {
    const html = renderPreviewHtml(
      makeDeck([
        makeSlide(0, { content: '', html: '<p>a</p>' }),
        makeSlide(1, { content: '', html: '<p>b</p>' }),
      ]),
      opts,
    );
    expect(html).to.include('2 slides');
  });

  it('emits a section per slide with data-slide-index', () => {
    const html = renderPreviewHtml(
      makeDeck([
        makeSlide(0, { content: '', html: '<p>a</p>' }),
        makeSlide(1, { content: '', html: '<p>b</p>' }),
      ]),
      opts,
    );
    expect(html).to.include('data-slide-index="0"');
    expect(html).to.include('data-slide-index="1"');
  });

  it('replaces render:file links with inert preview cards', () => {
    const slide = makeSlide(0, {
      content: '[](render:file?path=src/foo.ts)',
      html: '<p><a href="render:file?path=src/foo.ts"></a></p>',
    });
    const html = renderPreviewHtml(makeDeck([slide]), opts);
    expect(html).to.include('preview-directive--file');
    expect(html).to.include('src/foo.ts');
    expect(html).to.include('Not executed in preview');
    expect(html).to.not.include('<a href="render:file?path=src/foo.ts"');
  });

  it('replaces render:command links with inert preview cards', () => {
    const slide = makeSlide(0, {
      content: '[](render:command?cmd=ls)',
      html: '<p><a href="render:command?cmd=ls"></a></p>',
    });
    const html = renderPreviewHtml(makeDeck([slide]), opts);
    expect(html).to.include('preview-directive--command');
    expect(html).to.include('Not executed in preview');
  });

  it('embeds an inline click-swallowing script', () => {
    const html = renderPreviewHtml(
      makeDeck([makeSlide(0, { content: '', html: '<p>x</p>' })]),
      opts,
    );
    expect(html).to.include('event.preventDefault()');
    expect(html).to.include('action:');
  });

  it('escapes warnings (no HTML injection)', () => {
    const html = renderPreviewHtml(
      makeDeck([makeSlide(0, { content: '', html: '<p>x</p>' })]),
      { ...opts, warnings: ['<script>alert(1)</script>'] },
    );
    expect(html).to.include('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).to.not.include('<script>alert(1)</script>');
  });

  it('includes the CSP nonce', () => {
    const html = renderPreviewHtml(
      makeDeck([makeSlide(0, { content: '', html: '<p>x</p>' })]),
      { ...opts, nonce: 'NONCE-XYZ' },
    );
    expect(html).to.include("'nonce-NONCE-XYZ'");
  });

  it('renderPreviewError escapes the message', () => {
    const html = renderPreviewError('<oops>', opts);
    expect(html).to.include('&lt;oops&gt;');
    expect(html).to.not.include('<oops>');
  });

  it('interpolates {{VAR}} from deck.resolvedEnvironment', () => {
    const slide = makeSlide(0, {
      content: '',
      html: '<p>hello {{NAME}}</p>',
    });
    const deck = makeDeck([slide]);
    deck.resolvedEnvironment = { NAME: 'world' };
    const html = renderPreviewHtml(deck, opts);
    expect(html).to.include('hello world');
    expect(html).to.not.include('{{NAME}}');
  });

  it('leaves unknown {{VAR}} placeholders untouched', () => {
    const slide = makeSlide(0, {
      content: '',
      html: '<p>{{MISSING}}</p>',
    });
    const deck = makeDeck([slide]);
    deck.resolvedEnvironment = { OTHER: 'x' };
    const html = renderPreviewHtml(deck, opts);
    expect(html).to.include('{{MISSING}}');
  });

  it('html-escapes interpolated env values', () => {
    const slide = makeSlide(0, {
      content: '',
      html: '<p>{{XSS}}</p>',
    });
    const deck = makeDeck([slide]);
    deck.resolvedEnvironment = { XSS: '<img onerror=1>' };
    const html = renderPreviewHtml(deck, opts);
    expect(html).to.include('&lt;img onerror=1&gt;');
    expect(html).to.not.include('<img onerror=1>');
  });

  it('emits postMessage hooks for cursor follow and reverse sync', () => {
    const html = renderPreviewHtml(
      makeDeck([makeSlide(0, { content: '', html: '<p>x</p>' })]),
      opts,
    );
    expect(html).to.include('acquireVsCodeApi');
    expect(html).to.include('scrollToSlide');
    expect(html).to.include('revealSource');
  });
});
