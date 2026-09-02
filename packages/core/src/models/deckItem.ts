import type { Slide } from './slide';

export type VideoAudioPolicy = 'mute' | 'preserve' | 'duck';

export interface VideoItemSpec {
  id: string;
  src: string;
  trimStartMs?: number;
  trimEndMs?: number;
  audio: VideoAudioPolicy;
}

export interface SlideDeckItem {
  kind: 'slide';
  id: string;
  index: number;
  slide: Slide;
}

export interface VideoDeckItem extends VideoItemSpec {
  kind: 'video';
  index: number;
  slide: Slide;
}

export type DeckItem = SlideDeckItem | VideoDeckItem;