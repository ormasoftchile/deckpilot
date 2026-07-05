/**
 * TypeScript types for .deck.yaml sidecar files.
 *
 * DA-04: Canonical model for sidecar YAML structure.
 */

export interface SidecarAction {
  type: string;
  cmd?: string;
  file?: string;
  label?: string;
  [key: string]: unknown;
}

export interface SidecarSlide {
  id: string;
  cues?: string[];
  duration?: string;
  actions?: SidecarAction[];
  checkpoint?: string;
  /** Speaker notes — merged into Slide.notes; sidecar value used when slide has no inline notes */
  notes?: string;
  /** Slide-level layout: 'center' | 'columns' | 'left' | 'right' | 'group'. Applied by wrapping slide HTML. */
  layout?: string;
  /**
   * When false, auto-fragmentation is suppressed for this slide.
   * All elements render visible immediately — no progressive reveal.
   * Useful for title slides, recap slides, and reference tables.
   * Default: true (auto-fragment is on for all slides unless overridden).
   */
  autoFragment?: boolean;
}

export interface SidecarDeck {
  title?: string;
  theme?: string;
  /** Base path for resolving relative file references in the deck (mirrors DeckMetadata.basePath) */
  basePath?: string;
  /** Default list fragmentation mode for presentation rendering */
  listFragmentMode?: 'all' | 'each';
  /** Slide break mode: 'blank', 'marker', 'heading', 'h1', 'h2', etc. */
  slideBreak?: string;
}

/**
 * A named checkpoint that anchors to a slide by its explicit ID string.
 * Sidecar-variant of DeckMetadata's SceneDefinition (which uses a 1-based slide index).
 * The merge engine resolves the ID to a slide index at load time.
 */
export interface SidecarScene {
  /** Human-readable scene name (unique within deck) */
  name: string;
  /** Slide ID this scene anchors to (must match a <!-- id: slug --> in the markdown) */
  slide: string;
}

export interface SidecarRecording {
  autoStart?: boolean;
  outputDir?: string;
  format?: string;
  codec?: string;
  framerate?: number;
  windowScope?: 'focused' | 'screen';
}

export interface SidecarExport {
  subtitles?: boolean;
  video?: boolean;
  outputDir?: string;
  srtFormat?: 'srt' | 'vtt';
  voiceScript?: boolean;
}

export interface SidecarEnvironment {
  common?: Record<string, string>;
  platform?: {
    darwin?: Record<string, string>;
    linux?: Record<string, string>;
    win32?: Record<string, string>;
  };
}

export interface SidecarFile {
  deck?: SidecarDeck;
  scenes?: SidecarScene[];
  slides?: SidecarSlide[];
  recording?: SidecarRecording;
  export?: SidecarExport;
  environment?: SidecarEnvironment;
}
