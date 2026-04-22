/**
 * Unit tests for mergeEngine — DA-05: sidecar merge engine.
 *
 * Covers:
 * - mergeSidecarIntoSlides: no-op paths, field precedence, partial matches, id-less slides
 * - mergeSidecarDeckMetadata: no-op paths, field precedence, title + theme merging
 */

import { expect } from 'chai';
import { mergeSidecarIntoSlides, mergeSidecarDeckMetadata } from '../../../src/parser/mergeEngine';
import type { Slide } from '../../../src/models/slide';
import type { DeckMetadata } from '../../../src/models/deck';
import type { SidecarFile } from '../../../src/models/sidecar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlide(overrides: Partial<Slide> & { index: number }): Slide {
  return {
    content: '',
    html: '',
    onEnterActions: [],
    interactiveElements: [],
    renderDirectives: [],
    fragmentCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// mergeSidecarIntoSlides
// ---------------------------------------------------------------------------

describe('mergeSidecarIntoSlides', () => {
  describe('no-op paths', () => {
    it('returns the same array when sidecar has no slides array', () => {
      const slides = [makeSlide({ index: 0, id: 'intro' })];
      const sidecar: SidecarFile = {};
      const result = mergeSidecarIntoSlides(slides, sidecar);
      expect(result).to.equal(slides);
    });

    it('returns the same array when sidecar slides is empty', () => {
      const slides = [makeSlide({ index: 0, id: 'intro' })];
      const sidecar: SidecarFile = { slides: [] };
      const result = mergeSidecarIntoSlides(slides, sidecar);
      expect(result).to.equal(slides);
    });

    it('passes through a slide with no id unchanged', () => {
      const slide = makeSlide({ index: 0 }); // no id
      const sidecar: SidecarFile = {
        slides: [{ id: 'intro', cues: ['hello'] }],
      };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0]).to.equal(slide);
    });

    it('passes through a slide whose id has no matching sidecar entry', () => {
      const slide = makeSlide({ index: 0, id: 'other' });
      const sidecar: SidecarFile = {
        slides: [{ id: 'intro', cues: ['hello'] }],
      };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0]).to.equal(slide);
    });

    it('silently skips sidecar entries with no matching slide', () => {
      const slides = [makeSlide({ index: 0, id: 'slide-0' })];
      const sidecar: SidecarFile = {
        slides: [
          { id: 'slide-0', cues: ['cue'] },
          { id: 'ghost', cues: ['ignored'] },
        ],
      };
      const result = mergeSidecarIntoSlides(slides, sidecar);
      expect(result).to.have.lengthOf(1);
      expect(result[0].id).to.equal('slide-0');
    });
  });

  describe('cues merging', () => {
    it('applies sidecar cues when slide has none', () => {
      const slide = makeSlide({ index: 0, id: 'intro' });
      const sidecar: SidecarFile = {
        slides: [{ id: 'intro', cues: ['Welcome', 'Today we cover…'] }],
      };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0].cues).to.deep.equal(['Welcome', 'Today we cover…']);
    });

    it('does not overwrite existing slide cues with sidecar cues', () => {
      const slide = makeSlide({ index: 0, id: 'intro', cues: ['inline cue'] });
      const sidecar: SidecarFile = {
        slides: [{ id: 'intro', cues: ['sidecar cue'] }],
      };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0].cues).to.deep.equal(['inline cue']);
    });

    it('leaves cues undefined when sidecar entry has no cues', () => {
      const slide = makeSlide({ index: 0, id: 'intro' });
      const sidecar: SidecarFile = { slides: [{ id: 'intro' }] };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0].cues).to.be.undefined;
    });
  });

  describe('duration merging', () => {
    it('applies sidecar duration when slide has none', () => {
      const slide = makeSlide({ index: 0, id: 'intro' });
      const sidecar: SidecarFile = {
        slides: [{ id: 'intro', duration: '2m30s' }],
      };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0].duration).to.equal('2m30s');
    });

    it('does not overwrite existing slide duration', () => {
      const slide = makeSlide({ index: 0, id: 'intro', duration: '1m' });
      const sidecar: SidecarFile = {
        slides: [{ id: 'intro', duration: '5m' }],
      };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0].duration).to.equal('1m');
    });
  });

  describe('checkpoint merging', () => {
    it('applies sidecar checkpoint when slide has none', () => {
      const slide = makeSlide({ index: 0, id: 'step-1' });
      const sidecar: SidecarFile = {
        slides: [{ id: 'step-1', checkpoint: 'install-complete' }],
      };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0].checkpoint).to.equal('install-complete');
    });

    it('does not overwrite existing inline checkpoint', () => {
      const slide = makeSlide({ index: 0, id: 'step-1', checkpoint: 'inline-cp' });
      const sidecar: SidecarFile = {
        slides: [{ id: 'step-1', checkpoint: 'sidecar-cp' }],
      };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0].checkpoint).to.equal('inline-cp');
    });
  });

  describe('sidecarActions merging', () => {
    it('stores sidecar actions on slide', () => {
      const slide = makeSlide({ index: 0, id: 'demo' });
      const sidecar: SidecarFile = {
        slides: [
          {
            id: 'demo',
            actions: [
              { type: 'terminal.run', cmd: 'npm test' },
              { type: 'file.open', file: 'src/index.ts' },
            ],
          },
        ],
      };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0].sidecarActions).to.deep.equal([
        { type: 'terminal.run', cmd: 'npm test' },
        { type: 'file.open', file: 'src/index.ts' },
      ]);
    });

    it('leaves sidecarActions undefined when sidecar entry has no actions', () => {
      const slide = makeSlide({ index: 0, id: 'demo' });
      const sidecar: SidecarFile = { slides: [{ id: 'demo' }] };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0].sidecarActions).to.be.undefined;
    });

    it('populates onEnterActions from sidecar actions (DA-07)', () => {
      const slide = makeSlide({ index: 2, id: 'demo' });
      const sidecar: SidecarFile = {
        slides: [
          {
            id: 'demo',
            actions: [
              { type: 'terminal.run', cmd: 'npm install' },
              { type: 'file.open', file: 'src/app.ts' },
            ],
          },
        ],
      };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      const onEnter = result[0].onEnterActions;
      expect(onEnter).to.have.lengthOf(2);
      expect(onEnter[0].type).to.equal('terminal.run');
      expect(onEnter[0].params).to.have.property('command', 'npm install');
      expect(onEnter[1].type).to.equal('file.open');
      expect(onEnter[1].params).to.have.property('path', 'src/app.ts');
    });

    it('does not overwrite existing onEnterActions with sidecar actions', () => {
      const existingAction = {
        id: 'existing',
        type: 'file.open' as const,
        params: { path: 'inline.ts' },
        status: 'pending' as const,
        slideIndex: 0,
      };
      const slide = makeSlide({ index: 0, id: 'demo', onEnterActions: [existingAction] });
      const sidecar: SidecarFile = {
        slides: [{ id: 'demo', actions: [{ type: 'terminal.run', cmd: 'npm test' }] }],
      };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0].onEnterActions).to.have.lengthOf(1);
      expect(result[0].onEnterActions[0].id).to.equal('existing');
    });

    it('assigns the correct slideIndex to mapped actions', () => {
      const slide = makeSlide({ index: 7, id: 'slide-7' });
      const sidecar: SidecarFile = {
        slides: [{ id: 'slide-7', actions: [{ type: 'terminal.run', cmd: 'ls' }] }],
      };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0].onEnterActions[0].slideIndex).to.equal(7);
    });

    it('leaves onEnterActions empty when sidecar entry has no actions', () => {
      const slide = makeSlide({ index: 0, id: 'demo' });
      const sidecar: SidecarFile = { slides: [{ id: 'demo' }] };
      const result = mergeSidecarIntoSlides([slide], sidecar);
      expect(result[0].onEnterActions).to.deep.equal([]);
    });
  });

  describe('immutability', () => {
    it('does not mutate the original slide object', () => {
      const slide = makeSlide({ index: 0, id: 'intro' });
      const originalCheckpoint = slide.checkpoint;
      const sidecar: SidecarFile = {
        slides: [{ id: 'intro', checkpoint: 'cp', cues: ['x'], duration: '1m' }],
      };
      mergeSidecarIntoSlides([slide], sidecar);
      expect(slide.checkpoint).to.equal(originalCheckpoint);
      expect(slide.cues).to.be.undefined;
      expect(slide.duration).to.be.undefined;
    });

    it('returns a new array (not the same reference)', () => {
      const slides = [makeSlide({ index: 0, id: 'intro' })];
      const sidecar: SidecarFile = {
        slides: [{ id: 'intro', cues: ['cue'] }],
      };
      const result = mergeSidecarIntoSlides(slides, sidecar);
      expect(result).to.not.equal(slides);
    });
  });

  describe('multi-slide deck', () => {
    it('merges only matching slides, passes others through', () => {
      const slides = [
        makeSlide({ index: 0, id: 'intro' }),
        makeSlide({ index: 1, id: 'demo' }),
        makeSlide({ index: 2, id: 'outro' }),
      ];
      const sidecar: SidecarFile = {
        slides: [
          { id: 'demo', cues: ['run it'], duration: '3m' },
        ],
      };
      const result = mergeSidecarIntoSlides(slides, sidecar);
      expect(result).to.have.lengthOf(3);
      expect(result[0]).to.equal(slides[0]); // pass-through (no match)
      expect(result[1].cues).to.deep.equal(['run it']);
      expect(result[1].duration).to.equal('3m');
      expect(result[2]).to.equal(slides[2]); // pass-through (no match)
    });

    it('each of multiple sidecar entries matches its own slide independently', () => {
      const slides = [
        makeSlide({ index: 0, id: 'slide-1' }),
        makeSlide({ index: 1, id: 'slide-2' }),
        makeSlide({ index: 2, id: 'slide-3' }),
      ];
      const sidecar: SidecarFile = {
        slides: [
          { id: 'slide-1', cues: ['cue-a'], duration: '1m' },
          { id: 'slide-2', checkpoint: 'mid' },
          { id: 'slide-3', cues: ['cue-z'], duration: '5m', checkpoint: 'end' },
        ],
      };
      const result = mergeSidecarIntoSlides(slides, sidecar);
      expect(result).to.have.lengthOf(3);

      expect(result[0].cues).to.deep.equal(['cue-a']);
      expect(result[0].duration).to.equal('1m');
      expect(result[0].checkpoint).to.be.undefined;

      expect(result[1].cues).to.be.undefined;
      expect(result[1].checkpoint).to.equal('mid');

      expect(result[2].cues).to.deep.equal(['cue-z']);
      expect(result[2].duration).to.equal('5m');
      expect(result[2].checkpoint).to.equal('end');
    });

    it('sidecar entry matching only slide-2 leaves slide-1 and slide-3 untouched', () => {
      const slides = [
        makeSlide({ index: 0, id: 'slide-1', cues: ['original'], duration: '10m', checkpoint: 'cp1' }),
        makeSlide({ index: 1, id: 'slide-2' }),
        makeSlide({ index: 2, id: 'slide-3', cues: ['z'], duration: '2m', checkpoint: 'cp3' }),
      ];
      const sidecar: SidecarFile = {
        slides: [{ id: 'slide-2', cues: ['injected'], duration: '3m', checkpoint: 'mid' }],
      };
      const result = mergeSidecarIntoSlides(slides, sidecar);

      // slide-1 and slide-3 are identical references (untouched)
      expect(result[0]).to.equal(slides[0]);
      expect(result[2]).to.equal(slides[2]);

      // only slide-2 was merged
      expect(result[1].cues).to.deep.equal(['injected']);
      expect(result[1].duration).to.equal('3m');
      expect(result[1].checkpoint).to.equal('mid');
    });
  });
});

// ---------------------------------------------------------------------------
// mergeSidecarDeckMetadata
// ---------------------------------------------------------------------------

describe('mergeSidecarDeckMetadata', () => {
  describe('no-op paths', () => {
    it('returns the same metadata object when sidecar has no deck section', () => {
      const metadata: DeckMetadata = { title: 'My Deck' };
      const sidecar: SidecarFile = {};
      const result = mergeSidecarDeckMetadata(metadata, sidecar);
      expect(result).to.equal(metadata);
    });

    it('returns the same metadata object when sidecar.deck is undefined', () => {
      const metadata: DeckMetadata = {};
      const sidecar: SidecarFile = { slides: [] };
      const result = mergeSidecarDeckMetadata(metadata, sidecar);
      expect(result).to.equal(metadata);
    });
  });

  describe('title merging', () => {
    it('applies sidecar title when metadata has none', () => {
      const metadata: DeckMetadata = {};
      const sidecar: SidecarFile = { deck: { title: 'Sidecar Title' } };
      const result = mergeSidecarDeckMetadata(metadata, sidecar);
      expect(result.title).to.equal('Sidecar Title');
    });

    it('does not overwrite existing inline title', () => {
      const metadata: DeckMetadata = { title: 'Inline Title' };
      const sidecar: SidecarFile = { deck: { title: 'Sidecar Title' } };
      const result = mergeSidecarDeckMetadata(metadata, sidecar);
      expect(result.title).to.equal('Inline Title');
    });
  });

  describe('theme merging', () => {
    it('applies sidecar theme when metadata has none', () => {
      const metadata: DeckMetadata = {};
      const sidecar: SidecarFile = { deck: { theme: 'dark' } };
      const result = mergeSidecarDeckMetadata(metadata, sidecar);
      expect(result.theme).to.equal('dark');
    });

    it('does not overwrite existing inline theme', () => {
      const metadata: DeckMetadata = { theme: 'light' };
      const sidecar: SidecarFile = { deck: { theme: 'dark' } };
      const result = mergeSidecarDeckMetadata(metadata, sidecar);
      expect(result.theme).to.equal('light');
    });

    it('handles arbitrary theme strings from sidecar', () => {
      const metadata: DeckMetadata = {};
      const sidecar: SidecarFile = { deck: { theme: 'corporate-blue' } };
      const result = mergeSidecarDeckMetadata(metadata, sidecar);
      expect(result.theme).to.equal('corporate-blue');
    });
  });

  describe('combined merging', () => {
    it('applies both title and theme from sidecar when neither is set inline', () => {
      const metadata: DeckMetadata = {};
      const sidecar: SidecarFile = { deck: { title: 'My Talk', theme: 'dark' } };
      const result = mergeSidecarDeckMetadata(metadata, sidecar);
      expect(result.title).to.equal('My Talk');
      expect(result.theme).to.equal('dark');
    });

    it('preserves other metadata fields unchanged', () => {
      const metadata: DeckMetadata = { author: 'Alice', basePath: '/talks' };
      const sidecar: SidecarFile = { deck: { title: 'New Title', theme: 'light' } };
      const result = mergeSidecarDeckMetadata(metadata, sidecar);
      expect(result.author).to.equal('Alice');
      expect(result.basePath).to.equal('/talks');
    });
  });

  describe('immutability', () => {
    it('does not mutate the original metadata object', () => {
      const metadata: DeckMetadata = {};
      const sidecar: SidecarFile = { deck: { title: 'New', theme: 'dark' } };
      mergeSidecarDeckMetadata(metadata, sidecar);
      expect(metadata.title).to.be.undefined;
      expect(metadata.theme).to.be.undefined;
    });

    it('returns a new object (not the same reference)', () => {
      const metadata: DeckMetadata = {};
      const sidecar: SidecarFile = { deck: { title: 'New' } };
      const result = mergeSidecarDeckMetadata(metadata, sidecar);
      expect(result).to.not.equal(metadata);
    });
  });
});
