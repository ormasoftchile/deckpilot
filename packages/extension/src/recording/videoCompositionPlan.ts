import type { VideoAudioPolicy } from "@deckpilot/core/models/deckItem";
import type {
  RecordingEvent,
  RecordingSession,
} from "@deckpilot/core/models/recording";

export interface VideoCompositionDecision {
  videoId: string;
  src: string;
  captureStartMs: number;
  captureEndMs: number;
  sourceStartMs: number;
  sourceEndMs: number;
  outputStartMs: number;
  outputEndMs: number;
  audio: VideoAudioPolicy;
}

export interface VideoCompositionPlan {
  decisions: VideoCompositionDecision[];
  outputDurationMs: number;
  mapTime(timeMs: number): number;
}

export function alignRecordingSessionToCapture(
  session: RecordingSession,
  captureDurationMs: number,
): number {
  const stopped = session.events.find(
    (event) => event.type === "session.stopped",
  );
  const timelineDurationMs =
    stopped?.relativeTimeMs ?? session.durationMs ?? captureDurationMs;
  const offsetMs = Math.max(0, timelineDurationMs - captureDurationMs);
  const shift = (value: number): number => Math.max(0, value - offsetMs);

  session.recordingStartTime += offsetMs;
  session.durationMs = captureDurationMs;
  session.recordingEndTime = session.recordingStartTime + captureDurationMs;
  session.events = session.events.filter(
    (event) =>
      event.type === "session.started" || event.relativeTimeMs >= offsetMs,
  );
  for (const event of session.events) {
    event.relativeTimeMs = shift(event.relativeTimeMs);
    event.timestamp = session.recordingStartTime + event.relativeTimeMs;
  }
  for (const interval of session.ignoredIntervals) {
    interval.startTimeMs = shift(interval.startTimeMs);
    interval.endTimeMs = shift(interval.endTimeMs);
  }
  for (const marker of session.manualMarkers) {
    marker.relativeTimeMs = shift(marker.relativeTimeMs);
  }
  for (const segment of session.segments) {
    segment.startTimeMs = shift(segment.startTimeMs);
    segment.endTimeMs = shift(segment.endTimeMs);
  }
  return offsetMs;
}

export function buildVideoCompositionPlan(
  events: RecordingEvent[],
  captureDurationMs: number,
  sourceDurations: Map<string, number>,
): VideoCompositionPlan {
  const decisions: VideoCompositionDecision[] = [];
  const starts = events
    .filter((event) => event.type === "video.started")
    .sort((left, right) => left.relativeTimeMs - right.relativeTimeMs);
  let deltaMs = 0;

  for (const start of starts) {
    const videoId = String(start.metadata?.["videoId"] ?? "");
    const src = String(start.metadata?.["src"] ?? "");
    const end = events.find(
      (event) =>
        event.type === "video.ended" &&
        event.relativeTimeMs >= start.relativeTimeMs &&
        String(event.metadata?.["videoId"] ?? "") === videoId,
    );
    const sourceDurationMs = sourceDurations.get(videoId);
    if (!videoId || !src || !end || sourceDurationMs === undefined) {
      continue;
    }

    const sourceStartMs = Number(start.metadata?.["trimStartMs"] ?? 0);
    const sourceEndMs = Number(
      start.metadata?.["trimEndMs"] ?? sourceDurationMs,
    );
    const outputStartMs = start.relativeTimeMs + deltaMs;
    const replacementDurationMs = sourceEndMs - sourceStartMs;
    const outputEndMs = outputStartMs + replacementDurationMs;
    decisions.push({
      videoId,
      src,
      captureStartMs: start.relativeTimeMs,
      captureEndMs: end.relativeTimeMs,
      sourceStartMs,
      sourceEndMs,
      outputStartMs,
      outputEndMs,
      audio: normalizeAudioPolicy(start.metadata?.["audio"]),
    });
    deltaMs +=
      replacementDurationMs - (end.relativeTimeMs - start.relativeTimeMs);
  }

  const mapTime = (timeMs: number): number => {
    let captureCursorMs = 0;
    let outputCursorMs = 0;
    for (const decision of decisions) {
      if (timeMs < decision.captureStartMs) {
        return mapInterval(
          timeMs,
          captureCursorMs,
          decision.captureStartMs,
          outputCursorMs,
          decision.outputStartMs,
        );
      }
      if (timeMs <= decision.captureEndMs) {
        return mapInterval(
          timeMs,
          decision.captureStartMs,
          decision.captureEndMs,
          decision.outputStartMs,
          decision.outputEndMs,
        );
      }
      captureCursorMs = decision.captureEndMs;
      outputCursorMs = decision.outputEndMs;
    }
    return mapInterval(
      timeMs,
      captureCursorMs,
      captureDurationMs,
      outputCursorMs,
      captureDurationMs + deltaMs,
    );
  };

  return {
    decisions,
    outputDurationMs: captureDurationMs + deltaMs,
    mapTime,
  };
}

function mapInterval(
  value: number,
  inputStart: number,
  inputEnd: number,
  outputStart: number,
  outputEnd: number,
): number {
  const inputDuration = inputEnd - inputStart;
  if (inputDuration <= 0) return Math.round(outputStart);
  const progress = Math.max(
    0,
    Math.min(1, (value - inputStart) / inputDuration),
  );
  return Math.round(outputStart + progress * (outputEnd - outputStart));
}

function normalizeAudioPolicy(value: unknown): VideoAudioPolicy {
  return value === "mute" || value === "preserve" || value === "duck"
    ? value
    : "duck";
}
