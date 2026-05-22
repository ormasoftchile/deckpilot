/**
 * RecordingSerializer — exports a RecordingSession to JSON.
 */

import * as fs from 'fs';
import * as path from 'path';
import { RecordingSession } from '@deckpilot/core/models/recording';

export class RecordingSerializer {
  /**
   * Serialize a recording session to a JSON string.
   */
  serializeSession(session: RecordingSession): string {
    return JSON.stringify(session, null, 2);
  }

  /**
   * Export a recording session to disk as recording-session.json.
   * Returns the list of written file paths.
   */
  async exportSession(session: RecordingSession, outputDir: string): Promise<string[]> {
    await fs.promises.mkdir(outputDir, { recursive: true });

    const filePath = path.join(outputDir, 'recording-session.json');
    const json = this.serializeSession(session);
    await fs.promises.writeFile(filePath, json, 'utf-8');

    return [filePath];
  }
}
