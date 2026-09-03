import { expect } from 'chai';
import { createDeck } from '../../../packages/core/src/models/deck';
import { createSlide } from '../../../packages/core/src/models/slide';
import { Conductor } from '../../../packages/extension/src/conductor/conductor';

interface AutoRecordHarness {
  deck: ReturnType<typeof createDeck>;
  outputChannel: { appendLine(message: string): void };
  autoPilotRunning: boolean;
  pendingVideoNarrationCues: Map<number, Array<{ cueIndex: number; offsetMs: number }>>;
  narrationTimings: readonly unknown[];
  recordingState: {
    isRecording(): boolean;
    stopRecording(slideIndex?: number): undefined;
  };
  currentSlideIndex: number;
  startRecording(): Promise<void>;
  autoRecord: Conductor['autoRecord'];
  isAutoPilotActive: Conductor['isAutoPilotActive'];
}

describe('Conductor Auto-Record lifecycle', () => {
  it('clears the running flag when recorder startup throws', async () => {
    const harness = Object.create(Conductor.prototype) as AutoRecordHarness;
    harness.deck = createDeck('/deck.md', [createSlide(0, '# Slide', '<h1>Slide</h1>')]);
    harness.outputChannel = { appendLine: () => undefined };
    harness.autoPilotRunning = false;
    harness.pendingVideoNarrationCues = new Map();
    harness.narrationTimings = [];
    harness.recordingState = {
      isRecording: () => false,
      stopRecording: () => undefined,
    };
    harness.currentSlideIndex = 0;
    let startupAttempts = 0;
    harness.startRecording = async () => {
      startupAttempts++;
      throw new Error('recorder startup failed');
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      let error: unknown;
      try {
        await harness.autoRecord([]);
      } catch (caught) {
        error = caught;
      }

      expect(error).to.be.instanceOf(Error);
      expect(harness.isAutoPilotActive()).to.equal(false);
    }

    expect(startupAttempts).to.equal(2);
  });
});