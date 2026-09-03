export const RECORD_NARRATION_ACTION = 'Record or Update Narration';

export function requiresNarrationUpdate(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return [
    /record every narration cue/i,
    /narration cue \d+ does not match the current deck/i,
    /narration cue \d+ has not been processed/i,
    /narration cue \d+ has no processed take/i,
    /narration cue \d+ processed take is missing/i,
  ].some(pattern => pattern.test(message));
}

export function selectAutoRecordDeckPath(
  activePresentationPath: string | undefined,
  editorDeckPath: string | undefined,
): string | undefined {
  return activePresentationPath ?? editorDeckPath;
}

export interface AutoRecordPreflightOperations<T> {
  loadNarration(): Promise<T | undefined>;
  confirmStart(): Promise<boolean>;
  openPresentation(): Promise<boolean>;
}

export async function runAutoRecordPreflight<T>(
  operations: AutoRecordPreflightOperations<T>,
): Promise<T | undefined> {
  const prepared = await operations.loadNarration();
  if (prepared === undefined) {
    return undefined;
  }
  if (!await operations.confirmStart()) {
    return undefined;
  }
  if (!await operations.openPresentation()) {
    return undefined;
  }
  return prepared;
}

interface NarrationPreparationUi {
  showWarning(message: string, action: string): PromiseLike<string | undefined>;
  executeCommand(command: string): PromiseLike<unknown>;
}

export async function offerNarrationPreparation(
  ui: NarrationPreparationUi,
): Promise<boolean> {
  const choice = await ui.showWarning(
    'Narration must be recorded and processed before Auto-Record can use measured timing.',
    RECORD_NARRATION_ACTION,
  );
  if (choice !== RECORD_NARRATION_ACTION) {
    return false;
  }
  await ui.executeCommand('deckPilot.recordNarration');
  return true;
}