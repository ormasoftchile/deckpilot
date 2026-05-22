/**
 * Segment builder — derives RecordingSegments from event timeline and cues.
 *
 * Segmentation priority:
 * 1. Explicit voice-over cues (from cueParser)
 * 2. Fragment reveal boundaries
 * 3. Slide change boundaries
 * 4. Action boundaries (secondary markers within slides)
 */

import { Slide } from '@deckpilot/core/models/slide';
import { RecordingEvent, RecordingSegment, VoiceOverCue, IgnoredInterval } from '@deckpilot/core/models/recording';

/**
 * Event types that are "notable" for segment boundary and voice cue matching:
 * fragment reveals and action result events.  voice[N] is paired with the
 * Nth notable event on a slide in time order, so authors can annotate both
 * fragment reveals and action executions with the same syntax.
 */
const NOTABLE_EVENT_TYPES = new Set([
  'fragment.revealed',
  'file.opened',
  'editor.highlighted',
  'terminal.command.started',
  'scene.restored',
]);

let segmentCounter = 0;

function nextSegmentId(): string {
  return `seg-${++segmentCounter}`;
}

/** Reading time in ms for text: 150 wpm, minimum 2500 ms. */
function readingTimeMs(text: string): number {
  if (!text || text.trim().length === 0) { return 2500; }
  const words = text.trim().split(/\s+/).length;
  return Math.max(Math.round((words / 150) * 60 * 1000), 2500);
}

/**
 * Build segments from a recording session's event stream.
 * Optionally excludes ignored intervals from segment duration calculations.
 */
export function buildSegments(
  events: RecordingEvent[],
  cues: VoiceOverCue[],
  slides: Slide[],
  ignoredIntervals: IgnoredInterval[] = [],
): RecordingSegment[] {
  // Reset counter for deterministic IDs within a session
  segmentCounter = 0;

  if (events.length === 0) {
    return [];
  }

  // Identify boundary events (ordered by time)
  const sorted = [...events].sort((a, b) => a.relativeTimeMs - b.relativeTimeMs);

  // Build ordinal cue map before identifying boundaries so both phases use
  // the same matching: voice[N] means the Nth fragment reveal on the slide,
  // not the element whose data-fragment attribute equals N.
  const cueForEvent = buildCueForEventMap(sorted, cues);

  const boundaries = identifyBoundaries(sorted, cues, cueForEvent);

  if (boundaries.length === 0) {
    // Single segment spanning entire session
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return [createSegment(first, last, sorted, cueForEvent, cues, slides, ignoredIntervals)];
  }

  const segments: RecordingSegment[] = [];

  for (let i = 0; i < boundaries.length; i++) {
    const startEvent = boundaries[i];
    const endEvent = i + 1 < boundaries.length
      ? boundaries[i + 1]
      : sorted[sorted.length - 1];

    const spanEvents = sorted.filter(
      e => e.relativeTimeMs >= startEvent.relativeTimeMs &&
           e.relativeTimeMs < endEvent.relativeTimeMs,
    );

    segments.push(createSegment(startEvent, endEvent, spanEvents, cueForEvent, cues, slides, ignoredIntervals));
  }

  return segments;
}

/**
 * Build a map from notable event ID → the VoiceOverCue that should narrate
 * that moment.
 *
 * Matching is ORDINAL: <!-- voice[1]: --> is paired with the 1st notable
 * event on that slide (fragment reveal OR action result), <!-- voice[2]: -->
 * with the 2nd, etc.  This lets authors annotate both fragment reveals and
 * action executions (file.opened, editor.highlighted, terminal.command.started)
 * with the same voice cue syntax, without knowing internal ordering.
 */
function buildCueForEventMap(
  sorted: RecordingEvent[],
  cues: VoiceOverCue[],
): Map<string, VoiceOverCue> {
  const map = new Map<string, VoiceOverCue>();

  const slideIndices = new Set(
    cues.filter(c => c.fragmentIndex !== undefined).map(c => c.slideIndex),
  );

  for (const slideIndex of slideIndices) {
    // Sort fragment cues by their declared ordinal (voice[1] before voice[2])
    const fragCues = cues
      .filter(c => c.slideIndex === slideIndex && c.fragmentIndex !== undefined)
      .sort((a, b) => (a.fragmentIndex ?? 0) - (b.fragmentIndex ?? 0));

    // Get all notable events on this slide in chronological order:
    // fragment reveals and action result events.
    const notableEvents = sorted.filter(
      e => e.slideIndex === slideIndex && NOTABLE_EVENT_TYPES.has(e.type),
    );

    // Match each cue to the fragment.revealed event whose fragmentIndex equals
    // the cue's resolved data-fragment index.  This is correct now that the
    // slide parser resolves voice[N] to actual data-fragment indices rather than
    // storing the literal [N] ordinal.
    // Any cue that cannot be matched this way (e.g. annotating an action result
    // event that has no fragmentIndex) falls through to ordinal matching below.
    const matchedEventIds = new Set<string>();
    const unmatchedCues: typeof fragCues = [];

    for (const cue of fragCues) {
      const match = notableEvents.find(
        e =>
          e.type === 'fragment.revealed' &&
          e.fragmentIndex === cue.fragmentIndex &&
          !matchedEventIds.has(e.id),
      );
      if (match) {
        map.set(match.id, cue);
        matchedEventIds.add(match.id);
      } else {
        unmatchedCues.push(cue);
      }
    }

    // Ordinal fallback for cues that didn't match a fragment.revealed event
    // (e.g. voice cues placed next to action result events).
    if (unmatchedCues.length > 0) {
      const unmatchedEvents = notableEvents.filter(e => !matchedEventIds.has(e.id));
      for (let i = 0; i < unmatchedCues.length && i < unmatchedEvents.length; i++) {
        map.set(unmatchedEvents[i].id, unmatchedCues[i]);
        matchedEventIds.add(unmatchedEvents[i].id);
      }
    }
  }

  return map;
}

/**
 * Identify boundary events using the segmentation priority.
 */
function identifyBoundaries(
  sorted: RecordingEvent[],
  cues: VoiceOverCue[],
  cueForEvent: Map<string, VoiceOverCue>,
): RecordingEvent[] {
  const boundaries: RecordingEvent[] = [];
  const seen = new Set<string>();

  // Priority 1a: slide-level cues — match the first event on each slide
  for (const cue of cues) {
    if (cue.fragmentIndex !== undefined) { continue; }
    const match = sorted.find(e =>
      e.slideIndex === cue.slideIndex &&
      !seen.has(e.id),
    );
    if (match) {
      seen.add(match.id);
      boundaries.push(match);
    }
  }

  // Priority 1b: fragment cues — already mapped to specific events by ordinal
  // in cueForEvent; just mark those events as boundaries.
  for (const [eventId] of cueForEvent) {
    const event = sorted.find(e => e.id === eventId && !seen.has(e.id));
    if (event) {
      seen.add(event.id);
      boundaries.push(event);
    }
  }

  // Priority 2: uncued notable events (fragment reveals and action results)
  for (const e of sorted) {
    if (NOTABLE_EVENT_TYPES.has(e.type) && !seen.has(e.id)) {
      seen.add(e.id);
      boundaries.push(e);
    }
  }

  // Priority 3: slide changes (including session.started as first slide entry)
  for (const e of sorted) {
    if ((e.type === 'slide.entered' || e.type === 'session.started') && !seen.has(e.id)) {
      seen.add(e.id);
      boundaries.push(e);
    }
  }

  // Sort boundaries by time
  boundaries.sort((a, b) => a.relativeTimeMs - b.relativeTimeMs);
  return boundaries;
}

/**
 * Create a single RecordingSegment from a span of events.
 */
function createSegment(
  startEvent: RecordingEvent,
  endEvent: RecordingEvent,
  spanEvents: RecordingEvent[],
  cueForEvent: Map<string, VoiceOverCue>,
  cues: VoiceOverCue[],
  slides: Slide[],
  ignoredIntervals: IgnoredInterval[] = [],
): RecordingSegment {
  const slideIndex = startEvent.slideIndex;
  const slide = slides[slideIndex];
  const slideTitle = slide?.frontmatter?.title;

  // Look up the cue for this specific event (ordinal-matched for fragments).
  const eventCue = cueForEvent.get(startEvent.id);

  // Slide-level cue and speaker notes only apply on the slide entry segment,
  // not on every fragment segment — otherwise the same text repeats N times.
  const isSlideEntry =
    startEvent.type === 'slide.entered' || startEvent.type === 'session.started';
  const slideCue = isSlideEntry
    ? cues.find(c => c.slideIndex === slideIndex && c.fragmentIndex === undefined)
    : undefined;

  const cue = eventCue ?? slideCue;

  const eventSummary = summarizeEvents(spanEvents);
  const draftNarration = cue?.text
    ?? (isSlideEntry ? slide?.speakerNotes : undefined)
    ?? eventSummary
    ?? '';

  // When there's narration text, end the segment after the reading time rather
  // than at the next event boundary — the next event time is arbitrary and can
  // be far too short or far too long relative to the cue length.
  const startMs = startEvent.relativeTimeMs;
  const nextEventMs = endEvent.relativeTimeMs;
  const endMs = draftNarration.length > 0
    ? Math.min(startMs + readingTimeMs(draftNarration), nextEventMs)
    : nextEventMs;

  const ignoredMs = computeIgnoredOverlap(startMs, endMs, ignoredIntervals);

  return {
    segmentId: nextSegmentId(),
    startTimeMs: startMs,
    endTimeMs: endMs,
    durationMs: endMs - startMs - ignoredMs,
    slideIndex,
    fragmentIndex: startEvent.fragmentIndex,
    slideTitle,
    cueText: cue?.text,
    speakerNotes: slide?.speakerNotes,
    eventSummary,
    draftNarration,
  };
}

/**
 * Compute the total time within [start, end] that overlaps with ignored intervals.
 */
function computeIgnoredOverlap(
  startMs: number,
  endMs: number,
  intervals: IgnoredInterval[],
): number {
  let totalIgnored = 0;
  for (const iv of intervals) {
    const overlapStart = Math.max(startMs, iv.startTimeMs);
    const overlapEnd = Math.min(endMs, iv.endTimeMs);
    if (overlapStart < overlapEnd) {
      totalIgnored += overlapEnd - overlapStart;
    }
  }
  return totalIgnored;
}

/**
 * Produce a human-readable summary of a span of events.
 * Only includes action/navigation events — not session lifecycle.
 */
function summarizeEvents(events: RecordingEvent[]): string {
  const parts: string[] = [];

  for (const e of events) {
    switch (e.type) {
      case 'file.opened':
        parts.push(`Opened file ${String(e.metadata?.['filePath'] ?? 'unknown')}`);
        break;
      case 'editor.highlighted':
        parts.push(`Highlighted lines ${String(e.metadata?.['startLine'] ?? '?')}-${String(e.metadata?.['endLine'] ?? '?')}`);
        break;
      case 'terminal.command.started':
        parts.push(`Ran command: ${String(e.metadata?.['command'] ?? 'unknown')}`);
        break;
      case 'action.triggered':
        // Internal event — not suitable as narration text
        break;
      case 'scene.restored':
        parts.push(`Restored scene ${String(e.metadata?.['sceneName'] ?? '')}`);
        break;
      // slide.entered and fragment.revealed are navigation boundaries, not
      // caption content — omit them so they don't bleed into subtitles.
      default:
        break;
    }
  }

  return parts.join(', ');
}

