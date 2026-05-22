/**
 * Unit tests for CueParser
 * Covers: voice cue comment parsing, speaker notes fallback,
 * whitespace handling, non-voice comment filtering.
 */

import { expect } from 'chai';
import { parseCues } from '../../../packages/extension/src/recording/cueParser';
import { createMockSlide } from './helpers';

describe('CueParser', () => {
  describe('parseCues()', () => {
    it('should parse simple voice cue comment', () => {
      const slides = [
        createMockSlide({
          content: '# Slide 1\n\n<!-- voice: Welcome to the demo -->',
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(1);
      expect(cues[0].text).to.equal('Welcome to the demo');
      expect(cues[0].slideIndex).to.equal(0);
      expect(cues[0].source).to.equal('comment');
    });

    it('should parse multi-line voice cue', () => {
      const slides = [
        createMockSlide({
          content: [
            '# Slide 1',
            '',
            '<!-- voice: This is the first line',
            'and this continues on the second line -->',
          ].join('\n'),
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(1);
      expect(cues[0].text).to.include('first line');
      expect(cues[0].text).to.include('second line');
    });

    it('should parse multiple cues per slide', () => {
      const slides = [
        createMockSlide({
          content: [
            '# Slide 1',
            '<!-- voice: First cue -->',
            'Some content',
            '<!-- voice: Second cue -->',
          ].join('\n'),
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(2);
      expect(cues[0].text).to.equal('First cue');
      expect(cues[1].text).to.equal('Second cue');
    });

    it('should return empty array when no cues', () => {
      const slides = [
        createMockSlide({
          content: '# Slide 1\n\nJust plain content with no narration.',
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.deep.equal([]);
    });

    it('should fallback to speakerNotes when no cue comments', () => {
      const slides = [
        createMockSlide({
          content: '# Slide 1\n\nNo voice comments here.',
          speakerNotes: 'This is a speaker note used as fallback.',
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(1);
      expect(cues[0].text).to.equal('This is a speaker note used as fallback.');
      expect(cues[0].source).to.equal('speaker-notes');
    });

    it('should handle cues with extra whitespace', () => {
      const slides = [
        createMockSlide({
          content: '# Slide\n\n<!--   voice:    Lots of spaces here    -->',
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(1);
      expect(cues[0].text).to.equal('Lots of spaces here');
    });

    it('should ignore non-voice comments', () => {
      const slides = [
        createMockSlide({
          content: [
            '# Slide',
            '<!-- This is a regular comment -->',
            '<!-- TODO: fix this later -->',
            '<!-- voice: Only this is a cue -->',
          ].join('\n'),
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(1);
      expect(cues[0].text).to.equal('Only this is a cue');
    });

    it('should set correct slideIndex on each cue', () => {
      const slides = [
        createMockSlide({
          content: '<!-- voice: Cue for slide 0 -->',
          index: 0,
        }),
        createMockSlide({
          content: '<!-- voice: Cue for slide 1 -->',
          index: 1,
        }),
        createMockSlide({
          content: '<!-- voice: Cue for slide 5 -->',
          index: 5,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(3);
      expect(cues[0].slideIndex).to.equal(0);
      expect(cues[1].slideIndex).to.equal(1);
      expect(cues[2].slideIndex).to.equal(5);
    });

    it('should handle slides with both cue and speakerNotes (cue wins)', () => {
      const slides = [
        createMockSlide({
          content: '# Slide\n\n<!-- voice: The voice cue -->',
          speakerNotes: 'The speaker note fallback',
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(1);
      expect(cues[0].text).to.equal('The voice cue');
      expect(cues[0].source).to.equal('comment');
    });

    it('should handle empty slides array', () => {
      const cues = parseCues([]);
      expect(cues).to.deep.equal([]);
    });

    it('should handle slide with empty content', () => {
      const slides = [
        createMockSlide({ content: '', index: 0 }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.deep.equal([]);
    });

    it('should parse fragment-level cue with voice[N] syntax', () => {
      const slides = [
        createMockSlide({
          content: '<!-- voice[1]: First fragment narration -->\n<!-- voice[2]: Second fragment narration -->',
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(2);
      expect(cues[0].text).to.equal('First fragment narration');
      expect(cues[0].fragmentIndex).to.equal(1);
      expect(cues[1].text).to.equal('Second fragment narration');
      expect(cues[1].fragmentIndex).to.equal(2);
    });

    it('should mix slide-level and fragment-level cues', () => {
      const slides = [
        createMockSlide({
          content: '<!-- voice: Slide intro -->\n<!-- voice[1]: Fragment one -->',
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(2);
      expect(cues[0].fragmentIndex).to.be.undefined;
      expect(cues[0].text).to.equal('Slide intro');
      expect(cues[1].fragmentIndex).to.equal(1);
      expect(cues[1].text).to.equal('Fragment one');
    });

    it('should leave fragmentIndex undefined for slide-level cues', () => {
      const slides = [
        createMockSlide({
          content: '<!-- voice: No fragment -->',
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(1);
      expect(cues[0].fragmentIndex).to.be.undefined;
    });

    // -----------------------------------------------------------------------
    // DA-08: sidecar cues wiring
    // -----------------------------------------------------------------------

    it('should use sidecar cues (slide.cues) when no comment cues exist', () => {
      const slides = [
        createMockSlide({
          content: '# Slide 1\n\nNo voice comments.',
          cues: ['First talking point', 'Second talking point'],
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(2);
      expect(cues[0].text).to.equal('First talking point');
      expect(cues[0].source).to.equal('frontmatter');
      expect(cues[0].slideIndex).to.equal(0);
      expect(cues[0].fragmentIndex).to.be.undefined;
      expect(cues[1].text).to.equal('Second talking point');
      expect(cues[1].source).to.equal('frontmatter');
    });

    it('should prefer comment cues over sidecar cues when both are present', () => {
      const slides = [
        createMockSlide({
          content: '<!-- voice: Inline comment wins -->',
          cues: ['Sidecar cue should be ignored'],
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(1);
      expect(cues[0].text).to.equal('Inline comment wins');
      expect(cues[0].source).to.equal('comment');
    });

    it('should prefer sidecar cues over speaker notes', () => {
      const slides = [
        createMockSlide({
          content: '# Slide',
          cues: ['Sidecar cue beats notes'],
          speakerNotes: 'These notes should not appear',
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(1);
      expect(cues[0].text).to.equal('Sidecar cue beats notes');
      expect(cues[0].source).to.equal('frontmatter');
    });

    it('should strip whitespace from sidecar cue strings', () => {
      const slides = [
        createMockSlide({
          content: '# Slide',
          cues: ['  trimmed on both sides  '],
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(1);
      expect(cues[0].text).to.equal('trimmed on both sides');
    });

    it('should skip blank sidecar cue strings', () => {
      const slides = [
        createMockSlide({
          content: '# Slide',
          cues: ['   ', 'Valid cue', ''],
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(1);
      expect(cues[0].text).to.equal('Valid cue');
    });

    it('should handle multiple slides with mixed cue sources', () => {
      const slides = [
        createMockSlide({
          content: '<!-- voice: Comment cue -->',
          cues: ['Ignored sidecar'],
          index: 0,
        }),
        createMockSlide({
          content: '# Slide 2',
          cues: ['Sidecar fills the gap'],
          index: 1,
        }),
        createMockSlide({
          content: '# Slide 3',
          speakerNotes: 'Notes as last resort',
          index: 2,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(3);
      expect(cues[0].source).to.equal('comment');
      expect(cues[0].text).to.equal('Comment cue');
      expect(cues[1].source).to.equal('frontmatter');
      expect(cues[1].text).to.equal('Sidecar fills the gap');
      expect(cues[2].source).to.equal('speaker-notes');
      expect(cues[2].text).to.equal('Notes as last resort');
    });

    it('should use pre-extracted voiceCues and ignore sidecar cues (inline wins)', () => {
      const slides = [
        createMockSlide({
          content: '# Slide',
          voiceCues: [{ text: 'Pre-extracted comment cue' }],
          cues: ['Sidecar ignored when voiceCues present'],
          index: 0,
        }),
      ];

      const cues = parseCues(slides);
      expect(cues).to.have.length(1);
      expect(cues[0].text).to.equal('Pre-extracted comment cue');
      expect(cues[0].source).to.equal('comment');
    });
  });
});
