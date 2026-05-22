/**
 * RecordingTimeline — append-only event stream for a recording session.
 *
 * Manages the ordered list of RecordingEvents. The timeline is separate
 * from the undo/redo StateStack and has no entry limit.
 */

import { RecordingEvent, RecordingEventType } from '@deckpilot/core/models/recording';

/**
 * Manages the append-only event stream during a recording session.
 */
export class RecordingTimeline {
  private events: RecordingEvent[] = [];

  /**
   * Append an event to the timeline.
   */
  addEvent(event: RecordingEvent): void {
    this.events.push(event);
  }

  /**
   * Return a shallow copy of all events.
   */
  getEvents(): RecordingEvent[] {
    return [...this.events];
  }

  /**
   * Return events matching the given type.
   */
  getEventsByType(type: RecordingEventType): RecordingEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Return events that occurred on the given slide.
   */
  getEventsBySlide(slideIndex: number): RecordingEvent[] {
    return this.events.filter(e => e.slideIndex === slideIndex);
  }

  /**
   * Duration from the first event to the last event (ms).
   * Returns 0 if fewer than two events exist.
   */
  getDurationMs(): number {
    if (this.events.length < 2) {
      return 0;
    }
    return this.events[this.events.length - 1].relativeTimeMs - this.events[0].relativeTimeMs;
  }

  /**
   * Return the most recent event, or undefined if empty.
   */
  getLastEvent(): RecordingEvent | undefined {
    return this.events.length > 0 ? this.events[this.events.length - 1] : undefined;
  }

  /**
   * Total number of events in the timeline.
   */
  get length(): number {
    return this.events.length;
  }

  /**
   * Reset the timeline (for testing).
   */
  clear(): void {
    this.events = [];
  }
}
