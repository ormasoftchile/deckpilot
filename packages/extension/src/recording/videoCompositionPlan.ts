import type { VideoAudioPolicy } from '@deckpilot/core/models/deckItem';
import type { RecordingEvent } from '@deckpilot/core/models/recording';

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

export function buildVideoCompositionPlan(
  events: RecordingEvent[],
  captureDurationMs: number,
  sourceDurations: Map<string, number>,
): VideoCompositionPlan {
  const decisions: VideoCompositionDecision[] = [];
  const starts = events
    .filter(event => event.type === 'video.started')
    .sort((left, right) => left.relativeTimeMs - right.relativeTimeMs);
  let deltaMs = 0;

  for (const start of starts) {
    const videoId = String(start.metadata?.['videoId'] ?? '');
    const src = String(start.metadata?.['src'] ?? '');
    const end = events.find(event =>
      event.type === 'video.ended' &&
      event.relativeTimeMs >= start.relativeTimeMs &&
      String(event.metadata?.['videoId'] ?? '') === videoId,
    );
    const sourceDurationMs = sourceDurations.get(videoId);
    if (!videoId || !src || !end || sourceDurationMs === undefined) {
      continue;
    }

    const sourceStartMs = Number(start.metadata?.['trimStartMs'] ?? 0);
    const sourceEndMs = Number(start.metadata?.['trimEndMs'] ?? sourceDurationMs);
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
      audio: normalizeAudioPolicy(start.metadata?.['audio']),
    });
    deltaMs += replacementDurationMs - (end.relativeTimeMs - start.relativeTimeMs);
  }

  const mapTime = (timeMs: number): number => {
    let accumulatedDelta = 0;
    for (const decision of decisions) {
      if (timeMs < decision.captureStartMs) {
        return timeMs + accumulatedDelta;
      }
      const captureDuration = decision.captureEndMs - decision.captureStartMs;
      const sourceDuration = decision.outputEndMs - decision.outputStartMs;
      if (timeMs <= decision.captureEndMs) {
        const progress = captureDuration > 0
          ? (timeMs - decision.captureStartMs) / captureDuration
          : 0;
        return Math.round(decision.outputStartMs + progress * sourceDuration);
      }
      accumulatedDelta += sourceDuration - captureDuration;
    }
    return timeMs + accumulatedDelta;
  };

  return {
    decisions,
    outputDurationMs: captureDurationMs + deltaMs,
    mapTime,
  };
}

function normalizeAudioPolicy(value: unknown): VideoAudioPolicy {
  return value === 'mute' || value === 'preserve' || value === 'duck'
    ? value
    : 'duck';
}