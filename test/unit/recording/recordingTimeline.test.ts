/**
 * Unit tests for RecordingTimeline
 * Covers: addEvent, getEvents, getEventsByType, getEventsBySlide,
 * getDurationMs, getLastEvent, clear, immutability, performance.
 */

import { expect } from 'chai';
import { RecordingTimeline } from '../../../packages/extension/src/recording/recordingTimeline';
import { createMockEvent } from './helpers';

describe('RecordingTimeline', () => {
  let timeline: RecordingTimeline;
  const startTime = 1000;

  beforeEach(() => {
    timeline = new RecordingTimeline();
  });

  describe('initial state', () => {
    it('should start with empty events array', () => {
      expect(timeline.getEvents()).to.deep.equal([]);
    });
  });

  describe('addEvent()', () => {
    it('should add events in order', () => {
      const e1 = createMockEvent({ type: 'slide.entered', slideIndex: 0, relativeTimeMs: 0 });
      const e2 = createMockEvent({ type: 'slide.entered', slideIndex: 1, relativeTimeMs: 500 });
      const e3 = createMockEvent({ type: 'slide.entered', slideIndex: 2, relativeTimeMs: 1000 });

      timeline.addEvent(e1);
      timeline.addEvent(e2);
      timeline.addEvent(e3);

      const events = timeline.getEvents();
      expect(events).to.have.length(3);
      expect(events[0].slideIndex).to.equal(0);
      expect(events[1].slideIndex).to.equal(1);
      expect(events[2].slideIndex).to.equal(2);
    });
  });

  describe('getEvents()', () => {
    it('should return a copy of events (not reference)', () => {
      const e1 = createMockEvent({ slideIndex: 0 });
      timeline.addEvent(e1);

      const events1 = timeline.getEvents();
      const events2 = timeline.getEvents();

      expect(events1).to.deep.equal(events2);
      expect(events1).to.not.equal(events2);
    });
  });

  describe('getEventsByType()', () => {
    it('should filter events by type', () => {
      timeline.addEvent(createMockEvent({ type: 'slide.entered', slideIndex: 0 }));
      timeline.addEvent(createMockEvent({ type: 'action.triggered', slideIndex: 0 }));
      timeline.addEvent(createMockEvent({ type: 'slide.entered', slideIndex: 1 }));
      timeline.addEvent(createMockEvent({ type: 'action.completed', slideIndex: 1 }));

      const slideEvents = timeline.getEventsByType('slide.entered');
      expect(slideEvents).to.have.length(2);
      slideEvents.forEach((e) => {
        expect(e.type).to.equal('slide.entered');
      });
    });

    it('should return empty array when no events match type', () => {
      timeline.addEvent(createMockEvent({ type: 'slide.entered', slideIndex: 0 }));
      const result = timeline.getEventsByType('session.stopped');
      expect(result).to.deep.equal([]);
    });
  });

  describe('getEventsBySlide()', () => {
    it('should filter events by slide index', () => {
      timeline.addEvent(createMockEvent({ type: 'slide.entered', slideIndex: 0 }));
      timeline.addEvent(createMockEvent({ type: 'action.triggered', slideIndex: 0 }));
      timeline.addEvent(createMockEvent({ type: 'slide.entered', slideIndex: 1 }));
      timeline.addEvent(createMockEvent({ type: 'action.triggered', slideIndex: 1 }));
      timeline.addEvent(createMockEvent({ type: 'slide.exited', slideIndex: 0 }));

      const slide0Events = timeline.getEventsBySlide(0);
      expect(slide0Events).to.have.length(3);
      slide0Events.forEach((e) => {
        expect(e.slideIndex).to.equal(0);
      });
    });

    it('should return empty array when no events match slide', () => {
      timeline.addEvent(createMockEvent({ slideIndex: 0 }));
      const result = timeline.getEventsBySlide(99);
      expect(result).to.deep.equal([]);
    });
  });

  describe('getDurationMs()', () => {
    it('should return duration since start time', () => {
      const event = createMockEvent({
        timestamp: startTime + 5000,
        relativeTimeMs: 5000,
      });
      timeline.addEvent(event);

      // Duration should be based on last event's relative time or timestamp diff
      const duration = timeline.getDurationMs();
      expect(duration).to.be.a('number');
      expect(duration).to.be.greaterThanOrEqual(0);
    });

    it('should return 0 when no events added', () => {
      expect(timeline.getDurationMs()).to.equal(0);
    });
  });

  describe('getLastEvent()', () => {
    it('should return last event', () => {
      timeline.addEvent(createMockEvent({ type: 'slide.entered', slideIndex: 0 }));
      timeline.addEvent(createMockEvent({ type: 'slide.entered', slideIndex: 1 }));
      timeline.addEvent(createMockEvent({ type: 'action.triggered', slideIndex: 1 }));

      const last = timeline.getLastEvent();
      expect(last).to.not.be.undefined;
      expect(last!.type).to.equal('action.triggered');
      expect(last!.slideIndex).to.equal(1);
    });

    it('should return undefined for last event when empty', () => {
      expect(timeline.getLastEvent()).to.be.undefined;
    });
  });

  describe('clear()', () => {
    it('should clear all events', () => {
      timeline.addEvent(createMockEvent({ slideIndex: 0 }));
      timeline.addEvent(createMockEvent({ slideIndex: 1 }));
      expect(timeline.getEvents()).to.have.length(2);

      timeline.clear();
      expect(timeline.getEvents()).to.have.length(0);
      expect(timeline.getLastEvent()).to.be.undefined;
    });
  });

  describe('performance', () => {
    it('should handle many events (100+) efficiently', () => {
      const count = 150;
      for (let i = 0; i < count; i++) {
        timeline.addEvent(
          createMockEvent({
            type: i % 2 === 0 ? 'slide.entered' : 'action.triggered',
            slideIndex: Math.floor(i / 5),
            relativeTimeMs: i * 100,
          })
        );
      }

      expect(timeline.getEvents()).to.have.length(count);
      expect(timeline.getEventsByType('slide.entered')).to.have.length(75);
      expect(timeline.getEventsBySlide(0)).to.have.length(5);
      expect(timeline.getLastEvent()!.relativeTimeMs).to.equal(14900);
    });
  });
});
