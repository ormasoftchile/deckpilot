/**
 * Voice-over cue parser for .deck.md slides.
 * Extracts cues from HTML comments and speaker notes.
 *
 * Supported syntax:
 *   <!-- voice: text -->           — slide-level cue
 *   <!-- voice[1]: text -->        — fragment-level cue (1-based index)
 */

import { Slide } from '../models/slide';
import { VoiceOverCue } from '../models/recording';

/**
 * Regex to match voice-over cue comments in slide content.
 * Supports:
 *   <!-- voice: text here -->       (slide-level)
 *   <!-- voice[N]: text here -->    (fragment-level, N is 1-based)
 * Multi-line cues are supported.
 */
const VOICE_CUE_REGEX = /<!--\s*voice(?:\[(\d+)\])?:\s*([\s\S]*?)\s*-->/gi;

/**
 * Parse voice-over cues from an array of slides.
 * Priority: HTML comment cues first, then speaker notes as fallback.
 */
export function parseCues(slides: Slide[]): VoiceOverCue[] {
  const cues: VoiceOverCue[] = [];

  for (const slide of slides) {
    const commentCues = extractCommentCues(slide.content, slide.index);
    cues.push(...commentCues);

    // If no comment cues found and speaker notes exist, use notes as fallback
    if (commentCues.length === 0 && slide.speakerNotes) {
      cues.push({
        slideIndex: slide.index,
        text: slide.speakerNotes.trim(),
        source: 'speaker-notes',
      });
    }
  }

  return cues;
}

/**
 * Extract voice-over cues from HTML comments in raw markdown content.
 */
function extractCommentCues(content: string, slideIndex: number): VoiceOverCue[] {
  const cues: VoiceOverCue[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  VOICE_CUE_REGEX.lastIndex = 0;

  while ((match = VOICE_CUE_REGEX.exec(content)) !== null) {
    const fragmentStr = match[1];
    const text = match[2].trim();
    if (text.length > 0) {
      const cue: VoiceOverCue = {
        slideIndex,
        text,
        source: 'comment',
      };
      if (fragmentStr !== undefined) {
        cue.fragmentIndex = parseInt(fragmentStr, 10);
      }
      cues.push(cue);
    }
  }

  return cues;
}
