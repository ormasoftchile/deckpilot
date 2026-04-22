/**
 * DA-23: Unit tests for buildSidecarContent()
 *
 * The pure extraction logic is tested in isolation — no VS Code API needed.
 */

import { expect } from 'chai';
import * as yaml from 'js-yaml';
import { buildSidecarContent } from '../../../src/commands/extractMetadata';
import { createDeck } from '../../../src/models/deck';
import { createSlide } from '../../../src/models/slide';
import type { Deck } from '../../../src/models/deck';
import type { Slide } from '../../../src/models/slide';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlide(overrides: Partial<Slide> = {}): Slide {
    const base = createSlide(0, '# Hello', '<h1>Hello</h1>');
    return { ...base, id: 'slide-0', ...overrides };
}

function makeDeck(slides: Slide[] = [], meta: Record<string, unknown> = {}): Deck {
    const deck = createDeck('/fake/deck.deck.md', slides.length ? slides : [makeSlide()], meta);
    return deck;
}

function parse(yamlStr: string): Record<string, unknown> {
    return yaml.load(yamlStr) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Deck-level metadata
// ---------------------------------------------------------------------------

describe('buildSidecarContent — deck section', () => {
    it('emits deck.title when title is set', () => {
        const deck = makeDeck([], { title: 'My Deck' });
        const result = parse(buildSidecarContent(deck));
        expect((result.deck as Record<string, unknown>).title).to.equal('My Deck');
    });

    it('emits deck.theme when theme is set', () => {
        const deck = makeDeck([], { theme: 'ocean' });
        const result = parse(buildSidecarContent(deck));
        expect((result.deck as Record<string, unknown>).theme).to.equal('ocean');
    });

    it('omits deck section when neither title nor theme are present', () => {
        const deck = makeDeck();
        const result = parse(buildSidecarContent(deck));
        expect(result.deck).to.be.undefined;
    });
});

// ---------------------------------------------------------------------------
// Recording + Export sections
// ---------------------------------------------------------------------------

describe('buildSidecarContent — recording section', () => {
    it('emits recording section when recording fields are present', () => {
        const deck = makeDeck([], { recording: { autoStart: true, outputDir: './out' } });
        const result = parse(buildSidecarContent(deck));
        const rec = result.recording as Record<string, unknown>;
        expect(rec.autoStart).to.equal(true);
        expect(rec.outputDir).to.equal('./out');
    });

    it('omits recording section when metadata.recording is absent', () => {
        const deck = makeDeck();
        const result = parse(buildSidecarContent(deck));
        expect(result.recording).to.be.undefined;
    });

    it('omits recording section when metadata.recording is empty object', () => {
        const deck = makeDeck([], { recording: {} });
        const result = parse(buildSidecarContent(deck));
        expect(result.recording).to.be.undefined;
    });
});

describe('buildSidecarContent — export section', () => {
    it('emits export section when export fields are present', () => {
        const deck = makeDeck([], { export: { subtitles: true, video: false } });
        const result = parse(buildSidecarContent(deck));
        const exp = result.export as Record<string, unknown>;
        expect(exp.subtitles).to.equal(true);
        expect(exp.video).to.equal(false);
    });

    it('omits export section when metadata.export is absent', () => {
        const deck = makeDeck();
        const result = parse(buildSidecarContent(deck));
        expect(result.export).to.be.undefined;
    });
});

// ---------------------------------------------------------------------------
// Slide-level metadata
// ---------------------------------------------------------------------------

describe('buildSidecarContent — slides section', () => {
    it('includes slide entry when cues are present', () => {
        const slide = makeSlide({ index: 0, id: 'intro', cues: ['First cue', 'Second cue'] });
        const deck = makeDeck([slide]);
        const result = parse(buildSidecarContent(deck));
        const slides = result.slides as Array<Record<string, unknown>>;
        expect(slides).to.have.length(1);
        expect(slides[0].id).to.equal('intro');
        expect(slides[0].cues).to.deep.equal(['First cue', 'Second cue']);
    });

    it('includes slide entry when duration is present', () => {
        const slide = makeSlide({ index: 0, id: 'demo', duration: '1m30s' });
        const deck = makeDeck([slide]);
        const result = parse(buildSidecarContent(deck));
        const slides = result.slides as Array<Record<string, unknown>>;
        expect(slides[0].duration).to.equal('1m30s');
    });

    it('includes slide entry when checkpoint is present', () => {
        const slide = makeSlide({ index: 0, id: 'step-1', checkpoint: 'step-one' });
        const deck = makeDeck([slide]);
        const result = parse(buildSidecarContent(deck));
        const slides = result.slides as Array<Record<string, unknown>>;
        expect(slides[0].checkpoint).to.equal('step-one');
    });

    it('skips slides with no metadata', () => {
        const plain = makeSlide({ index: 0, id: 'plain' });
        const rich = makeSlide({ index: 1, id: 'rich', cues: ['hello'] });
        const deck = makeDeck([plain, rich]);
        const result = parse(buildSidecarContent(deck));
        const slides = result.slides as Array<Record<string, unknown>>;
        expect(slides).to.have.length(1);
        expect(slides[0].id).to.equal('rich');
    });

    it('omits slides section when no slide has metadata', () => {
        const deck = makeDeck([makeSlide({ index: 0, id: 'plain' })]);
        const result = parse(buildSidecarContent(deck));
        expect(result.slides).to.be.undefined;
    });

    it('skips slides without an id even if they have cues', () => {
        const slide = makeSlide({ index: 0, id: undefined, cues: ['hello'] });
        const deck = makeDeck([slide]);
        const result = parse(buildSidecarContent(deck));
        expect(result.slides).to.be.undefined;
    });

    it('includes sidecarActions as actions: in the slide entry (round-trip preservation)', () => {
        const slide = makeSlide({
            index: 0,
            id: 'code-slide',
            sidecarActions: [{ type: 'terminal.run', cmd: 'echo hi' }],
        });
        const deck = makeDeck([slide]);
        const result = parse(buildSidecarContent(deck));
        // sidecarActions triggers inclusion of the slide entry
        const slides = result.slides as Array<Record<string, unknown>>;
        expect(slides).to.have.length(1);
        expect(slides[0].id).to.equal('code-slide');
        const actions = slides[0].actions as Array<Record<string, unknown>>;
        expect(actions).to.have.length(1);
        expect(actions[0].type).to.equal('terminal.run');
    });
});

// ---------------------------------------------------------------------------
// Valid YAML output
// ---------------------------------------------------------------------------

describe('buildSidecarContent — output validity', () => {
    it('produces parseable YAML', () => {
        const slide = makeSlide({ index: 0, id: 'test', cues: ['cue'], duration: '30s' });
        const deck = makeDeck([slide], { title: 'Test Deck', recording: { autoStart: true } });
        const output = buildSidecarContent(deck);
        expect(() => yaml.load(output)).not.to.throw();
    });

    it('produces non-empty string', () => {
        const deck = makeDeck([], { title: 'Hello' });
        const output = buildSidecarContent(deck);
        expect(output.trim()).to.have.length.greaterThan(0);
    });
});
