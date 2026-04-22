/**
 * TypeScript types for .deck.yaml sidecar files.
 *
 * DA-04: Canonical model for sidecar YAML structure.
 */

export interface SidecarAction {
  type: string;
  cmd?: string;
  file?: string;
  [key: string]: unknown;
}

export interface SidecarSlide {
  id: string;
  cues?: string[];
  duration?: string;
  actions?: SidecarAction[];
  checkpoint?: string;
}

export interface SidecarDeck {
  title?: string;
  theme?: string;
}

export interface SidecarRecording {
  autoStart?: boolean;
}

export interface SidecarExport {
  subtitles?: boolean;
  video?: boolean;
}

export interface SidecarFile {
  deck?: SidecarDeck;
  slides?: SidecarSlide[];
  recording?: SidecarRecording;
  export?: SidecarExport;
}
