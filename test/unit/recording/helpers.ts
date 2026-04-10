/**
 * Test helpers for Recording Mode unit tests.
 * Provides factory functions for mock objects with sensible defaults.
 */

import {
  RecordingEvent,
  RecordingSession,
  RecordingSegment,
} from '../../../src/models/recording';
import { Slide } from '../../../src/models/slide';

let mockIdCounter = 0;

export function createMockEvent(
  overrides?: Partial<RecordingEvent>
): RecordingEvent {
  mockIdCounter++;
  return {
    id: `mock-event-${mockIdCounter}`,
    type: 'slide.entered',
    timestamp: Date.now(),
    relativeTimeMs: 0,
    slideIndex: 0,
    ...overrides,
  };
}

export function createMockSession(
  overrides?: Partial<RecordingSession>
): RecordingSession {
  return {
    sessionId: 'mock-session-1',
    deckPath: '/mock/deck.deck.md',
    deckTitle: 'Mock Deck',
    recordingStartTime: 1000,
    recordingEndTime: 61000,
    durationMs: 60000,
    events: [],
    segments: [],
    ignoredIntervals: [],
    manualMarkers: [],
    exportMetadata: {
      generatedAt: Date.now(),
      extensionVersion: '0.1.0',
      platform: 'test',
      exportFormats: ['json', 'markdown'],
    },
    ...overrides,
  };
}

export function createMockSegment(
  overrides?: Partial<RecordingSegment>
): RecordingSegment {
  return {
    segmentId: 'mock-segment-1',
    startTimeMs: 0,
    endTimeMs: 5000,
    durationMs: 5000,
    slideIndex: 0,
    slideTitle: 'Mock Slide',
    cueText: 'Mock cue text',
    speakerNotes: undefined,
    eventSummary: 'Entered slide 0',
    draftNarration: 'Mock narration',
    ...overrides,
  };
}

export function createMockSlide(
  overrides?: Partial<Slide>
): Slide {
  return {
    content: '# Mock Slide\n\nSome content here.',
    html: '<h1>Mock Slide</h1><p>Some content here.</p>',
    index: 0,
    onEnterActions: [],
    interactiveElements: [],
    renderDirectives: [],
    fragmentCount: 0,
    ...overrides,
  };
}

/**
 * Resets the mock ID counter (call in beforeEach if deterministic IDs are needed).
 */
export function resetMockIdCounter(): void {
  mockIdCounter = 0;
}
