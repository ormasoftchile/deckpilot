/**
 * RecordingEventFactory — helper functions to create properly typed
 * RecordingEvent objects with generated IDs and timestamps.
 *
 * The `relativeTimeMs` field is set to 0 by default; the caller
 * (RecordingController) computes the offset from session start.
 */

import { RecordingEvent, RecordingEventType } from '../models/recording';
import { ActionType } from '../models/action';
import { NavigationMethod } from '../models/deck';
import { randomUUID } from 'crypto';

/** Generate a unique event ID */
function generateId(): string {
  return randomUUID();
}

/** Build a base event with common fields populated */
function baseEvent(type: RecordingEventType, slideIndex: number, metadata?: Record<string, unknown>, note?: string): RecordingEvent {
  return {
    id: generateId(),
    type,
    timestamp: Date.now(),
    relativeTimeMs: 0,
    slideIndex,
    metadata,
    note,
  };
}

/**
 * Create a session.started event.
 */
export function createSessionStartedEvent(deckPath: string, slideIndex: number): RecordingEvent {
  return baseEvent('session.started', slideIndex, { deckPath });
}

/**
 * Create a session.stopped event.
 */
export function createSessionStoppedEvent(slideIndex: number): RecordingEvent {
  return baseEvent('session.stopped', slideIndex);
}

/**
 * Create a slide.entered event.
 */
export function createSlideEnteredEvent(
  slideIndex: number,
  previousSlideIndex: number,
  navigationMethod: NavigationMethod,
  fragmentCount: number,
  slideTitle?: string,
): RecordingEvent {
  return baseEvent('slide.entered', slideIndex, {
    previousSlideIndex,
    navigationMethod,
    fragmentCount,
    slideTitle,
  });
}

/**
 * Create a slide.exited event.
 */
export function createSlideExitedEvent(slideIndex: number): RecordingEvent {
  return baseEvent('slide.exited', slideIndex);
}

/**
 * Create a fragment.revealed event.
 */
export function createFragmentRevealedEvent(
  slideIndex: number,
  fragmentIndex: number,
  fragmentCount: number,
): RecordingEvent {
  return {
    ...baseEvent('fragment.revealed', slideIndex, { fragmentCount }),
    fragmentIndex,
  };
}

/**
 * Create an action.triggered event.
 */
export function createActionTriggeredEvent(
  slideIndex: number,
  actionId: string,
  actionType: ActionType,
  actionTarget?: string,
): RecordingEvent {
  return baseEvent('action.triggered', slideIndex, { actionId, actionType, actionTarget });
}

/**
 * Create an action.completed event.
 */
export function createActionCompletedEvent(
  slideIndex: number,
  actionId: string,
  actionType: ActionType,
  success: boolean,
  durationMs: number,
  error?: string,
): RecordingEvent {
  return baseEvent('action.completed', slideIndex, {
    actionId,
    actionType,
    success,
    durationMs,
    error,
  });
}

/**
 * Create a file.opened event.
 */
export function createFileOpenedEvent(slideIndex: number, filePath: string): RecordingEvent {
  return baseEvent('file.opened', slideIndex, { filePath });
}

/**
 * Create an editor.highlighted event.
 */
export function createEditorHighlightedEvent(slideIndex: number, filePath: string, lines: string): RecordingEvent {
  return baseEvent('editor.highlighted', slideIndex, { filePath, lines });
}

/**
 * Create a scene.restored event.
 */
export function createSceneRestoredEvent(slideIndex: number, sceneName: string): RecordingEvent {
  return baseEvent('scene.restored', slideIndex, { sceneName });
}

/**
 * Create a manual.marker event.
 */
export function createManualMarkerEvent(
  slideIndex: number,
  markerType: 'narration' | 'pause' | 'resume' | 'retake' | 'ignore-start' | 'ignore-end',
  note?: string,
): RecordingEvent {
  return baseEvent('manual.marker', slideIndex, { markerType }, note);
}

/**
 * Create a timing.paused event.
 */
export function createTimingPausedEvent(slideIndex: number, note?: string): RecordingEvent {
  return baseEvent('timing.paused', slideIndex, undefined, note);
}

/**
 * Create a timing.resumed event.
 */
export function createTimingResumedEvent(slideIndex: number, note?: string): RecordingEvent {
  return baseEvent('timing.resumed', slideIndex, undefined, note);
}

/**
 * Create a retake.marked event.
 */
export function createRetakeMarkedEvent(slideIndex: number, note?: string): RecordingEvent {
  return baseEvent('retake.marked', slideIndex, undefined, note);
}
