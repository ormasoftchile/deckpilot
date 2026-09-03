import * as path from 'path';

export interface RecordingOutputLayoutInput {
  deckPath: string;
  sessionId: string;
  startedAt: number;
  exportOutputDir?: string;
  recorderOutputDir?: string;
}

export interface RecordingOutputLayout {
  outputRoot: string;
  sessionDirectory: string;
  narrationDirectory: string;
}

export function recordingDeckName(deckPath: string): string {
  return path.basename(deckPath)
    .replace(/\.deck\.(md|yaml)$/i, '')
    .replace(/\.md$/i, '');
}

function timestamp(value: number): string {
  const date = new Date(value);
  const part = (number: number): string => String(number).padStart(2, '0');
  return [
    date.getFullYear(),
    part(date.getMonth() + 1),
    part(date.getDate()),
    '-',
    part(date.getHours()),
    part(date.getMinutes()),
    part(date.getSeconds()),
  ].join('');
}

export function resolveRecordingOutputLayout(
  input: RecordingOutputLayoutInput,
): RecordingOutputLayout {
  const deckDirectory = path.dirname(input.deckPath);
  const configuredRoot = input.exportOutputDir?.trim()
    || input.recorderOutputDir?.trim()
    || './recordings';
  const outputRoot = path.isAbsolute(configuredRoot)
    ? path.normalize(configuredRoot)
    : path.resolve(deckDirectory, configuredRoot);
  const sessionName = `${timestamp(input.startedAt)}-${input.sessionId.slice(0, 8)}`;
  const deckOutputDirectory = path.join(outputRoot, recordingDeckName(input.deckPath));

  return {
    outputRoot,
    sessionDirectory: path.join(deckOutputDirectory, sessionName),
    narrationDirectory: path.join(deckOutputDirectory, 'narration'),
  };
}