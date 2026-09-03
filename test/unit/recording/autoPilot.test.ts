import { expect } from 'chai';
import { parseDeck } from '../../../packages/core/src/parser/deckParser';
import {
  buildAutoPilotPlan,
  NarrationTiming,
} from '../../../packages/extension/src/recording/autoPilot';

describe('AutoPilot narration timing', () => {
  it('uses measured take durations for narrated beats', async () => {
    const result = await parseDeck(`---
slideBreak: marker
---
# Opening

<!-- voice: First narration beat. -->

<!-- voice[1]: Second narration beat. -->

<!-- fragment -->

Fragment content

<!-- slide -->

# Closing without narration
`, 'timed.deck.md');
    expect(result.error).to.be.undefined;

    const timings: NarrationTiming[] = [
      { cueIndex: 1, text: 'First narration beat.', durationMs: 4123 },
      { cueIndex: 2, text: 'Second narration beat.', durationMs: 2789 },
    ];
    const plan = buildAutoPilotPlan(result.deck!.slides, {
      initialDelayMs: 0,
      finalDelayMs: 0,
      minDisplayMs: 900,
    }, timings);
    const openingWait = plan.find(step => step.label.startsWith('Slide 1:'));
    const narratedFragmentWait = plan.find(step =>
      step.label.includes('Second narration beat.'));
    const closingWait = plan.find(step => step.label === 'Slide 2: display');

    expect(openingWait?.durationMs).to.equal(4123);
    expect(narratedFragmentWait?.durationMs).to.equal(2789);
    expect(closingWait?.durationMs).to.equal(900);
  });
});
