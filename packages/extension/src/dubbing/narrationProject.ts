import * as fs from 'fs';
import * as path from 'path';
import { VoiceOverCue } from '@deckpilot/core/models/recording';
import type { NarrationTiming } from '../recording/autoPilot';

export interface NarrationProjectArtifacts {
  srtPath: string;
  projectPath: string;
}

interface NarrationProjectEntry {
  index: number;
  text: string;
  processed_take_path?: string;
  processed_duration_ms?: number;
}

export async function createNarrationProject(
  cues: readonly VoiceOverCue[],
  outputDirectory: string,
): Promise<NarrationProjectArtifacts> {
  if (cues.length === 0) {
    throw new Error('This deck has no narration cues to record.');
  }

  await fs.promises.mkdir(outputDirectory, { recursive: true });
  const srtPath = path.join(outputDirectory, 'narration.srt');
  const projectPath = path.join(outputDirectory, 'narration-project.json');
  await fs.promises.writeFile(srtPath, createCueScaffold(cues), 'utf8');
  return { srtPath, projectPath };
}

export async function loadNarrationTimings(
  project: NarrationProjectArtifacts,
  cues: readonly VoiceOverCue[],
): Promise<NarrationTiming[]> {
  let entries: NarrationProjectEntry[];
  try {
    const content = await fs.promises.readFile(project.projectPath, 'utf8');
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error('project metadata is not an array');
    }
    entries = parsed as NarrationProjectEntry[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read the narration project: ${message}`);
  }

  const entriesByIndex = new Map(entries.map(entry => [entry.index, entry]));
  const timings: NarrationTiming[] = [];
  for (let cueOffset = 0; cueOffset < cues.length; cueOffset++) {
    const cueIndex = cueOffset + 1;
    const cue = cues[cueOffset];
    const entry = entriesByIndex.get(cueIndex);
    if (!entry || normalizeText(entry.text) !== normalizeText(cue.text)) {
      throw new Error(`Narration cue ${cueIndex} does not match the current deck.`);
    }
    if (!Number.isFinite(entry.processed_duration_ms) || entry.processed_duration_ms! <= 0) {
      throw new Error(`Narration cue ${cueIndex} has not been processed.`);
    }
    if (!entry.processed_take_path) {
      throw new Error(`Narration cue ${cueIndex} has no processed take.`);
    }

    const takePath = path.isAbsolute(entry.processed_take_path)
      ? entry.processed_take_path
      : path.resolve(path.dirname(project.projectPath), entry.processed_take_path);
    try {
      const take = await fs.promises.stat(takePath);
      if (!take.isFile() || take.size === 0) {
        throw new Error('empty take');
      }
    } catch {
      throw new Error(`Narration cue ${cueIndex} processed take is missing.`);
    }

    timings.push({
      cueIndex,
      text: cue.text,
      durationMs: Math.round(entry.processed_duration_ms!),
    });
  }
  return timings;
}

function createCueScaffold(cues: readonly VoiceOverCue[]): string {
  const lines: string[] = [];
  let startMs = 0;
  for (let cueOffset = 0; cueOffset < cues.length; cueOffset++) {
    const cue = cues[cueOffset];
    const durationMs = estimateCueDuration(cue.text);
    const endMs = startMs + durationMs;
    lines.push(String(cueOffset + 1));
    lines.push(`${formatSrtTimestamp(startMs)} --> ${formatSrtTimestamp(endMs)}`);
    lines.push(normalizeText(cue.text));
    lines.push('');
    startMs = endMs;
  }
  return lines.join('\n');
}

function estimateCueDuration(text: string): number {
  const words = normalizeText(text).split(' ').filter(Boolean).length;
  return Math.max(2500, Math.round((words / 150) * 60 * 1000));
}

function formatSrtTimestamp(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:` +
    `${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}
