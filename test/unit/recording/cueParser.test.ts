/**
 * Unit tests for CueParser
 * Covers: voice cue comment parsing, speaker notes fallback,
 * whitespace handling, non-voice comment filtering.
 */

import { expect } from 'chai';
import { parseCues } from '../../../src/recording/cueParser';
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
  });
});
