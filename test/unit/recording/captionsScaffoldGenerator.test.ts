/**
 * Unit tests for CaptionsScaffoldGenerator
 * Covers: SRT generation, timestamp formatting, text wrapping, edge cases.
 */

import { expect } from 'chai';
import { CaptionsScaffoldGenerator } from '../../../src/recording/captionsScaffoldGenerator';
import { createMockSession, createMockSegment } from './helpers';

describe('CaptionsScaffoldGenerator', () => {
  let generator: CaptionsScaffoldGenerator;

  beforeEach(() => {
    generator = new CaptionsScaffoldGenerator();
  });

  describe('generateSrt()', () => {
    it('should generate valid SRT with numbered entries', () => {
      const session = createMockSession({
        segments: [
          createMockSegment({
            startTimeMs: 0,
            endTimeMs: 3000,
            draftNarration: 'Welcome to the demo.',
          }),
          createMockSegment({
            startTimeMs: 3000,
            endTimeMs: 7000,
            draftNarration: 'Here is the first step.',
          }),
        ],
      });

      const srt = generator.generateSrt(session);
      expect(srt).to.include('1\n');
      expect(srt).to.include('2\n');
      expect(srt).to.include('Welcome to the demo.');
      expect(srt).to.include('Here is the first step.');
    });

    it('should format timestamps as HH:MM:SS,mmm', () => {
      const session = createMockSession({
        segments: [
          createMockSegment({
            startTimeMs: 65000,
            endTimeMs: 68000,
            draftNarration: 'A caption.',
          }),
        ],
      });

      const srt = generator.generateSrt(session);
      expect(srt).to.include('00:01:05,000'); // start — exercises the HH:MM:SS,mmm format
      expect(srt).to.include('00:01:07,500'); // end = startTimeMs + readingTimeMs('A caption.') = 65000 + 2500
    });

    it('should skip segments with empty narration', () => {
      const session = createMockSession({
        segments: [
          createMockSegment({
            startTimeMs: 0,
            endTimeMs: 3000,
            draftNarration: '',
            cueText: undefined,
            eventSummary: '',
          }),
          createMockSegment({
            startTimeMs: 3000,
            endTimeMs: 6000,
            draftNarration: 'This one has text.',
          }),
        ],
      });

      const srt = generator.generateSrt(session);
      expect(srt).to.not.include('1\n00:00:00,000');
      expect(srt).to.include('This one has text.');
    });

    it('should handle empty segments array', () => {
      const session = createMockSession({ segments: [] });
      const srt = generator.generateSrt(session);
      expect(srt).to.equal('');
    });

    it('should wrap long narration text', () => {
      const longText = 'This is a very long narration text that should be wrapped across multiple lines for caption readability in the SRT output.';
      const session = createMockSession({
        segments: [
          createMockSegment({
            startTimeMs: 0,
            endTimeMs: 10000,
            draftNarration: longText,
          }),
        ],
      });

      const srt = generator.generateSrt(session);
      const lines = srt.split('\n');
      // The text should be broken into multiple lines (not one giant line)
      const textLines = lines.filter(l => l.length > 0 && !l.match(/^\d+$/) && !l.includes('-->'));
      expect(textLines.length).to.be.greaterThan(1);
    });

    it('should use cueText as fallback when draftNarration is empty', () => {
      const session = createMockSession({
        segments: [
          createMockSegment({
            startTimeMs: 0,
            endTimeMs: 3000,
            draftNarration: '',
            cueText: 'Cue text fallback',
          }),
        ],
      });

      const srt = generator.generateSrt(session);
      expect(srt).to.include('Cue text fallback');
    });
  });
});
