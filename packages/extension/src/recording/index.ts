/**
 * Recording module exports
 */

export { RecordingTimeline } from './recordingTimeline';
export { RecordingController } from './recordingController';
export { RecordingSerializer } from './recordingSerializer';
export { VoiceOverScriptGenerator } from './voiceOverScriptGenerator';
export { CaptionsScaffoldGenerator } from './captionsScaffoldGenerator';
export { RecorderOrchestrator, getRecorderConfig } from './recorderOrchestrator';
export { parseCues } from './cueParser';
export { buildSegments } from './segmentBuilder';
export {
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
} from './recordingEventFactory';
