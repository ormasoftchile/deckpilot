/**
 * CaptionsScaffoldGenerator — produces a draft SRT caption file
 * from a recorded session's segments.
 *
 * The output is a scaffold: timing comes from the real session,
 * text comes from draft narration. The presenter can refine later
 * without recomputing timing.
 */

import * as fs from 'fs';
import * as path from 'path';
import { RecordingSession } from '@deckpilot/core/models/recording';

export class CaptionsScaffoldGenerator {
  /**
   * Generate an SRT-formatted caption string from session segments.
   */
  generateSrt(session: RecordingSession): string {
    const lines: string[] = [];
    const segments = session.segments;
    let captionIndex = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const text = seg.draftNarration || seg.cueText || '';
      const start = formatSrtTimestamp(seg.startTimeMs);
      const end = formatSrtTimestamp(seg.startTimeMs + readingTimeMs(text));

      if (text.length === 0) {
        continue;
      }

      captionIndex++;
      lines.push(String(captionIndex));
      lines.push(`${start} --> ${end}`);
      lines.push(wrapText(text, 42));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Export a draft SRT file to disk.
   * If the session has a recorder output path, the SRT is named to match
   * the video file so VLC and other players auto-load it.
   * Returns the written file path.
   */
  async exportSrt(session: RecordingSession, outputDir: string): Promise<string> {
    await fs.promises.mkdir(outputDir, { recursive: true });

    let srtFilename = 'captions-draft.srt';
    if (session.recorder?.outputPath) {
      const videoBasename = path.basename(session.recorder.outputPath, path.extname(session.recorder.outputPath));
      srtFilename = `${videoBasename}.srt`;
    }

    const srtPath = path.join(outputDir, srtFilename);
    const content = this.generateSrt(session);
    await fs.promises.writeFile(srtPath, content, 'utf-8');
    return srtPath;
  }
}

/**
 * Calculate how long a caption should be displayed based on word count.
 * 150 wpm, minimum 2500 ms.
 */
function readingTimeMs(text: string): number {
  if (!text || text.trim().length === 0) { return 2500; }
  const words = text.trim().split(/\s+/).length;
  return Math.max(Math.round((words / 150) * 60 * 1000), 2500);
}

/**
 * Format milliseconds as SRT timestamp: HH:MM:SS,mmm
 */
function formatSrtTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  return (
    String(hours).padStart(2, '0') + ':' +
    String(minutes).padStart(2, '0') + ':' +
    String(seconds).padStart(2, '0') + ',' +
    String(millis).padStart(3, '0')
  );
}

/**
 * Wrap text to a maximum line width for caption readability.
 */
function wrapText(text: string, maxWidth: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine.length > 0 ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}
