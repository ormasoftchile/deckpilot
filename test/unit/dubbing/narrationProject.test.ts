import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { VoiceOverCue } from '../../../packages/core/src/models/recording';
import {
  createNarrationProject,
  loadNarrationTimings,
} from '../../../packages/extension/src/dubbing/narrationProject';

describe('narration project handoff', () => {
  let root: string;
  const cues: VoiceOverCue[] = [
    { slideIndex: 0, text: 'Opening narration.', source: 'comment' },
    { slideIndex: 0, fragmentIndex: 1, text: 'Fragment narration.', source: 'comment' },
  ];

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'deckpilot-narration-'));
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  it('writes an ordered SRT scaffold for recording', async () => {
    const project = await createNarrationProject(cues, root);
    const srt = await fs.promises.readFile(project.srtPath, 'utf8');

    expect(path.basename(project.srtPath)).to.equal('narration.srt');
    expect(path.basename(project.projectPath)).to.equal('narration-project.json');
    expect(srt).to.include('1\n');
    expect(srt).to.include('Opening narration.');
    expect(srt).to.include('2\n');
    expect(srt).to.include('Fragment narration.');
  });

  it('loads text-matched processed durations by cue index', async () => {
    const project = await createNarrationProject(cues, root);
    const processedDirectory = path.join(root, 'processed');
    await fs.promises.mkdir(processedDirectory);
    const firstTake = path.join(processedDirectory, '1.wav');
    const secondTake = path.join(processedDirectory, '2.wav');
    await Promise.all([
      fs.promises.writeFile(firstTake, 'first'),
      fs.promises.writeFile(secondTake, 'second'),
    ]);
    await fs.promises.writeFile(project.projectPath, JSON.stringify([
      {
        index: 1,
        text: 'Opening narration.',
        processed_take_path: firstTake,
        processed_duration_ms: 4123,
        status: 'ok',
      },
      {
        index: 2,
        text: 'Fragment narration.',
        processed_take_path: secondTake,
        processed_duration_ms: 2789,
        status: 'ok',
      },
    ]));

    expect(await loadNarrationTimings(project, cues)).to.deep.equal([
      { cueIndex: 1, text: 'Opening narration.', durationMs: 4123 },
      { cueIndex: 2, text: 'Fragment narration.', durationMs: 2789 },
    ]);
  });

  it('rejects an incomplete narration project', async () => {
    const project = await createNarrationProject(cues, root);
    await fs.promises.writeFile(project.projectPath, JSON.stringify([
      {
        index: 1,
        text: 'Opening narration.',
        processed_take_path: '',
        processed_duration_ms: -1,
        status: 'pending',
      },
    ]));

    let error: unknown;
    try {
      await loadNarrationTimings(project, cues);
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
    expect((error as Error).message).to.include('cue 1');
  });
});
