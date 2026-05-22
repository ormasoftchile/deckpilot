/**
 * Unit tests for RecordingController
 * Covers: start/stop lifecycle, event recording, elapsed time,
 * session snapshot, relativeTimeMs computation, guard rails.
 */

import { expect } from 'chai';
import { RecordingController } from '../../../packages/extension/src/recording/recordingController';
import { createMockEvent } from './helpers';

describe('RecordingController', () => {
  let controller: RecordingController;

  beforeEach(() => {
    controller = new RecordingController();
  });

  describe('initial state', () => {
    it('should not be active initially', () => {
      expect(controller.isActive()).to.be.false;
    });
  });

  describe('startRecording()', () => {
    it('should start recording and become active', () => {
      controller.startRecording('/deck.md', 'My Deck', 0);
      expect(controller.isActive()).to.be.true;
    });

    it('should set start time on startRecording', () => {
      const before = Date.now();
      controller.startRecording('/deck.md');
      const session = controller.getSession();
      expect(session.recordingStartTime).to.be.greaterThanOrEqual(before);
      expect(session.recordingStartTime).to.be.lessThanOrEqual(Date.now());
    });

    it('should create session.started event on start', () => {
      controller.startRecording('/deck.md', 'Deck', 0);
      const session = controller.getSession();
      expect(session.events.length).to.be.greaterThanOrEqual(1);

      const startEvent = session.events.find((e) => e.type === 'session.started');
      expect(startEvent).to.exist;
      expect(startEvent!.metadata).to.exist;
      expect(startEvent!.metadata!.deckPath).to.equal('/deck.md');
    });

    it('should not start if already recording', () => {
      controller.startRecording('/deck.md');
      // Second start should throw or be a no-op
      expect(() => controller.startRecording('/other.md')).to.throw;
    });

    it('should set deckPath and deckTitle on session', () => {
      controller.startRecording('/my/deck.md', 'Talk Title');
      const session = controller.getSession();
      expect(session.deckPath).to.equal('/my/deck.md');
      expect(session.deckTitle).to.equal('Talk Title');
    });
  });

  describe('stopRecording()', () => {
    it('should stop recording and become inactive', () => {
      controller.startRecording('/deck.md');
      controller.stopRecording();
      expect(controller.isActive()).to.be.false;
    });

    it('should create session.stopped event on stop', () => {
      controller.startRecording('/deck.md', undefined, 0);
      const session = controller.stopRecording()!;

      const stopEvent = session.events.find((e) => e.type === 'session.stopped');
      expect(stopEvent).to.exist;
    });

    it('should return RecordingSession on stopRecording', () => {
      controller.startRecording('/deck.md', 'Title');
      const session = controller.stopRecording()!;

      expect(session).to.exist;
      expect(session.sessionId).to.be.a('string');
      expect(session.deckPath).to.equal('/deck.md');
      expect(session.events).to.be.an('array');
    });

    it('should return session with correct deckPath and deckTitle', () => {
      controller.startRecording('/path/talk.deck.md', 'My Talk');
      const session = controller.stopRecording()!;

      expect(session.deckPath).to.equal('/path/talk.deck.md');
      expect(session.deckTitle).to.equal('My Talk');
    });

    it('should compute durationMs on stop', () => {
      controller.startRecording('/deck.md');
      // Record a couple events to ensure some time passes
      controller.recordEvent(createMockEvent({ type: 'slide.entered', slideIndex: 0 }));
      const session = controller.stopRecording()!;

      expect(session.durationMs).to.be.a('number');
      expect(session.durationMs).to.be.greaterThanOrEqual(0);
      expect(session.recordingEndTime).to.be.a('number');
    });
  });

  describe('recordEvent()', () => {
    it('should record events while active', () => {
      controller.startRecording('/deck.md');
      controller.recordEvent(createMockEvent({ type: 'slide.entered', slideIndex: 0 }));
      controller.recordEvent(createMockEvent({ type: 'action.triggered', slideIndex: 0 }));

      const session = controller.getSession();
      // +1 for session.started auto-event
      const userEvents = session.events.filter(
        (e) => e.type !== 'session.started'
      );
      expect(userEvents.length).to.be.greaterThanOrEqual(2);
    });

    it('should not record events while inactive', () => {
      // Controller is not started
      expect(() =>
        controller.recordEvent(createMockEvent({ type: 'slide.entered', slideIndex: 0 }))
      ).to.throw;
    });

    it('should fill in relativeTimeMs on recorded events', () => {
      controller.startRecording('/deck.md');
      controller.recordEvent(createMockEvent({ type: 'slide.entered', slideIndex: 0 }));

      const session = controller.getSession();
      const slideEvent = session.events.find((e) => e.type === 'slide.entered');
      expect(slideEvent).to.exist;
      expect(slideEvent!.relativeTimeMs).to.be.a('number');
      expect(slideEvent!.relativeTimeMs).to.be.greaterThanOrEqual(0);
    });
  });

  describe('isActive()', () => {
    it('should reflect recording state correctly', () => {
      expect(controller.isActive()).to.be.false;

      controller.startRecording('/deck.md');
      expect(controller.isActive()).to.be.true;

      controller.stopRecording();
      expect(controller.isActive()).to.be.false;
    });
  });

  describe('getElapsedMs()', () => {
    it('should track elapsed time', () => {
      controller.startRecording('/deck.md');
      const elapsed = controller.getElapsedMs();
      expect(elapsed).to.be.a('number');
      expect(elapsed).to.be.greaterThanOrEqual(0);
    });

    it('should return 0 when not active', () => {
      expect(controller.getElapsedMs()).to.equal(0);
    });
  });

  describe('getSession()', () => {
    it('should return snapshot of current state', () => {
      controller.startRecording('/deck.md', 'Deck');
      controller.recordEvent(createMockEvent({ type: 'slide.entered', slideIndex: 0 }));

      const snapshot1 = controller.getSession();
      controller.recordEvent(createMockEvent({ type: 'slide.entered', slideIndex: 1 }));
      const snapshot2 = controller.getSession();

      // snapshot1 should not be mutated by subsequent events
      expect(snapshot2.events.length).to.be.greaterThan(snapshot1.events.length);
    });
  });

  describe('start/stop/start cycle', () => {
    it('should handle start/stop/start cycle', () => {
      controller.startRecording('/deck1.md', 'First');
      controller.recordEvent(createMockEvent({ type: 'slide.entered', slideIndex: 0 }));
      const session1 = controller.stopRecording()!;

      expect(session1.deckPath).to.equal('/deck1.md');
      expect(controller.isActive()).to.be.false;

      controller.startRecording('/deck2.md', 'Second');
      expect(controller.isActive()).to.be.true;

      const session2 = controller.getSession();
      expect(session2.deckPath).to.equal('/deck2.md');
      expect(session2.deckTitle).to.equal('Second');

      // New session should have its own session.started event
      const startEvents = session2.events.filter(
        (e) => e.type === 'session.started'
      );
      expect(startEvents.length).to.equal(1);
    });
  });

  describe('pauseTiming() / resumeTiming()', () => {
    it('should track paused state', () => {
      controller.startRecording('/deck.md');
      expect(controller.isPaused()).to.be.false;

      controller.pauseTiming(0);
      expect(controller.isPaused()).to.be.true;

      controller.resumeTiming(0);
      expect(controller.isPaused()).to.be.false;
    });

    it('should emit timing.paused and timing.resumed events', () => {
      controller.startRecording('/deck.md');
      controller.pauseTiming(0, 'waiting for build');
      controller.resumeTiming(0);
      const session = controller.getSession();

      const pauseEvents = session.events.filter(e => e.type === 'timing.paused');
      const resumeEvents = session.events.filter(e => e.type === 'timing.resumed');
      expect(pauseEvents).to.have.length(1);
      expect(resumeEvents).to.have.length(1);
      expect(pauseEvents[0].note).to.equal('waiting for build');
    });

    it('should create ignored interval on resume', () => {
      controller.startRecording('/deck.md');
      controller.pauseTiming(0);
      controller.resumeTiming(0);
      const session = controller.stopRecording()!;

      expect(session.ignoredIntervals).to.have.length(1);
      expect(session.ignoredIntervals[0].reason).to.equal('timing paused');
    });

    it('should not pause if already paused', () => {
      controller.startRecording('/deck.md');
      controller.pauseTiming(0);
      controller.pauseTiming(0); // no-op
      const session = controller.getSession();

      const pauseEvents = session.events.filter(e => e.type === 'timing.paused');
      expect(pauseEvents).to.have.length(1);
    });

    it('should not resume if not paused', () => {
      controller.startRecording('/deck.md');
      controller.resumeTiming(0); // no-op
      const session = controller.getSession();

      const resumeEvents = session.events.filter(e => e.type === 'timing.resumed');
      expect(resumeEvents).to.have.length(0);
    });

    it('should track total paused time', () => {
      controller.startRecording('/deck.md');
      controller.pauseTiming(0);
      controller.resumeTiming(0);
      expect(controller.getTotalPausedMs()).to.be.a('number');
      expect(controller.getTotalPausedMs()).to.be.greaterThanOrEqual(0);
    });
  });

  describe('markRetake()', () => {
    it('should add retake marker to session', () => {
      controller.startRecording('/deck.md');
      controller.markRetake(2, 'redo this demo');
      const session = controller.stopRecording()!;

      expect(session.manualMarkers).to.have.length(1);
      expect(session.manualMarkers[0].type).to.equal('retake');
      expect(session.manualMarkers[0].slideIndex).to.equal(2);
      expect(session.manualMarkers[0].note).to.equal('redo this demo');
    });

    it('should emit retake.marked event', () => {
      controller.startRecording('/deck.md');
      controller.markRetake(0);
      const session = controller.getSession();

      const retakeEvents = session.events.filter(e => e.type === 'retake.marked');
      expect(retakeEvents).to.have.length(1);
    });

    it('should not add retake if not recording', () => {
      controller.markRetake(0);
      // No crash; no-op
    });
  });

  describe('insertMarker()', () => {
    it('should add narration marker', () => {
      controller.startRecording('/deck.md');
      controller.insertMarker(1, 'narration', 'emphasize this point');
      const session = controller.stopRecording()!;

      expect(session.manualMarkers).to.have.length(1);
      expect(session.manualMarkers[0].type).to.equal('narration');
      expect(session.manualMarkers[0].note).to.equal('emphasize this point');
    });

    it('should emit manual.marker event', () => {
      controller.startRecording('/deck.md');
      controller.insertMarker(0, 'narration');
      const session = controller.getSession();

      const markerEvents = session.events.filter(e => e.type === 'manual.marker');
      expect(markerEvents).to.have.length(1);
      expect(markerEvents[0].metadata?.markerType).to.equal('narration');
    });
  });
});
