/**
 * AutoPilot — drives a presentation automatically at a pace
 * calculated from voice cue text length.
 *
 * Used with recording mode to produce a hands-free screen capture
 * with properly timed captions.
 */

import { Slide } from '../models/slide';
import { VoiceOverCue } from '../models/recording';
import { parseCues } from '../recording/cueParser';

/**
 * Configuration for auto-pilot pacing.
 */
export interface AutoPilotConfig {
  /** Words per minute for reading pace (default: 150) */
  wordsPerMinute: number;
  /** Minimum display time per slide/fragment in ms (default: 2500) */
  minDisplayMs: number;
  /** Extra delay after an action executes in ms (default: 1500) */
  actionDelayMs: number;
  /** Time to show a file/editor before returning to the deck in ms (default: 3000) */
  fileViewMs: number;
  /** Delay before first slide in ms (default: 1000) */
  initialDelayMs: number;
  /** Delay after last slide before stopping in ms (default: 2000) */
  finalDelayMs: number;
}

const DEFAULT_CONFIG: AutoPilotConfig = {
  wordsPerMinute: 150,
  minDisplayMs: 2500,
  actionDelayMs: 1500,
  fileViewMs: 3000,
  initialDelayMs: 1000,
  finalDelayMs: 2000,
};

/**
 * A single step in the auto-pilot execution plan.
 */
export interface AutoPilotStep {
  /** What to do */
  type: 'advance' | 'trigger-action' | 'wait' | 'close-panel' | 'refocus';
  /** How long to wait after this step (ms) */
  durationMs: number;
  /** Slide index this step belongs to */
  slideIndex: number;
  /** Fragment index, if this step reveals a fragment */
  fragmentIndex?: number;
  /** Action ID, if this step triggers an action */
  actionId?: string;
  /** Description for logging */
  label: string;
}

/**
 * Build a complete execution plan for auto-piloting a deck.
 * The plan is a sequence of steps with calculated durations.
 */
export function buildAutoPilotPlan(
  slides: Slide[],
  config: Partial<AutoPilotConfig> = {},
): AutoPilotStep[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cues = parseCues(slides);
  const steps: AutoPilotStep[] = [];

  // Initial wait
  steps.push({
    type: 'wait',
    durationMs: cfg.initialDelayMs,
    slideIndex: 0,
    label: 'Initial delay',
  });

  for (let si = 0; si < slides.length; si++) {
    const slide = slides[si];

    if (si > 0) {
      // Advance to this slide
      steps.push({
        type: 'advance',
        durationMs: 0,
        slideIndex: si,
        label: `Advance to slide ${si + 1}`,
      });
    }

    // Slide-level cue wait
    const slideCue = findCue(cues, si, undefined);
    const slideWait = calculateDisplayTime(slideCue?.text, cfg);
    steps.push({
      type: 'wait',
      durationMs: slideWait,
      slideIndex: si,
      label: slideCue
        ? `Slide ${si + 1}: "${truncate(slideCue.text, 40)}"`
        : `Slide ${si + 1}: display`,
    });

    if (slide.fragmentCount > 0) {
      // Slide has fragments — advance through them one at a time.
      // Sort elements by their position in the source content so
      // element order matches visual/DOM order (block elements may
      // have been parsed before inline elements).
      const allElements = [...slide.interactiveElements].sort(
        (a, b) => a.position.line - b.position.line,
      );

      for (let fi = 1; fi <= slide.fragmentCount; fi++) {
        // Advance (reveals next fragment)
        steps.push({
          type: 'advance',
          durationMs: 0,
          slideIndex: si,
          fragmentIndex: fi,
          label: `Reveal fragment ${fi} on slide ${si + 1}`,
        });

        // Fragment cue wait
        const fragCue = findCue(cues, si, fi);
        const fragWait = calculateDisplayTime(fragCue?.text, cfg);
        steps.push({
          type: 'wait',
          durationMs: fragWait,
          slideIndex: si,
          fragmentIndex: fi,
          label: fragCue
            ? `Fragment ${fi}: "${truncate(fragCue.text, 40)}"`
            : `Fragment ${fi}: display`,
        });

        // Match the element for this fragment by index.
        // Fragment N (1-based) corresponds to element N-1 (0-based).
        const el = allElements[fi - 1];
        if (el) {
          addActionSteps(steps, el, si, fi, cfg);
        }
      }
    } else {
      // No fragments — trigger all interactive elements on slide load
      for (const el of slide.interactiveElements) {
        addActionSteps(steps, el, si, undefined, cfg);
      }
    }
  }

  // Final wait
  steps.push({
    type: 'wait',
    durationMs: cfg.finalDelayMs,
    slideIndex: slides.length - 1,
    label: 'Final delay',
  });

  return steps;
}

/**
 * Add action trigger + follow-up steps (refocus / close-panel) for one element.
 */
function addActionSteps(
  steps: AutoPilotStep[],
  el: { action: { id: string; type: string }; label: string },
  slideIndex: number,
  fragmentIndex: number | undefined,
  cfg: AutoPilotConfig,
): void {
  steps.push({
    type: 'trigger-action',
    durationMs: 0,
    slideIndex,
    fragmentIndex,
    actionId: el.action.id,
    label: `Execute action: ${el.label}`,
  });

  if (el.action.type === 'terminal.run') {
    // Let the terminal command execute and output be visible
    steps.push({
      type: 'wait',
      durationMs: cfg.fileViewMs,
      slideIndex,
      label: `View terminal output (${el.label})`,
    });
    steps.push({
      type: 'close-panel',
      durationMs: 0,
      slideIndex,
      label: 'Close terminal panel',
    });
  }

  if (el.action.type === 'file.open' || el.action.type === 'editor.highlight') {
    steps.push({
      type: 'refocus',
      durationMs: cfg.fileViewMs,
      slideIndex,
      label: `View file (${el.label}) then return to deck`,
    });
  }
}

/**
 * Calculate display time for a text based on word count and WPM.
 */
export function calculateDisplayTime(
  text: string | undefined,
  config: AutoPilotConfig = DEFAULT_CONFIG,
): number {
  if (!text || text.trim().length === 0) {
    return config.minDisplayMs;
  }
  const words = text.trim().split(/\s+/).length;
  const readingMs = (words / config.wordsPerMinute) * 60 * 1000;
  return Math.max(readingMs, config.minDisplayMs);
}

/**
 * Find a cue for a specific slide and optional fragment.
 */
function findCue(
  cues: VoiceOverCue[],
  slideIndex: number,
  fragmentIndex: number | undefined,
): VoiceOverCue | undefined {
  if (fragmentIndex !== undefined) {
    return cues.find(c => c.slideIndex === slideIndex && c.fragmentIndex === fragmentIndex);
  }
  return cues.find(c => c.slideIndex === slideIndex && c.fragmentIndex === undefined);
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}
