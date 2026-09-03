import { expect } from 'chai';
import {
  offerNarrationPreparation,
  RECORD_NARRATION_ACTION,
  requiresNarrationUpdate,
  runAutoRecordPreflight,
  selectAutoRecordDeckPath,
} from '../../../packages/extension/src/recording/autoRecordPrerequisite';

describe('requiresNarrationUpdate', () => {
  it('recognizes pending, stale, and missing narration takes', () => {
    expect(requiresNarrationUpdate(new Error('Error: record every narration cue before continuing')))
      .to.equal(true);
    expect(requiresNarrationUpdate(new Error('Narration cue 2 does not match the current deck.')))
      .to.equal(true);
    expect(requiresNarrationUpdate(new Error('Narration cue 3 processed take is missing.')))
      .to.equal(true);
  });

  it('does not hide recorder or configuration failures', () => {
    expect(requiresNarrationUpdate(new Error('srt-dubber is not available.')))
      .to.equal(false);
    expect(requiresNarrationUpdate(new Error('Permission denied')))
      .to.equal(false);
  });
});

describe('selectAutoRecordDeckPath', () => {
  it('uses the running presentation instead of an active editor file', () => {
    expect(selectAutoRecordDeckPath('/decks/running.deck.md', '/src/readme.md'))
      .to.equal('/decks/running.deck.md');
  });

  it('uses the resolved editor deck when no presentation is active', () => {
    expect(selectAutoRecordDeckPath(undefined, '/decks/editor.deck.md'))
      .to.equal('/decks/editor.deck.md');
  });
});

describe('offerNarrationPreparation', () => {
  it('launches narration preparation when the user chooses the action', async () => {
    const commands: string[] = [];
    const prompted = await offerNarrationPreparation({
      showWarning: async (message, action) => {
        expect(message).to.include('before Auto-Record');
        expect(action).to.equal(RECORD_NARRATION_ACTION);
        return action;
      },
      executeCommand: async command => {
        commands.push(command);
      },
    });

    expect(prompted).to.equal(true);
    expect(commands).to.deep.equal(['deckPilot.recordNarration']);
  });

  it('does not launch narration preparation when dismissed', async () => {
    const commands: string[] = [];
    const prompted = await offerNarrationPreparation({
      showWarning: async () => undefined,
      executeCommand: async command => {
        commands.push(command);
      },
    });

    expect(prompted).to.equal(false);
    expect(commands).to.be.empty;
  });
});

describe('runAutoRecordPreflight', () => {
  it('does not open the presentation when narration is missing', async () => {
    const events: string[] = [];
    const result = await runAutoRecordPreflight({
      loadNarration: async () => {
        events.push('narration');
        return undefined;
      },
      confirmStart: async () => {
        events.push('confirm');
        return true;
      },
      openPresentation: async () => {
        events.push('open');
        return true;
      },
    });

    expect(result).to.equal(undefined);
    expect(events).to.deep.equal(['narration']);
  });

  it('opens only after narration is ready and the user confirms', async () => {
    const events: string[] = [];
    const result = await runAutoRecordPreflight({
      loadNarration: async () => {
        events.push('narration');
        return ['timing'];
      },
      confirmStart: async () => {
        events.push('confirm');
        return true;
      },
      openPresentation: async () => {
        events.push('open');
        return true;
      },
    });

    expect(result).to.deep.equal(['timing']);
    expect(events).to.deep.equal(['narration', 'confirm', 'open']);
  });

  it('does not open the presentation when the user declines Start', async () => {
    const events: string[] = [];
    const result = await runAutoRecordPreflight({
      loadNarration: async () => {
        events.push('narration');
        return ['timing'];
      },
      confirmStart: async () => {
        events.push('confirm');
        return false;
      },
      openPresentation: async () => {
        events.push('open');
        return true;
      },
    });

    expect(result).to.equal(undefined);
    expect(events).to.deep.equal(['narration', 'confirm']);
  });
});