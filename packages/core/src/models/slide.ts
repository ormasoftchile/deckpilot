/**
 * Slide types and interfaces for Deckpilot
 * Per data-model.md
 */

import { Action, ActionDefinition } from './action';
import type { SidecarAction } from './sidecar';

/**
 * YAML frontmatter structure for a slide
 */
export interface SlideFrontmatter {
  /** Slide title */
  title?: string;
  /** Speaker notes */
  notes?: string;
  /** Actions to execute when slide becomes active */
  onEnter?: ActionDefinition[];
  /** Checkpoint identifier for onboarding mode */
  checkpoint?: string;
  /** Extensible properties */
  [key: string]: unknown;
}

/**
 * Position within slide content
 */
export interface ContentPosition {
  line: number;
  column: number;
}

/**
 * Interactive element (clickable action link) in slide content
 */
export interface InteractiveElement {
  /** Unique identifier within slide */
  id: string;
  /** Display text */
  label: string;
  /** Parsed action */
  action: Action;
  /** Position in content */
  position: ContentPosition;
  /** Original markdown link text */
  rawLink: string;
  /** Whether this element came from an inline link, a fenced block, or a sidecar action.
   *  Defaults to 'inline' for backward compatibility. */
  source?: 'inline' | 'block' | 'sidecar';
  /** Fragment animation for this element.
   *  - `true` or `'fade'` = default fade animation
   *  - A string like `'slide-up'` = specific animation type
   *  - `undefined` / `false` = no fragment, immediately visible */
  fragment?: boolean | string;
  /** When true, render a code preview of the command/path next to the button */
  showCommand?: boolean;
}

/**
 * Represents a single slide within a deck
 */
export interface Slide {
  /** Zero-based position in deck */
  index: number;
  /** Stable author-assigned identifier for sidecar YAML references (DA-01) */
  id?: string;
  /**
   * True when `id` was explicitly declared by the author (HTML comment or
   * frontmatter `id:` field).  False/absent means the ID was derived from a
   * heading slug or assigned as a positional fallback.  Used by the duplicate
   * ID validator (DA-11) to distinguish author intent from auto-generation.
   */
  idExplicit?: boolean;
  /** Raw Markdown content (without frontmatter) */
  content: string;
  /** Rendered HTML content */
  html: string;
  /** Parsed YAML frontmatter */
  frontmatter?: SlideFrontmatter;
  /** Speaker notes from frontmatter */
  speakerNotes?: string;
  /** Actions to execute when slide becomes active */
  onEnterActions: Action[];
  /** Clickable action links in content */
  interactiveElements: InteractiveElement[];
  /** Render directives for dynamic content */
  renderDirectives: RenderDirectiveRef[];
  /** Number of animated fragments in this slide */
  fragmentCount: number;
  /** Checkpoint identifier for onboarding mode */
  checkpoint?: string;
  /**
   * Voice-over cues extracted from <!-- voice: --> and <!-- voice[N]: -->
   * comments in the raw slide content.  Populated by the parser before cue
   * comments are stripped from content.  Used by parseCues() so cues remain
   * available even though the comments are removed from rendered HTML.
   */
  voiceCues?: Array<{ fragmentIndex?: number; text: string }>;
  /** Speaker cue strings merged from sidecar (DA-05) */
  cues?: string[];
  /** Slide duration hint merged from sidecar, e.g. "2m30s" (DA-05) */
  duration?: string;
  /** Actions sourced from sidecar YAML; wired to action registry in DA-07/08 (DA-05) */
  sidecarActions?: SidecarAction[];
}

/**
 * Reference to a render directive (stores parsed info, resolved at display time)
 */
export interface RenderDirectiveRef {
  id: string;
  type: 'file' | 'command' | 'diff';
  rawDirective: string;
  position: { start: number; end: number };
}

/**
 * Create a new slide with defaults
 */
export function createSlide(
  index: number,
  content: string,
  html: string,
  frontmatter?: SlideFrontmatter,
  checkpoint?: string
): Slide {
  return {
    index,
    content,
    html,
    frontmatter,
    speakerNotes: frontmatter?.notes,
    onEnterActions: [],
    interactiveElements: [],
    renderDirectives: [],
    fragmentCount: 0,
    checkpoint: checkpoint ?? frontmatter?.checkpoint,
  };
}
