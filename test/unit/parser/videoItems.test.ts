import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseDeck } from '../../../packages/core/src/parser/deckParser';
import { buildAutoPilotPlan } from '../../../packages/extension/src/recording/autoPilot';

describe('video deck items', () => {
  let root: string;
  let deckPath: string;

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'deckpilot-video-item-'));
    deckPath = path.join(root, 'talk.deck.md');
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  it('parses a video block as a first-class item between slides', async () => {
    const source = `---
slideBreak: marker
---
# Introduction

<!-- slide -->

:::video
id: execution-demo
src: ./clips/execution.mp4
start: 5s
end: 42s
audio: duck
:::

<!-- slide -->

# Summary
`;

    const result = await parseDeck(source, deckPath);

    expect(result.error).to.be.undefined;
    expect(result.deck!.items).to.have.length(3);
    expect(result.deck!.items!.map(item => item.kind)).to.deep.equal(['slide', 'video', 'slide']);
    const video = result.deck!.items![1];
    expect(video?.kind).to.equal('video');
    if (video?.kind === 'video') {
      expect(video.id).to.equal('execution-demo');
      expect(video.src).to.equal('./clips/execution.mp4');
      expect(video.trimStartMs).to.equal(5000);
      expect(video.trimEndMs).to.equal(42000);
      expect(video.audio).to.equal('duck');
      expect(video.slide.html).to.include('<video');
      expect(video.slide.html).to.include('data-trim-start="5000"');
    }
    const plan = buildAutoPilotPlan(result.deck!.slides);
    expect(plan.some(step => step.type === 'play-video' && step.slideIndex === 1)).to.equal(true);
  });

  it('merges canonical sidecar items narration onto a video item', async () => {
    const source = `---
slideBreak: marker
---
:::video
id: execution-demo
src: ./clips/execution.mp4
:::
`;
    await fs.promises.writeFile(deckPath.replace('.deck.md', '.deck.yaml'), `items:
  - id: execution-demo
    cues:
      - "Watch the command execute."
      - "Notice the output update."
`);

    const result = await parseDeck(source, deckPath);

    expect(result.deck?.slides[0].cues).to.deep.equal([
      'Watch the command execute.',
      'Notice the output update.',
    ]);
  });

  it('holds a video item until its measured timed narration finishes', async () => {
    const source = `---
slideBreak: marker
---
:::video
id: execution-demo
src: ./clips/execution.mp4
:::
`;
    await fs.promises.writeFile(deckPath.replace('.deck.md', '.deck.yaml'), `items:
  - id: execution-demo
    cues:
      - "Introduce the clip."
      - at: 900ms
        text: "Explain the final frame."
`);
    const result = await parseDeck(source, deckPath);

    const plan = buildAutoPilotPlan(result.deck!.slides, {}, [
      { cueIndex: 1, text: 'Introduce the clip.', durationMs: 1200 },
      { cueIndex: 2, text: 'Explain the final frame.', durationMs: 4000 },
    ]);
    const videoStep = plan.find(step => step.type === 'play-video');

    expect(videoStep?.durationMs).to.equal(4900);
  });
});