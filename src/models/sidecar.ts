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
}

export interface SidecarDeck {
  title?: string;
  theme?: string;
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
  slides?: SidecarSlide[];
  recording?: SidecarRecording;
  export?: SidecarExport;
  environment?: SidecarEnvironment;
}
