/**
 * VoiceOverScriptGenerator — produces voiceover-script.md and voiceover-script.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import { RecordingSession, RecordingSegment } from '@deckpilot/core/models/recording';

export class VoiceOverScriptGenerator {
  /**
   * Generate a Markdown voice-over script from a recording session.
   */
  generateMarkdown(session: RecordingSession): string {
    const lines: string[] = [];
    const title = session.deckTitle ?? 'Untitled Deck';
    const date = new Date(session.recordingStartTime).toLocaleString();
    const duration = formatDuration(session.durationMs ?? 0);

    lines.push(`# Voice-Over Script: ${title}`);
    lines.push('');
    lines.push(`Recorded: ${date}`);
    lines.push(`Duration: ${duration}`);
    lines.push('');
    lines.push('---');

    // Group segments by slide
    const bySlide = groupSegmentsBySlide(session.segments);

    for (const [slideIndex, segments] of bySlide) {
      const first = segments[0];
      const last = segments[segments.length - 1];
      const slideTitle = first.slideTitle ?? `Slide ${slideIndex + 1}`;
      const startLabel = formatTimestamp(first.startTimeMs);
      const endLabel = formatTimestamp(last.endTimeMs);
      const dur = formatDuration(last.endTimeMs - first.startTimeMs);

      lines.push('');
      lines.push(`## Slide ${slideIndex + 1}: ${slideTitle} [${startLabel} → ${endLabel}] (${dur})`);

      if (segments.length === 1) {
        const seg = segments[0];
        if (seg.cueText) {
          lines.push('');
          lines.push(`**Cue:** ${seg.cueText}`);
        }
        lines.push('');
        lines.push(seg.draftNarration);
        if (seg.eventSummary) {
          lines.push('');
          lines.push(`> Events: ${seg.eventSummary}`);
        }
      } else {
        // Multiple fragments
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const fragStart = formatTimestamp(seg.startTimeMs);
          const fragEnd = formatTimestamp(seg.endTimeMs);

          lines.push('');
          lines.push(`### Fragment ${i + 1} [${fragStart} → ${fragEnd}]`);

          if (seg.cueText) {
            lines.push('');
            lines.push(`**Cue:** ${seg.cueText}`);
          }

          lines.push('');
          lines.push(seg.draftNarration);

          if (seg.eventSummary) {
            lines.push('');
            lines.push(`> Events: ${seg.eventSummary}`);
          }
        }
      }

      lines.push('');
      lines.push('---');
    }

    return lines.join('\n');
  }

  /**
   * Generate a JSON voice-over script (RecordingSession with segments populated).
   */
  generateJson(session: RecordingSession): string {
    return JSON.stringify(session, null, 2);
  }

  /**
   * Export both voiceover-script.md and voiceover-script.json to disk.
   * Returns the list of written file paths.
   */
  async exportScripts(session: RecordingSession, outputDir: string): Promise<string[]> {
    await fs.promises.mkdir(outputDir, { recursive: true });

    const mdPath = path.join(outputDir, 'voiceover-script.md');
    const jsonPath = path.join(outputDir, 'voiceover-script.json');

    const md = this.generateMarkdown(session);
    const json = this.generateJson(session);

    await Promise.all([
      fs.promises.writeFile(mdPath, md, 'utf-8'),
      fs.promises.writeFile(jsonPath, json, 'utf-8'),
    ]);

    return [mdPath, jsonPath];
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatTimestamp(ms: number): string {
  return formatDuration(ms);
}

function groupSegmentsBySlide(segments: RecordingSegment[]): Map<number, RecordingSegment[]> {
  const map = new Map<number, RecordingSegment[]>();
  for (const seg of segments) {
    const arr = map.get(seg.slideIndex) ?? [];
    arr.push(seg);
    map.set(seg.slideIndex, arr);
  }
  return map;
}
