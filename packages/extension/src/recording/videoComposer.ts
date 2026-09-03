import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { RecordingComposition, RecordingSession } from '@deckpilot/core/models/recording';
import type { Slide } from '@deckpilot/core/models/slide';
import { buildVideoCompositionPlan, VideoCompositionPlan } from './videoCompositionPlan';

interface MediaInfo {
  durationMs: number;
  width: number;
  height: number;
  frameRate: number;
  hasAudio: boolean;
}

export interface CompositionResult {
  composition: RecordingComposition;
  plan: VideoCompositionPlan;
}

export async function probeRecordedMediaDuration(filePath: string): Promise<number> {
  return (await probeMedia(filePath)).durationMs;
}

export async function validateVideoSources(
  slides: Slide[],
  baseDirectory: string,
): Promise<Map<number, number>> {
  const durations = new Map<number, number>();
  for (let slideIndex = 0; slideIndex < slides.length; slideIndex++) {
    const slide = slides[slideIndex];
    if (!slide.video) {
      continue;
    }
    const source = path.isAbsolute(slide.video.src)
      ? slide.video.src
      : path.resolve(baseDirectory, slide.video.src);
    await fs.promises.access(source);
    const media = await probeMedia(source);
    if (slide.video.trimEndMs !== undefined && slide.video.trimEndMs > media.durationMs) {
      throw new Error(
        `Video item '${slide.video.id}' ends at ${slide.video.trimEndMs}ms, beyond its ${media.durationMs}ms duration`,
      );
    }
    durations.set(
      slideIndex,
      (slide.video.trimEndMs ?? media.durationMs) - (slide.video.trimStartMs ?? 0),
    );
  }
  return durations;
}

export async function composeRecordedVideo(
  session: RecordingSession,
  baseDirectory: string,
): Promise<CompositionResult | undefined> {
  const capturePath = session.recorder?.outputPath;
  const outputDirectory = session.outputDirectory;
  const starts = session.events.filter(event => event.type === 'video.started');
  if (!capturePath || !outputDirectory || starts.length === 0) {
    return undefined;
  }

  const capture = await probeMedia(capturePath);
  const sourcePaths = new Map<string, string>();
  const sourceInfo = new Map<string, MediaInfo>();
  for (const start of starts) {
    const videoId = String(start.metadata?.['videoId'] ?? '');
    const rawSrc = String(start.metadata?.['src'] ?? '');
    if (!videoId || !rawSrc || sourcePaths.has(videoId)) {
      continue;
    }
    const resolved = path.isAbsolute(rawSrc) ? rawSrc : path.resolve(baseDirectory, rawSrc);
    await fs.promises.access(resolved);
    sourcePaths.set(videoId, resolved);
    sourceInfo.set(videoId, await probeMedia(resolved));
  }

  const durations = new Map(
    [...sourceInfo.entries()].map(([id, info]) => [id, info.durationMs]),
  );
  const plan = buildVideoCompositionPlan(
    session.events,
    capture.durationMs,
    durations,
  );
  if (plan.decisions.length === 0) {
    return undefined;
  }

  const outputPath = path.join(outputDirectory, `${deckName(session.deckPath)}.mp4`);
  const inputs = [capturePath, ...plan.decisions.map(decision => sourcePaths.get(decision.videoId)!)];
  const filter = buildFilter(plan, capture, sourceInfo);
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  for (const input of inputs) {
    args.push('-i', input);
  }
  args.push(
    '-filter_complex', filter,
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
    outputPath,
  );
  await execFile(process.env['FFMPEG_PATH'] ?? 'ffmpeg', args);

  return {
    plan,
    composition: {
      capturePath,
      outputPath,
      outputDurationMs: plan.outputDurationMs,
      decisions: plan.decisions,
    },
  };
}

function buildFilter(
  plan: VideoCompositionPlan,
  capture: MediaInfo,
  sourceInfo: Map<string, MediaInfo>,
): string {
  const filters: string[] = [];
  const videoLabels: string[] = [];
  let captureCursorMs = 0;
  let outputCursorMs = 0;
  let videoIndex = 0;

  const captureSegment = (startMs: number, endMs: number, outputDurationMs: number): void => {
    if (endMs <= startMs || outputDurationMs <= 0) {
      return;
    }
    const rate = outputDurationMs / (endMs - startMs);
    const label = `v${videoIndex++}`;
    filters.push(
      `[0:v]trim=start=${seconds(startMs)}:end=${seconds(endMs)},` +
      `setpts=${rate.toFixed(9)}*(PTS-STARTPTS),` +
      `tpad=stop_mode=clone:stop_duration=${seconds(outputDurationMs)},` +
      `trim=duration=${seconds(outputDurationMs)},setsar=1,fps=${capture.frameRate},` +
      `format=yuv420p[${label}]`,
    );
    videoLabels.push(`[${label}]`);
  };

  plan.decisions.forEach((decision) => {
    captureSegment(
      captureCursorMs,
      decision.captureStartMs,
      decision.outputStartMs - outputCursorMs,
    );
    captureSegment(
      decision.captureStartMs,
      decision.captureEndMs,
      decision.outputEndMs - decision.outputStartMs,
    );
    captureCursorMs = decision.captureEndMs;
    outputCursorMs = decision.outputEndMs;
  });
  captureSegment(
    captureCursorMs,
    capture.durationMs,
    plan.outputDurationMs - outputCursorMs,
  );
  filters.push(
    `${videoLabels.join('')}concat=n=${videoLabels.length}:v=1:a=0,` +
    `trim=duration=${seconds(plan.outputDurationMs)},setpts=PTS-STARTPTS[vout]`,
  );

  filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${seconds(plan.outputDurationMs)}[silence]`);
  const audioLabels = ['[silence]'];
  plan.decisions.forEach((decision, decisionIndex) => {
    const info = sourceInfo.get(decision.videoId);
    if (!info?.hasAudio || decision.audio === 'mute') {
      return;
    }
    const label = `a${decisionIndex}`;
    const volume = decision.audio === 'duck' ? 0.25 : 1;
    filters.push(
      `[${decisionIndex + 1}:a]atrim=start=${seconds(decision.sourceStartMs)}:end=${seconds(decision.sourceEndMs)},` +
      `asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
      `volume=${volume},adelay=delays=${decision.outputStartMs}:all=1[${label}]`,
    );
    audioLabels.push(`[${label}]`);
  });
  filters.push(
    audioLabels.length === 1
      ? '[silence]anull[aout]'
      : `${audioLabels.join('')}amix=inputs=${audioLabels.length}:normalize=0,atrim=duration=${seconds(plan.outputDurationMs)}[aout]`,
  );
  return filters.join(';');
}

async function probeMedia(filePath: string): Promise<MediaInfo> {
  const { stdout } = await execFile(process.env['FFPROBE_PATH'] ?? 'ffprobe', [
    '-v', 'error', '-show_entries',
    'format=duration:stream=codec_type,width,height,avg_frame_rate',
    '-of', 'json', filePath,
  ]);
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ codec_type?: string; width?: number; height?: number; avg_frame_rate?: string }>;
    format?: { duration?: string };
  };
  const video = parsed.streams?.find(stream => stream.codec_type === 'video');
  if (!video?.width || !video.height) {
    throw new Error(`No video stream in ${filePath}`);
  }
  return {
    durationMs: Math.round(Number(parsed.format?.duration ?? 0) * 1000),
    width: video.width,
    height: video.height,
    frameRate: parseFrameRate(video.avg_frame_rate),
    hasAudio: parsed.streams?.some(stream => stream.codec_type === 'audio') ?? false,
  };
}

function parseFrameRate(value: string | undefined): number {
  if (!value) {
    return 30;
  }
  const parts = value.split('/').map(Number);
  const numerator = parts[0];
  const denominator = parts[1] ?? 1;
  const result = numerator / denominator;
  return Number.isFinite(result) && result > 0 ? result : 30;
}

function seconds(milliseconds: number): string {
  return (milliseconds / 1000).toFixed(3);
}

function deckName(deckPath: string): string {
  return path.basename(deckPath).replace(/\.deck\.(md|yaml)$/i, '').replace(/\.md$/i, '');
}

function execFile(file: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    cp.execFile(file, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}