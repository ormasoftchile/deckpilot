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
      // Use the rendered HTML to determine each interactive element's exact
      // data-fragment index so that trigger-action steps fire only after the
      // element's containing fragment is revealed, not based on array position.
      const allElements = [...slide.interactiveElements].sort(
        (a, b) => a.position.line - b.position.line,
      );

      // Map action.id → data-fragment index as assigned by processFragments.
      // Elements with data-no-fragment (fragment: false) are absent from the map
      // and will be triggered at slide-entry level (already visible on load).
      const fragMap = extractElementFragmentMap(slide.html);

      // Elements not enclosed in any fragment → fire after slide-level wait
      const entryElements = allElements.filter(el => !fragMap.has(el.action.id));
      for (const el of entryElements) {
        addActionSteps(steps, el, si, undefined, cfg);
      }

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

        // Fire all elements whose button is inside this specific fragment
        const fragElements = allElements.filter(el => fragMap.get(el.action.id) === fi);
        for (const el of fragElements) {
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
 * Extract a map of Action.id → data-fragment index from the slide's
 * rendered HTML.  The HTML produced by the parser has each interactive
 * button's wrapping <p> annotated with data-fragment="N" by processFragments.
 * We scan for data-action-id occurrences and look backwards to find the
 * nearest data-fragment attribute — that attribute belongs to the element's
 * enclosing fragment container.
 *
 * Keys are Action.id values (from data-action-id attribute), not
 * InteractiveElement.id values — callers must use el.action.id for lookups.
 *
 * Elements that are not inside any fragment (data-no-fragment or not wrapped
 * by a fragment element) will be absent from the returned map.
 */
function extractElementFragmentMap(html: string): Map<string, number> {
  const map = new Map<string, number>();
  const actionIdRegex = /data-action-id="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = actionIdRegex.exec(html)) !== null) {
    const actionId = match[1];
    const before = html.slice(0, match.index);
    // Find the last data-fragment="N" that appears before this data-action-id
    const lastFragPos = before.lastIndexOf('data-fragment="');
    if (lastFragPos !== -1) {
      const fragStr = before.slice(lastFragPos + 'data-fragment="'.length);
      const fragNumEnd = fragStr.indexOf('"');
      if (fragNumEnd !== -1) {
        const fragNum = parseInt(fragStr.slice(0, fragNumEnd), 10);
        if (!isNaN(fragNum)) {
          map.set(actionId, fragNum);
        }
      }
    }
  }
  return map;
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
