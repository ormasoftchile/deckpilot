import { expect } from 'chai';
import * as path from 'path';
import {
  recordingDeckName,
  resolveRecordingOutputLayout,
} from '../../../packages/extension/src/recording/outputLayout';

describe('resolveRecordingOutputLayout', () => {
  const deckPath = path.resolve('decks', 'my-talk.deck.md');
  const startedAt = new Date(2026, 8, 2, 14, 15, 26).getTime();

  it('derives stable artifact names from deck paths', () => {
    expect(recordingDeckName(deckPath)).to.equal('my-talk');
    expect(recordingDeckName(path.resolve('decks', 'notes.md'))).to.equal('notes');
  });

  it('defaults to a unique session under recordings/<deck>', () => {
    const layout = resolveRecordingOutputLayout({
      deckPath,
      sessionId: 'a1b2c3d4-full-id',
      startedAt,
    });

    expect(layout.outputRoot).to.equal(path.join(path.dirname(deckPath), 'recordings'));
    expect(layout.sessionDirectory).to.equal(path.join(
      path.dirname(deckPath),
      'recordings',
      'my-talk',
      '20260902-141526-a1b2c3d4',
    ));
    expect(layout.narrationDirectory).to.equal(path.join(
      path.dirname(deckPath),
      'recordings',
      'my-talk',
      'narration',
    ));
  });

  it('resolves recorder output relative to the deck', () => {
    const layout = resolveRecordingOutputLayout({
      deckPath,
      sessionId: '12345678',
      startedAt,
      recorderOutputDir: './captures',
    });

    expect(layout.outputRoot).to.equal(path.join(path.dirname(deckPath), 'captures'));
  });

  it('prefers sidecar export outputDir over recorder settings', () => {
    const layout = resolveRecordingOutputLayout({
      deckPath,
      sessionId: '12345678',
      startedAt,
      recorderOutputDir: './captures',
      exportOutputDir: './productions',
    });

    expect(layout.outputRoot).to.equal(path.join(path.dirname(deckPath), 'productions'));
  });
});