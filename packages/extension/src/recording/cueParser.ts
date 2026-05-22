/**
 * Voice-over cue parser for .deck.md slides.
 * Extracts cues from HTML comments and speaker notes.
 *
 * Supported syntax:
 *   <!-- voice: text -->           — slide-level cue
 *   <!-- voice[1]: text -->        — fragment-level cue (1-based index)
 */

import { Slide } from '@deckpilot/core/models/slide';
import { VoiceOverCue } from '@deckpilot/core/models/recording';

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
 *
 * Priority order per the Dual Authoring Model (DA-08):
 *   1. Inline HTML comment cues  (<!-- voice: --> / <!-- voice[N]: -->)
 *   2. Sidecar cues              (slide.cues[], merged from .deck.yaml by DA-05)
 *   3. Speaker notes             (slide.speakerNotes — last resort)
 */
export function parseCues(slides: Slide[]): VoiceOverCue[] {
  const cues: VoiceOverCue[] = [];

  for (const slide of slides) {
    // Use pre-extracted voiceCues if available (set by slideParser before it
    // strips the comments from slide.content).  Fall back to re-parsing
    // slide.content for callers that build Slide objects independently.
    let commentCues: VoiceOverCue[];
    if (slide.voiceCues && slide.voiceCues.length > 0) {
      commentCues = slide.voiceCues.map(c => ({
        slideIndex: slide.index,
        text: c.text,
        source: 'comment' as const,
        ...(c.fragmentIndex !== undefined ? { fragmentIndex: c.fragmentIndex } : {}),
      }));
    } else {
      commentCues = extractCommentCues(slide.content, slide.index);
    }
    cues.push(...commentCues);

    if (commentCues.length > 0) {
      // Inline comment cues win — skip lower-priority sources.
      continue;
    }

    // Sidecar cues (slide.cues) are slide-level strings; no fragment association.
    if (slide.cues && slide.cues.length > 0) {
      for (const text of slide.cues) {
        if (text.trim().length > 0) {
          cues.push({
            slideIndex: slide.index,
            text: text.trim(),
            source: 'frontmatter',
          });
        }
      }
      continue;
    }

    // Last resort: speaker notes
    if (slide.speakerNotes) {
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
