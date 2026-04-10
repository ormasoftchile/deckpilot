/**
 * Segment builder — derives RecordingSegments from event timeline and cues.
 *
 * Segmentation priority:
 * 1. Explicit voice-over cues (from cueParser)
 * 2. Fragment reveal boundaries
 * 3. Slide change boundaries
 * 4. Action boundaries (secondary markers within slides)
 */

import { Slide } from '../models/slide';
import { RecordingEvent, RecordingSegment, VoiceOverCue, IgnoredInterval } from '../models/recording';

let segmentCounter = 0;

function nextSegmentId(): string {
  return `seg-${++segmentCounter}`;
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
  const boundaries = identifyBoundaries(sorted, cues);

  if (boundaries.length === 0) {
    // Single segment spanning entire session
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return [createSegment(first, last, sorted, cues, slides, ignoredIntervals)];
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

    segments.push(createSegment(startEvent, endEvent, spanEvents, cues, slides, ignoredIntervals));
  }

  return segments;
}

/**
 * Identify boundary events using the segmentation priority.
 */
function identifyBoundaries(
  sorted: RecordingEvent[],
  cues: VoiceOverCue[],
): RecordingEvent[] {
  const boundaries: RecordingEvent[] = [];
  const seen = new Set<string>();

  // Priority 1: events that correspond to explicit cues
  for (const cue of cues) {
    const match = sorted.find(e =>
      e.slideIndex === cue.slideIndex &&
      (cue.fragmentIndex === undefined || e.fragmentIndex === cue.fragmentIndex) &&
      !seen.has(e.id),
    );
    if (match) {
      seen.add(match.id);
      boundaries.push(match);
    }
  }

  // Priority 2: fragment reveals
  for (const e of sorted) {
    if (e.type === 'fragment.revealed' && !seen.has(e.id)) {
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
  cues: VoiceOverCue[],
  slides: Slide[],
  ignoredIntervals: IgnoredInterval[] = [],
): RecordingSegment {
  const slideIndex = startEvent.slideIndex;
  const slide = slides[slideIndex];
  const slideTitle = slide?.frontmatter?.title;

  // Find matching cue — fragment-level cues take priority over slide-level cues
  const fragmentCue = cues.find(c =>
    c.slideIndex === slideIndex &&
    c.fragmentIndex !== undefined &&
    c.fragmentIndex === startEvent.fragmentIndex,
  );
  const slideCue = cues.find(c =>
    c.slideIndex === slideIndex &&
    c.fragmentIndex === undefined &&
    startEvent.fragmentIndex === undefined,
  );
  const cue = fragmentCue ?? slideCue;

  const eventSummary = summarizeEvents(spanEvents);
  const draftNarration = cue?.text
    ?? slide?.speakerNotes
    ?? extractSlideText(slide)
    ?? eventSummary
    ?? '';

  const rawDuration = endEvent.relativeTimeMs - startEvent.relativeTimeMs;
  const ignoredMs = computeIgnoredOverlap(
    startEvent.relativeTimeMs,
    endEvent.relativeTimeMs,
    ignoredIntervals,
  );

  return {
    segmentId: nextSegmentId(),
    startTimeMs: startEvent.relativeTimeMs,
    endTimeMs: endEvent.relativeTimeMs,
    durationMs: rawDuration - ignoredMs,
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
        parts.push(`Triggered action ${String(e.metadata?.['actionId'] ?? '')}`);
        break;
      case 'scene.restored':
        parts.push(`Restored scene ${String(e.metadata?.['sceneName'] ?? '')}`);
        break;
      case 'slide.entered':
        parts.push(`Entered slide ${e.slideIndex + 1}`);
        break;
      case 'fragment.revealed':
        parts.push(`Revealed fragment ${(e.fragmentIndex ?? 0) + 1}`);
        break;
      default:
        break;
    }
  }

  return parts.join(', ');
}

/**
 * Extract readable text from slide content for draft narration.
 * Strips markdown syntax, action links, render directives,
 * and HTML comments to produce plain prose.
 * Returns undefined if no meaningful text remains.
 */
function extractSlideText(slide: Slide | undefined): string | undefined {
  if (!slide) {
    return undefined;
  }

  let text = slide.content;

  // Remove HTML comments (including voice cues)
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  // Remove fenced code blocks (action blocks, render blocks)
  text = text.replace(/```[\s\S]*?```/g, '');
  // Remove action links [label](action:...)
  text = text.replace(/\[([^\]]*)\]\(action:[^)]*\)/g, '$1');
  // Remove render directives [](render:...)
  text = text.replace(/\[([^\]]*)\]\(render:[^)]*\)/g, '');
  // Remove remaining markdown links [text](url)
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Remove markdown headings markers
  text = text.replace(/^#{1,6}\s+/gm, '');
  // Remove bold/italic markers
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  text = text.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');
  // Remove frontmatter delimiters
  text = text.replace(/^---\s*$/gm, '');
  // Collapse whitespace
  text = text.replace(/\n{2,}/g, '\n').trim();

  if (text.length === 0) {
    return undefined;
  }

  // Combine title + body into a narration-friendly string
  const title = slide.frontmatter?.title;
  if (title && !text.startsWith(title)) {
    return `${title}. ${text}`;
  }
  return text;
}
