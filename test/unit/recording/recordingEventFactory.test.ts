/**
 * Unit tests for RecordingEventFactory
 * Covers: all create*Event helpers, unique IDs, timestamps, relativeTimeMs defaults.
 */

import { expect } from 'chai';
import {
  createSessionStartedEvent,
  createSessionStoppedEvent,
  createSlideEnteredEvent,
  createSlideExitedEvent,
  createFragmentRevealedEvent,
  createActionTriggeredEvent,
  createActionCompletedEvent,
  createFileOpenedEvent,
  createEditorHighlightedEvent,
  createSceneRestoredEvent,
  createManualMarkerEvent,
  createTimingPausedEvent,
  createTimingResumedEvent,
  createRetakeMarkedEvent,
} from '../../../src/recording/recordingEventFactory';
import { RecordingEvent } from '../../../src/models/recording';

describe('RecordingEventFactory', () => {
  /** Helper to assert common event properties */
  function assertBaseEvent(event: RecordingEvent): void {
    expect(event.id).to.be.a('string').and.to.have.length.greaterThan(0);
    expect(event.timestamp).to.be.a('number').and.to.be.greaterThan(0);
    expect(event.relativeTimeMs).to.equal(0);
    expect(event.slideIndex).to.be.a('number');
  }

  describe('createSessionStartedEvent()', () => {
    it('should create session.started event with deckPath in metadata', () => {
      const event = createSessionStartedEvent('/path/to/deck.md', 0);

      expect(event.type).to.equal('session.started');
      expect(event.slideIndex).to.equal(0);
      expect(event.metadata).to.exist;
      expect(event.metadata!.deckPath).to.equal('/path/to/deck.md');
      assertBaseEvent(event);
    });
  });

  describe('createSessionStoppedEvent()', () => {
    it('should create session.stopped event', () => {
      const event = createSessionStoppedEvent(5);

      expect(event.type).to.equal('session.stopped');
      expect(event.slideIndex).to.equal(5);
      assertBaseEvent(event);
    });
  });

  describe('createSlideEnteredEvent()', () => {
    it('should create slide.entered event with navigation metadata', () => {
      const event = createSlideEnteredEvent(3, 2, 'jump', 4, 'My Slide');

      expect(event.type).to.equal('slide.entered');
      expect(event.slideIndex).to.equal(3);
      expect(event.metadata).to.exist;
      expect(event.metadata!.previousSlideIndex).to.equal(2);
      expect(event.metadata!.navigationMethod).to.equal('jump');
      expect(event.metadata!.fragmentCount).to.equal(4);
      expect(event.metadata!.slideTitle).to.equal('My Slide');
      assertBaseEvent(event);
    });

    it('should handle missing slideTitle', () => {
      const event = createSlideEnteredEvent(1, 0, 'sequential', 0);

      expect(event.type).to.equal('slide.entered');
      expect(event.metadata).to.exist;
      expect(event.metadata!.slideTitle).to.be.undefined;
    });
  });

  describe('createSlideExitedEvent()', () => {
    it('should create slide.exited event', () => {
      const event = createSlideExitedEvent(2);

      expect(event.type).to.equal('slide.exited');
      expect(event.slideIndex).to.equal(2);
      assertBaseEvent(event);
    });
  });

  describe('createFragmentRevealedEvent()', () => {
    it('should create fragment.revealed event with fragment index', () => {
      const event = createFragmentRevealedEvent(1, 2, 5);

      expect(event.type).to.equal('fragment.revealed');
      expect(event.slideIndex).to.equal(1);
      expect(event.fragmentIndex).to.equal(2);
      expect(event.metadata).to.exist;
      expect(event.metadata!.fragmentCount).to.equal(5);
      assertBaseEvent(event);
    });
  });

  describe('createActionTriggeredEvent()', () => {
    it('should create action.triggered event with action metadata', () => {
      const event = createActionTriggeredEvent(0, 'act-1', 'terminal.run', 'npm test');

      expect(event.type).to.equal('action.triggered');
      expect(event.slideIndex).to.equal(0);
      expect(event.metadata).to.exist;
      expect(event.metadata!.actionId).to.equal('act-1');
      expect(event.metadata!.actionType).to.equal('terminal.run');
      expect(event.metadata!.actionTarget).to.equal('npm test');
      assertBaseEvent(event);
    });

    it('should handle missing actionTarget', () => {
      const event = createActionTriggeredEvent(0, 'act-2', 'file.open');

      expect(event.metadata!.actionTarget).to.be.undefined;
    });
  });

  describe('createActionCompletedEvent()', () => {
    it('should create action.completed event with success=true', () => {
      const event = createActionCompletedEvent(0, 'act-1', 'terminal.run', true, 1500);

      expect(event.type).to.equal('action.completed');
      expect(event.slideIndex).to.equal(0);
      expect(event.metadata).to.exist;
      expect(event.metadata!.actionId).to.equal('act-1');
      expect(event.metadata!.actionType).to.equal('terminal.run');
      expect(event.metadata!.success).to.be.true;
      expect(event.metadata!.durationMs).to.equal(1500);
      expect(event.metadata!.error).to.be.undefined;
      assertBaseEvent(event);
    });

    it('should create action.completed event with success=false and error', () => {
      const event = createActionCompletedEvent(1, 'act-2', 'debug.start', false, 200, 'Launch config not found');

      expect(event.type).to.equal('action.completed');
      expect(event.metadata!.success).to.be.false;
      expect(event.metadata!.error).to.equal('Launch config not found');
      expect(event.metadata!.durationMs).to.equal(200);
      assertBaseEvent(event);
    });
  });

  describe('createFileOpenedEvent()', () => {
    it('should create file.opened event with file path', () => {
      const event = createFileOpenedEvent(2, '/src/index.ts');

      expect(event.type).to.equal('file.opened');
      expect(event.slideIndex).to.equal(2);
      expect(event.metadata).to.exist;
      expect(event.metadata!.filePath).to.equal('/src/index.ts');
      assertBaseEvent(event);
    });
  });

  describe('createEditorHighlightedEvent()', () => {
    it('should create editor.highlighted event with file and lines', () => {
      const event = createEditorHighlightedEvent(3, '/src/app.ts', '10-20');

      expect(event.type).to.equal('editor.highlighted');
      expect(event.slideIndex).to.equal(3);
      expect(event.metadata).to.exist;
      expect(event.metadata!.filePath).to.equal('/src/app.ts');
      expect(event.metadata!.lines).to.equal('10-20');
      assertBaseEvent(event);
    });
  });

  describe('createSceneRestoredEvent()', () => {
    it('should create scene.restored event with scene name', () => {
      const event = createSceneRestoredEvent(4, 'demo-setup');

      expect(event.type).to.equal('scene.restored');
      expect(event.slideIndex).to.equal(4);
      expect(event.metadata).to.exist;
      expect(event.metadata!.sceneName).to.equal('demo-setup');
      assertBaseEvent(event);
    });
  });

  describe('cross-cutting concerns', () => {
    it('every created event should have unique id', () => {
      const events: RecordingEvent[] = [
        createSessionStartedEvent('/deck.md', 0),
        createSessionStoppedEvent(0),
        createSlideEnteredEvent(1, 0, 'sequential', 0),
        createSlideExitedEvent(0),
        createFragmentRevealedEvent(1, 0, 3),
        createActionTriggeredEvent(0, 'a1', 'file.open'),
        createActionCompletedEvent(0, 'a1', 'file.open', true, 100),
        createFileOpenedEvent(0, '/f.ts'),
        createEditorHighlightedEvent(0, '/f.ts', '1-5'),
        createSceneRestoredEvent(0, 'sc'),
      ];

      const ids = events.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).to.equal(ids.length);
    });

    it('every created event should have timestamp > 0', () => {
      const event = createSessionStartedEvent('/deck.md', 0);
      expect(event.timestamp).to.be.greaterThan(0);
    });

    it('events should have relativeTimeMs = 0 (caller fills in offset)', () => {
      const events: RecordingEvent[] = [
        createSessionStartedEvent('/deck.md', 0),
        createSlideEnteredEvent(1, 0, 'jump', 2),
        createActionTriggeredEvent(0, 'a1', 'terminal.run'),
      ];

      events.forEach((e) => {
        expect(e.relativeTimeMs).to.equal(0);
      });
    });
  });

  describe('createManualMarkerEvent()', () => {
    it('should create manual.marker event with markerType', () => {
      const event = createManualMarkerEvent(2, 'narration', 'important point');
      assertBaseEvent(event);
      expect(event.type).to.equal('manual.marker');
      expect(event.slideIndex).to.equal(2);
      expect(event.metadata?.markerType).to.equal('narration');
      expect(event.note).to.equal('important point');
    });
  });

  describe('createTimingPausedEvent()', () => {
    it('should create timing.paused event', () => {
      const event = createTimingPausedEvent(1, 'build running');
      assertBaseEvent(event);
      expect(event.type).to.equal('timing.paused');
      expect(event.slideIndex).to.equal(1);
      expect(event.note).to.equal('build running');
    });
  });

  describe('createTimingResumedEvent()', () => {
    it('should create timing.resumed event', () => {
      const event = createTimingResumedEvent(1);
      assertBaseEvent(event);
      expect(event.type).to.equal('timing.resumed');
    });
  });

  describe('createRetakeMarkedEvent()', () => {
    it('should create retake.marked event', () => {
      const event = createRetakeMarkedEvent(3, 'redo demo');
      assertBaseEvent(event);
      expect(event.type).to.equal('retake.marked');
      expect(event.slideIndex).to.equal(3);
      expect(event.note).to.equal('redo demo');
    });
  });
});
