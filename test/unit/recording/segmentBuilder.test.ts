/**
 * Unit tests for SegmentBuilder
 * Covers: segment creation from events and cues, fragment boundaries,
 * cue text assignment, speaker notes fallback, duration computation.
 */

import { expect } from 'chai';
import { buildSegments } from '../../../packages/extension/src/recording/segmentBuilder';
import { RecordingEvent, VoiceOverCue, IgnoredInterval } from '../../../packages/core/src/models/recording';
import { createMockEvent, createMockSlide } from './helpers';

describe('SegmentBuilder', () => {
  describe('buildSegments()', () => {
    it('should create one segment per slide when no fragments', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 0 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 5000 }),
        createMockEvent({ type: 'slide.entered', slideIndex: 1, relativeTimeMs: 5000 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 1, relativeTimeMs: 10000 }),
      ];
      const cues: VoiceOverCue[] = [];
      const slides = [
        createMockSlide({ index: 0 }),
        createMockSlide({ index: 1 }),
      ];

      const segments = buildSegments(events, cues, slides);
      expect(segments).to.have.length(2);
      expect(segments[0].slideIndex).to.equal(0);
      expect(segments[1].slideIndex).to.equal(1);
    });

    it('should not duplicate the first slide for its initial entered event', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'session.started', slideIndex: 0, relativeTimeMs: 0 }),
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 900 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 3000 }),
      ];
      const cues: VoiceOverCue[] = [
        { slideIndex: 0, text: 'Opening narration', source: 'frontmatter' },
      ];
      const slides = [createMockSlide({ index: 0 })];

      const segments = buildSegments(events, cues, slides);

      expect(segments).to.have.length(1);
      expect(segments[0].cueText).to.equal('Opening narration');
    });

    it('should create segments at fragment boundaries', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 0 }),
        createMockEvent({ type: 'fragment.revealed', slideIndex: 0, fragmentIndex: 0, relativeTimeMs: 2000 }),
        createMockEvent({ type: 'fragment.revealed', slideIndex: 0, fragmentIndex: 1, relativeTimeMs: 4000 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 6000 }),
      ];
      const cues: VoiceOverCue[] = [];
      const slides = [createMockSlide({ index: 0 })];

      const segments = buildSegments(events, cues, slides);
      // Expect segments for the initial slide + each fragment reveal
      expect(segments.length).to.be.greaterThanOrEqual(2);
    });

    it('should use cue text when available', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 0 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 5000 }),
      ];
      const cues: VoiceOverCue[] = [
        { slideIndex: 0, text: 'Welcome to the presentation', source: 'comment' },
      ];
      const slides = [createMockSlide({ index: 0 })];

      const segments = buildSegments(events, cues, slides);
      expect(segments.length).to.be.greaterThanOrEqual(1);
      expect(segments[0].cueText).to.equal('Welcome to the presentation');
    });

    it('should use the measured take duration for a narrated segment', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 0 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 10000 }),
      ];
      const cues: VoiceOverCue[] = [
        { slideIndex: 0, text: 'Brief cue', source: 'comment' },
      ];
      const slides = [createMockSlide({ index: 0 })];

      const segments = buildSegments(events, cues, slides, [], [
        { cueIndex: 1, text: 'Brief cue', durationMs: 4123 },
      ]);

      expect(segments[0].endTimeMs).to.equal(4123);
      expect(segments[0].durationMs).to.equal(4123);
    });

    it('should map ordered sidecar narration to completed actions', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 0 }),
        createMockEvent({ type: 'action.completed', slideIndex: 0, relativeTimeMs: 3000 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 6000 }),
      ];
      const cues: VoiceOverCue[] = [
        { slideIndex: 0, text: 'Introduce the slide', source: 'frontmatter' },
        { slideIndex: 0, fragmentIndex: 1, text: 'Explain the action result', source: 'frontmatter' },
      ];
      const slides = [createMockSlide({ index: 0 })];

      const segments = buildSegments(events, cues, slides);

      expect(segments).to.have.length(2);
      expect(segments[1].startTimeMs).to.equal(3000);
      expect(segments[1].cueText).to.equal('Explain the action result');
    });

    it('should create timed narration segments within a video item', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 1, relativeTimeMs: 5000 }),
        createMockEvent({ type: 'video.started', slideIndex: 1, relativeTimeMs: 5100 }),
        createMockEvent({ type: 'video.ended', slideIndex: 1, relativeTimeMs: 10100 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 1, relativeTimeMs: 10200 }),
      ];
      const cues: VoiceOverCue[] = [
        { slideIndex: 1, text: 'Introduce the clip', source: 'frontmatter' },
        { slideIndex: 1, text: 'Point out the output', source: 'frontmatter', offsetMs: 2500 },
      ];
      const slides = [createMockSlide({ index: 0 }), createMockSlide({
        index: 1,
        video: { id: 'demo', src: './clips/demo.mp4', audio: 'duck' },
      })];

      const segments = buildSegments(events, cues, slides);
      const timed = segments.find(segment => segment.cueText === 'Point out the output');

      expect(timed?.startTimeMs).to.equal(7600);
    });

    it('should fall back to speaker notes when no cue', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 0 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 5000 }),
      ];
      const cues: VoiceOverCue[] = [];
      const slides = [
        createMockSlide({ index: 0, speakerNotes: 'Notes for this slide' }),
      ];

      const segments = buildSegments(events, cues, slides);
      expect(segments.length).to.be.greaterThanOrEqual(1);
      expect(segments[0].speakerNotes).to.equal('Notes for this slide');
    });

    it('should compute correct segment durations', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 0 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 3000 }),
        createMockEvent({ type: 'slide.entered', slideIndex: 1, relativeTimeMs: 3000 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 1, relativeTimeMs: 8000 }),
      ];
      const cues: VoiceOverCue[] = [];
      const slides = [
        createMockSlide({ index: 0 }),
        createMockSlide({ index: 1 }),
      ];

      const segments = buildSegments(events, cues, slides);
      expect(segments[0].durationMs).to.equal(3000);
      expect(segments[1].durationMs).to.equal(5000);
    });

    it('should handle single-slide recording', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 0 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 10000 }),
      ];
      const cues: VoiceOverCue[] = [];
      const slides = [createMockSlide({ index: 0 })];

      const segments = buildSegments(events, cues, slides);
      expect(segments).to.have.length(1);
      expect(segments[0].slideIndex).to.equal(0);
      expect(segments[0].durationMs).to.equal(10000);
    });

    it('should handle recording with no events (empty segments)', () => {
      const events: RecordingEvent[] = [];
      const cues: VoiceOverCue[] = [];
      const slides = [createMockSlide({ index: 0 })];

      const segments = buildSegments(events, cues, slides);
      expect(segments).to.be.an('array');
    });

    it('segments should cover full recording duration', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 0 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 4000 }),
        createMockEvent({ type: 'slide.entered', slideIndex: 1, relativeTimeMs: 4000 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 1, relativeTimeMs: 9000 }),
      ];
      const cues: VoiceOverCue[] = [];
      const slides = [
        createMockSlide({ index: 0 }),
        createMockSlide({ index: 1 }),
      ];

      const segments = buildSegments(events, cues, slides);
      const totalDuration = segments.reduce((sum: number, s) => sum + s.durationMs, 0);
      expect(totalDuration).to.equal(9000);
    });

    it('segment startTime of first segment should match first slide event', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 100 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 5000 }),
      ];
      const cues: VoiceOverCue[] = [];
      const slides = [createMockSlide({ index: 0 })];

      const segments = buildSegments(events, cues, slides);
      expect(segments[0].startTimeMs).to.equal(100);
    });

    it('should subtract ignored interval time from segment duration', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 0 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 10000 }),
      ];
      const cues: VoiceOverCue[] = [];
      const slides = [createMockSlide({ index: 0 })];
      const ignored: IgnoredInterval[] = [
        { startTimeMs: 3000, endTimeMs: 5000, reason: 'pause' },
      ];

      const segments = buildSegments(events, cues, slides, ignored);
      expect(segments).to.have.length(1);
      // 10000ms total - 2000ms ignored = 8000ms effective
      expect(segments[0].durationMs).to.equal(8000);
    });

    it('should handle multiple ignored intervals', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 0 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 20000 }),
      ];
      const cues: VoiceOverCue[] = [];
      const slides = [createMockSlide({ index: 0 })];
      const ignored: IgnoredInterval[] = [
        { startTimeMs: 2000, endTimeMs: 4000, reason: 'pause 1' },
        { startTimeMs: 10000, endTimeMs: 13000, reason: 'pause 2' },
      ];

      const segments = buildSegments(events, cues, slides, ignored);
      // 20000 - 2000 - 3000 = 15000
      expect(segments[0].durationMs).to.equal(15000);
    });

    it('should not subtract ignored intervals outside segment range', () => {
      const events: RecordingEvent[] = [
        createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 5000 }),
        createMockEvent({ type: 'slide.exited', slideIndex: 0, relativeTimeMs: 10000 }),
      ];
      const cues: VoiceOverCue[] = [];
      const slides = [createMockSlide({ index: 0 })];
      const ignored: IgnoredInterval[] = [
        { startTimeMs: 0, endTimeMs: 3000, reason: 'before segment' },
      ];

      const segments = buildSegments(events, cues, slides, ignored);
      expect(segments[0].durationMs).to.equal(5000);
    });
  });
});
