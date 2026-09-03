import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

interface ProcessOutput {
  stdout: string;
  stderr: string;
}

const execFile = (file: string, args: string[]): Promise<ProcessOutput> =>
  new Promise((resolve, reject) => {
    cp.execFile(file, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${file} failed: ${stderr || error.message}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });

async function main(): Promise<void> {
  const repoRoot = path.resolve(__dirname, '../../../..');
  const fixtureRoot = path.join(os.tmpdir(), 'deckpilot-auto-record-e2e');
  const outputRoot = path.join(fixtureRoot, 'recordings');
  const resultPath = path.join(fixtureRoot, 'result.json');
  const userDataDir = path.join(fixtureRoot, 'vscode-user-data');
  const extensionsDir = path.join(fixtureRoot, 'vscode-extensions');
  const srtDubber = process.env['SRT_DUBBER_PATH'] ?? path.resolve(
    repoRoot, '..', 'srt-dubber', 'build', 'Release',
    process.platform === 'win32' ? 'srt-dubber.exe' : 'srt-dubber',
  );

  await fs.promises.rm(fixtureRoot, { recursive: true, force: true });
  await fs.promises.mkdir(outputRoot, { recursive: true });
  await fs.promises.mkdir(path.join(fixtureRoot, 'clips'), { recursive: true });
  await fs.promises.access(srtDubber);

  const ffmpeg = process.env['FFMPEG_PATH'] ?? 'ffmpeg';
  await execFile(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=green:s=960x540',
    '-frames:v', '1', path.join(fixtureRoot, 'opening.png'),
  ]);
  await execFile(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=blue:s=960x540',
    '-frames:v', '1', path.join(fixtureRoot, 'closing.png'),
  ]);
  await execFile(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=red:s=640x360:r=15:d=2',
    '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000:duration=2',
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    path.join(fixtureRoot, 'clips', 'execution-demo.mp4'),
  ]);
  const takesDir = path.join(fixtureRoot, 'fixture-takes');
  await fs.promises.mkdir(takesDir, { recursive: true });
  for (let index = 1; index <= 8; index++) {
    await execFile(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', `sine=frequency=${330 + index * 110}:sample_rate=44100:duration=0.7`,
      '-ac', '1', '-c:a', 'pcm_s16le', path.join(takesDir, `${index}.wav`),
    ]);
  }

  await fs.promises.writeFile(
    path.join(fixtureRoot, 'workflow.deck.md'),
    `---
title: Autonomous Workflow Validation
slideBreak: marker
options:
  zenMode: false
autoRecord:
  wordsPerMinute: 600
  minDisplayMs: 1500
  initialDelayMs: 1000
  finalDelayMs: 1000
---

<!-- id: opening -->
# Opening

![Opening frame](./opening.png)

<!-- slide -->

:::video
id: duck-demo
src: ./clips/execution-demo.mp4
audio: duck
:::

<!-- slide -->

:::video
id: mute-demo
src: ./clips/execution-demo.mp4
audio: mute
:::

<!-- slide -->

:::video
id: preserve-demo
src: ./clips/execution-demo.mp4
audio: preserve
:::

<!-- slide -->

<!-- id: closing -->
# Closing

![Closing frame](./closing.png)
`,
    'utf8',
  );

  await fs.promises.writeFile(
    path.join(fixtureRoot, 'workflow.deck.yaml'),
    `items:
  - id: opening
    cues:
      - "Opening narration fixture."
  - id: duck-demo
    cues:
      - "Ducked video narration fixture."
      - at: 900ms
        text: "Timed ducked video narration fixture."
  - id: mute-demo
    cues:
      - "Muted video narration fixture."
      - at: 900ms
        text: "Timed muted video narration fixture."
  - id: preserve-demo
    cues:
      - "Preserved video narration fixture."
      - at: 900ms
        text: "Timed preserved video narration fixture."
  - id: closing
    cues:
      - "Closing narration fixture."
`,
    'utf8',
  );

  const vscodeExecutablePath = process.env['VSCODE_EXECUTABLE_PATH'] ??
    (process.platform === 'win32'
      ? 'C:\\Program Files\\Microsoft VS Code\\Code.exe'
      : undefined);

  await runTests({
    ...(vscodeExecutablePath ? { vscodeExecutablePath } : {}),
    extensionDevelopmentPath: repoRoot,
    extensionTestsPath: path.join(repoRoot, 'out', 'test', 'e2e', 'videoWorkflow', 'suite', 'index.js'),
    extensionTestsEnv: {
      DECKPILOT_E2E_FIXTURE_ROOT: fixtureRoot,
      DECKPILOT_E2E_OUTPUT_ROOT: outputRoot,
      DECKPILOT_E2E_RESULT_PATH: resultPath,
      DECKPILOT_E2E_TAKES_ROOT: takesDir,
      SRT_DUBBER_PATH: srtDubber,
    },
    launchArgs: [
      fixtureRoot,
      '--disable-workspace-trust',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-telemetry',
      '--disable-extensions',
      `--user-data-dir=${userDataDir}`,
      `--extensions-dir=${extensionsDir}`,
    ],
  });

  const result = JSON.parse(await fs.promises.readFile(resultPath, 'utf8')) as {
    fixtureRoot: string;
    outputRoot: string;
    videoPath: string;
    srtPath: string;
    captionCount: number;
    captureWidth?: number;
    captureHeight?: number;
    compositionDecisionCount: number;
    capturePath: string;
    finalVideoPath: string;
    narrationTimings: Array<{ cueIndex: number; durationMs: number }>;
    compositionDecisions: Array<{
      videoId: string;
      outputStartMs: number;
      outputEndMs: number;
    }>;
  };
  if (result.narrationTimings.length !== result.captionCount ||
      result.narrationTimings.some(timing => timing.durationMs <= 0)) {
    throw new Error(`Invalid narration timings: ${JSON.stringify(result.narrationTimings)}`);
  }

  const finalVideoPath = result.finalVideoPath;
  const probe = await execFile(process.env['FFPROBE_PATH'] ?? 'ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height',
    '-of', 'json', finalVideoPath,
  ]);
  const media = JSON.parse(probe.stdout) as {
    streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const video = media.streams?.find(stream => stream.codec_type === 'video');
  const audio = media.streams?.find(stream => stream.codec_type === 'audio');
  if (video?.codec_name !== 'h264' || audio?.codec_name !== 'aac') {
    throw new Error(`Unexpected final streams: ${probe.stdout}`);
  }
  if (Number(media.format?.duration ?? 0) <= 0) {
    throw new Error('Final MP4 has no duration');
  }
  if (process.platform === 'win32') {
    const expectedWidth = result.captureWidth ?? 0;
    const expectedHeight = result.captureHeight ?? 0;
    const widthMatches = video.width === expectedWidth || video.width === expectedWidth - 1;
    const heightMatches = video.height === expectedHeight || video.height === expectedHeight - 1;
    if (!widthMatches || !heightMatches) {
      throw new Error(
        `Expected window-sized video near ${expectedWidth}x${expectedHeight}, got ${video.width}x${video.height}`,
      );
    }
  }

  await execFile(ffmpeg, ['-v', 'error', '-i', finalVideoPath, '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null']);
  const sourceHash = await execFile(ffmpeg, ['-v', 'error', '-i', result.videoPath, '-map', '0:v:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']);
  const finalHash = await execFile(ffmpeg, ['-v', 'error', '-i', finalVideoPath, '-map', '0:v:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']);
  if (sourceHash.stdout.trim() !== finalHash.stdout.trim()) {
    throw new Error('srt-dubber changed the encoded video stream');
  }

  const duckDecision = result.compositionDecisions.find(decision => decision.videoId === 'duck-demo');
  if (!duckDecision) {
    throw new Error('Missing duck-demo composition decision');
  }
  const clipMiddleSeconds = ((duckDecision.outputStartMs +
    duckDecision.outputEndMs) / 2 / 1000).toFixed(3);
  const frameStats = await execFile(ffmpeg, [
    '-hide_banner', '-nostats', '-ss', clipMiddleSeconds, '-i', finalVideoPath,
    '-vf', 'crop=100:100:(iw-100)/2:(ih-100)/2,signalstats,metadata=print',
    '-frames:v', '1', '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null',
  ]);
  const uAverage = Number(frameStats.stderr.match(/lavfi\.signalstats\.UAVG=([\d.]+)/)?.[1]);
  const vAverage = Number(frameStats.stderr.match(/lavfi\.signalstats\.VAVG=([\d.]+)/)?.[1]);
  if (!(uAverage < 110 && vAverage > 220)) {
    throw new Error(`Inserted source clip was not red at ${clipMiddleSeconds}s: U=${uAverage}, V=${vAverage}`);
  }

  const policyVolumes = new Map<string, number>();
  for (const decision of result.compositionDecisions) {
    const sampleSeconds = ((decision.outputStartMs + 1750) / 1000).toFixed(3);
    const audioStats = await execFile(ffmpeg, [
      '-hide_banner', '-nostats', '-ss', sampleSeconds, '-t', '0.2',
      '-i', finalVideoPath, '-map', '0:a:0', '-af', 'volumedetect',
      '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null',
    ]);
    const rawVolume = audioStats.stderr.match(/mean_volume: ([-\w.]+) dB/)?.[1];
    policyVolumes.set(decision.videoId, rawVolume === '-inf' ? Number.NEGATIVE_INFINITY : Number(rawVolume));
  }
  const muteVolume = policyVolumes.get('mute-demo') ?? 0;
  const duckVolume = policyVolumes.get('duck-demo') ?? Number.NEGATIVE_INFINITY;
  const preserveVolume = policyVolumes.get('preserve-demo') ?? Number.NEGATIVE_INFINITY;
  if (!(muteVolume < -70 && duckVolume > -50 && preserveVolume - duckVolume > 8)) {
    throw new Error(
      `Unexpected policy levels: mute=${muteVolume}, duck=${duckVolume}, preserve=${preserveVolume}`,
    );
  }

  process.stdout.write(`${JSON.stringify({
    ...result,
    finalVideoPath,
    videoCodec: video.codec_name,
    audioCodec: audio.codec_name,
    width: video.width,
    height: video.height,
    insertedFrameUAverage: uAverage,
    insertedFrameVAverage: vAverage,
    sourceAudioPolicyVolumesDb: Object.fromEntries(policyVolumes),
    videoHash: finalHash.stdout.trim(),
  }, null, 2)}\n`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});