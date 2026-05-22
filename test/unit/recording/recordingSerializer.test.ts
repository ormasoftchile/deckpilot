/**
 * Unit tests for RecordingSerializer
 * Covers: JSON serialization, field completeness, formatting, edge cases.
 */

import { expect } from 'chai';
import { RecordingSerializer } from '../../../packages/extension/src/recording/recordingSerializer';
import { createMockSession, createMockEvent, createMockSegment } from './helpers';

describe('RecordingSerializer', () => {
  let serializer: RecordingSerializer;

  beforeEach(() => {
    serializer = new RecordingSerializer();
  });

  describe('serializeSession()', () => {
    it('should serialize session to valid JSON', () => {
      const session = createMockSession();
      const json = serializer.serializeSession(session);

      expect(() => JSON.parse(json)).to.not.throw();
    });

    it('should include all session fields', () => {
      const session = createMockSession({
        events: [createMockEvent({ type: 'session.started', slideIndex: 0 })],
        segments: [createMockSegment()],
        manualMarkers: [
          {
            id: 'marker-1',
            type: 'narration',
            relativeTimeMs: 1000,
            slideIndex: 0,
            note: 'Test marker',
          },
        ],
        ignoredIntervals: [
          { startTimeMs: 5000, endTimeMs: 8000, reason: 'pause' },
        ],
      });

      const json = serializer.serializeSession(session);
      const parsed = JSON.parse(json);

      expect(parsed.sessionId).to.equal(session.sessionId);
      expect(parsed.deckPath).to.equal(session.deckPath);
      expect(parsed.deckTitle).to.equal(session.deckTitle);
      expect(parsed.recordingStartTime).to.equal(session.recordingStartTime);
      expect(parsed.recordingEndTime).to.equal(session.recordingEndTime);
      expect(parsed.durationMs).to.equal(session.durationMs);
      expect(parsed.events).to.be.an('array').with.length(1);
      expect(parsed.segments).to.be.an('array').with.length(1);
      expect(parsed.manualMarkers).to.be.an('array').with.length(1);
      expect(parsed.ignoredIntervals).to.be.an('array').with.length(1);
      expect(parsed.exportMetadata).to.exist;
      expect(parsed.exportMetadata.extensionVersion).to.be.a('string');
    });

    it('should use 2-space indentation', () => {
      const session = createMockSession();
      const json = serializer.serializeSession(session);

      // 2-space indentation means the second line starts with two spaces
      const lines = json.split('\n');
      expect(lines.length).to.be.greaterThan(1);
      // Find a line that has indentation
      const indentedLine = lines.find((l) => l.startsWith('  '));
      expect(indentedLine).to.exist;
      // Ensure it's not 4-space indentation on the first level
      const firstIndentedLine = lines.find((l) => /^\s+".+":/.test(l));
      if (firstIndentedLine) {
        const leadingSpaces = firstIndentedLine.match(/^(\s*)/)?.[1].length ?? 0;
        expect(leadingSpaces).to.equal(2);
      }
    });

    it('should handle session with empty events array', () => {
      const session = createMockSession({ events: [] });
      const json = serializer.serializeSession(session);
      const parsed = JSON.parse(json);

      expect(parsed.events).to.deep.equal([]);
    });

    it('should handle session with many events', () => {
      const events = Array.from({ length: 200 }, (_, i) =>
        createMockEvent({
          type: i % 2 === 0 ? 'slide.entered' : 'slide.exited',
          slideIndex: Math.floor(i / 2),
          relativeTimeMs: i * 100,
        })
      );
      const session = createMockSession({ events });

      const json = serializer.serializeSession(session);
      const parsed = JSON.parse(json);

      expect(parsed.events).to.have.length(200);
    });

    it('should preserve event metadata through serialization', () => {
      const event = createMockEvent({
        type: 'action.triggered',
        slideIndex: 1,
        metadata: { actionId: 'act-1', actionType: 'terminal.run', custom: 42 },
      });
      const session = createMockSession({ events: [event] });

      const json = serializer.serializeSession(session);
      const parsed = JSON.parse(json);

      expect(parsed.events[0].metadata.actionId).to.equal('act-1');
      expect(parsed.events[0].metadata.actionType).to.equal('terminal.run');
      expect(parsed.events[0].metadata.custom).to.equal(42);
    });
  });
});
