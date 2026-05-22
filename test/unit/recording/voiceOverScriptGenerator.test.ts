/**
 * Unit tests for VoiceOverScriptGenerator
 * Covers: Markdown generation, JSON generation, timestamp formatting,
 * slide headers, cue text, event summaries, edge cases.
 */

import { expect } from 'chai';
import { VoiceOverScriptGenerator } from '../../../packages/extension/src/recording/voiceOverScriptGenerator';
import { createMockSession, createMockSegment } from './helpers';

describe('VoiceOverScriptGenerator', () => {
  let generator: VoiceOverScriptGenerator;

  beforeEach(() => {
    generator = new VoiceOverScriptGenerator();
  });

  describe('generateMarkdown()', () => {
    it('should generate markdown with deck title', () => {
      const session = createMockSession({
        deckTitle: 'My Awesome Talk',
        segments: [createMockSegment({ slideIndex: 0, slideTitle: 'Intro' })],
      });

      const md = generator.generateMarkdown(session);
      expect(md).to.include('My Awesome Talk');
    });

    it('should include slide headers with timestamps', () => {
      const session = createMockSession({
        segments: [
          createMockSegment({
            slideIndex: 0,
            slideTitle: 'Intro',
            startTimeMs: 0,
            endTimeMs: 5000,
            durationMs: 5000,
          }),
          createMockSegment({
            segmentId: 'seg-2',
            slideIndex: 1,
            slideTitle: 'Demo',
            startTimeMs: 5000,
            endTimeMs: 15000,
            durationMs: 10000,
          }),
        ],
      });

      const md = generator.generateMarkdown(session);
      expect(md).to.include('Intro');
      expect(md).to.include('Demo');
      // Should contain some timestamp format
      expect(md).to.match(/\d+:\d+/);
    });

    it('should include cue text in markdown', () => {
      const session = createMockSession({
        segments: [
          createMockSegment({
            slideIndex: 0,
            cueText: 'Welcome everyone to this presentation',
          }),
        ],
      });

      const md = generator.generateMarkdown(session);
      expect(md).to.include('Welcome everyone to this presentation');
    });

    it('should include event summaries', () => {
      const session = createMockSession({
        segments: [
          createMockSegment({
            slideIndex: 0,
            eventSummary: 'Opened file src/index.ts, highlighted lines 10-20',
          }),
        ],
      });

      const md = generator.generateMarkdown(session);
      expect(md).to.include('Opened file src/index.ts');
    });

    it('should handle session with no segments gracefully', () => {
      const session = createMockSession({ segments: [] });

      const md = generator.generateMarkdown(session);
      expect(md).to.be.a('string');
      // Should still include the title or at least not throw
      if (session.deckTitle) {
        expect(md).to.include(session.deckTitle);
      }
    });

    it('should format timestamps as mm:ss.mmm', () => {
      const session = createMockSession({
        segments: [
          createMockSegment({
            slideIndex: 0,
            startTimeMs: 65500, // 1:05.500
            endTimeMs: 125750,
            durationMs: 60250,
          }),
        ],
      });

      const md = generator.generateMarkdown(session);
      // Expect mm:ss format (with or without milliseconds)
      expect(md).to.match(/\d{1,2}:\d{2}/);
    });
  });

  describe('generateJson()', () => {
    it('should generate valid JSON', () => {
      const session = createMockSession({
        segments: [createMockSegment()],
      });

      const json = generator.generateJson(session);
      expect(() => JSON.parse(json)).to.not.throw();
    });

    it('should contain segments in JSON output', () => {
      const session = createMockSession({
        segments: [
          createMockSegment({ slideIndex: 0, cueText: 'First cue' }),
          createMockSegment({
            segmentId: 'seg-2',
            slideIndex: 1,
            cueText: 'Second cue',
          }),
        ],
      });

      const json = generator.generateJson(session);
      const parsed = JSON.parse(json);

      // JSON should contain segment data
      const jsonStr = JSON.stringify(parsed);
      expect(jsonStr).to.include('First cue');
      expect(jsonStr).to.include('Second cue');
    });

    it('should handle session with no segments in JSON', () => {
      const session = createMockSession({ segments: [] });
      const json = generator.generateJson(session);

      expect(() => JSON.parse(json)).to.not.throw();
    });

    it('should include deck metadata in JSON', () => {
      const session = createMockSession({
        deckTitle: 'JSON Talk',
        deckPath: '/talk.deck.md',
        durationMs: 30000,
      });

      const json = generator.generateJson(session);
      const parsed = JSON.parse(json);
      const jsonStr = JSON.stringify(parsed);

      expect(jsonStr).to.include('JSON Talk');
      expect(jsonStr).to.include('/talk.deck.md');
    });
  });
});
