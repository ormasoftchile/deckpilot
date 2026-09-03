import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  findLatestNarrationArtifacts,
  resolveDubbingExecutable,
  validateNarrationArtifacts,
} from '../../../packages/extension/src/dubbing/dubbingDiscovery';

describe('dubbing discovery', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'deckpilot-dubbing-'));
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  it('finds the newest complete MP4/SRT pair in nested session folders', async () => {
    const older = path.join(root, 'recordings', 'talk', 'older');
    const newer = path.join(root, 'recordings', 'talk', 'newer');
    await fs.promises.mkdir(older, { recursive: true });
    await fs.promises.mkdir(newer, { recursive: true });
    await fs.promises.writeFile(path.join(older, 'talk.mp4'), 'video');
    await fs.promises.writeFile(path.join(older, 'talk.srt'), 'captions');
    await fs.promises.writeFile(path.join(newer, 'talk.mp4'), 'video');
    await fs.promises.writeFile(path.join(newer, 'talk.srt'), 'captions');
    const oldTime = new Date('2026-01-01T00:00:00Z');
    const newTime = new Date('2026-02-01T00:00:00Z');
    await fs.promises.utimes(path.join(older, 'talk.mp4'), oldTime, oldTime);
    await fs.promises.utimes(path.join(older, 'talk.srt'), oldTime, oldTime);
    await fs.promises.utimes(path.join(newer, 'talk.mp4'), newTime, newTime);
    await fs.promises.utimes(path.join(newer, 'talk.srt'), newTime, newTime);

    const result = await findLatestNarrationArtifacts([root]);

    expect(result?.videoPath).to.equal(path.join(newer, 'talk.mp4'));
    expect(result?.srtPath).to.equal(path.join(newer, 'talk.srt'));
  });

  it('ignores exports without a same-basename pair', async () => {
    await fs.promises.writeFile(path.join(root, 'orphan.mp4'), 'video');
    await fs.promises.writeFile(path.join(root, 'different.srt'), 'captions');

    const result = await findLatestNarrationArtifacts([root]);

    expect(result).to.be.undefined;
  });

  it('pairs video and srt in a session directory with recording-session.json', async () => {
    const sessionDir = path.join(root, 'recordings', 'talk', 'session1');
    await fs.promises.mkdir(sessionDir, { recursive: true });
    await fs.promises.writeFile(path.join(sessionDir, 'recording-session.json'), '{}');
    await fs.promises.writeFile(path.join(sessionDir, 'talk.mp4'), 'video');
    await fs.promises.writeFile(path.join(sessionDir, 'narration.srt'), '1\n00:00:01,000 --> 00:00:02,000\nHello\n');

    const result = await findLatestNarrationArtifacts([root]);

    expect(result?.videoPath).to.equal(path.join(sessionDir, 'talk.mp4'));
    expect(result?.srtPath).to.equal(path.join(sessionDir, 'narration.srt'));
  });

  it('rejects an empty SRT before launching narration', async () => {
    const videoPath = path.join(root, 'talk.mp4');
    const srtPath = path.join(root, 'talk.srt');
    await fs.promises.writeFile(videoPath, 'video');
    await fs.promises.writeFile(srtPath, '');

    const error = await validateNarrationArtifacts({ videoPath, srtPath, modifiedMs: Date.now() });

    expect(error).to.include('no narration entries');
  });

  it('rejects a whitespace-only SRT before launching narration', async () => {
    const videoPath = path.join(root, 'talk.mp4');
    const srtPath = path.join(root, 'talk.srt');
    await fs.promises.writeFile(videoPath, 'video');
    await fs.promises.writeFile(srtPath, ' \r\n\t');

    const error = await validateNarrationArtifacts({ videoPath, srtPath, modifiedMs: Date.now() });

    expect(error).to.include('no narration entries');
  });

  it('rejects an empty MP4 before launching narration', async () => {
    const videoPath = path.join(root, 'talk.mp4');
    const srtPath = path.join(root, 'talk.srt');
    await fs.promises.writeFile(videoPath, '');
    await fs.promises.writeFile(srtPath, '1\n00:00:00,000 --> 00:00:01,000\nHello');

    const error = await validateNarrationArtifacts({ videoPath, srtPath, modifiedMs: Date.now() });

    expect(error).to.equal('The exported MP4 is empty.');
  });

  it('resolves an explicit executable path', async () => {
    const executable = path.join(root, process.platform === 'win32' ? 'srt-dubber.exe' : 'srt-dubber');
    await fs.promises.writeFile(executable, 'binary');

    expect(resolveDubbingExecutable(executable, root, '')).to.equal(executable);
  });

  it('resolves a configured path relative to the deck directory', async () => {
    const deckDirectory = path.join(root, 'deck');
    const toolsDirectory = path.join(root, 'tools');
    await fs.promises.mkdir(deckDirectory);
    await fs.promises.mkdir(toolsDirectory);
    const filename = process.platform === 'win32' ? 'srt-dubber.exe' : 'srt-dubber';
    const executable = path.join(toolsDirectory, filename);
    await fs.promises.writeFile(executable, 'binary');

    expect(resolveDubbingExecutable(`../tools/${filename}`, deckDirectory, '')).to.equal(executable);
  });

  it('resolves srt-dubber from PATH', async () => {
    const filename = process.platform === 'win32' ? 'srt-dubber.exe' : 'srt-dubber';
    const executable = path.join(root, filename);
    await fs.promises.writeFile(executable, 'binary');

    expect(resolveDubbingExecutable('srt-dubber', root, root)).to.equal(executable);
  });
});