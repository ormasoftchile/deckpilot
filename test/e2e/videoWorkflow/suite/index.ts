import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { parseDeck } from '@deckpilot/core/parser';
import { Conductor } from '../../../../packages/extension/src/conductor/conductor';
import { RecordingSerializer } from '../../../../packages/extension/src/recording/recordingSerializer';
import { VoiceOverScriptGenerator } from '../../../../packages/extension/src/recording/voiceOverScriptGenerator';
import { CaptionsScaffoldGenerator } from '../../../../packages/extension/src/recording/captionsScaffoldGenerator';
import {
  createNarrationProject,
  loadNarrationTimings,
  stageNarrationProjectForSession,
} from '../../../../packages/extension/src/dubbing/narrationProject';
import {
  assembleNarrationProject,
  prepareNarrationProject,
  resyncNarrationProject,
} from '../../../../packages/extension/src/dubbing/dubbingLauncher';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export async function run(): Promise<void> {
  const fixtureRoot = requiredEnv('DECKPILOT_E2E_FIXTURE_ROOT');
  const outputRoot = requiredEnv('DECKPILOT_E2E_OUTPUT_ROOT');
  const resultPath = requiredEnv('DECKPILOT_E2E_RESULT_PATH');
  const fixtureTakesRoot = requiredEnv('DECKPILOT_E2E_TAKES_ROOT');
  const dubbingExecutable = requiredEnv('SRT_DUBBER_PATH');
  const deckPath = path.join(fixtureRoot, 'workflow.deck.md');
  const deckContent = await fs.promises.readFile(deckPath, 'utf8');
  const parsed = await parseDeck(deckContent, deckPath);
  if (!parsed.deck) {
    throw new Error(parsed.error ?? 'Deck parsing failed');
  }
  if (parsed.deck.slides.length !== 5) {
    throw new Error(`Expected 5 deck items, parsed ${parsed.deck.slides.length}`);
  }

  const extension = vscode.extensions.getExtension('focus-space.executable-talk');
  if (!extension) {
    throw new Error('Deckpilot extension is not loaded in the Extension Host');
  }

  const recorderCommand = process.platform === 'win32'
    ? 'ffmpeg -hide_banner -loglevel error -y -f gdigrab -draw_mouse 0 -framerate 15 -offset_x {{windowX}} -offset_y {{windowY}} -video_size {{windowWidth}}x{{windowHeight}} -i desktop -vf "crop=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -preset ultrafast -pix_fmt yuv420p "{{outputPath}}"'
    : 'ffmpeg -hide_banner -loglevel error -y -f lavfi -i "color=c=black:s=1280x720:r=15" -c:v libx264 -pix_fmt yuv420p "{{outputPath}}"';

  const configuration = vscode.workspace.getConfiguration('deckPilot.recording');
  await configuration.update('startCommand', recorderCommand, vscode.ConfigurationTarget.Workspace);
  await configuration.update('outputDir', outputRoot, vscode.ConfigurationTarget.Workspace);
  await configuration.update('outputExtension', 'mp4', vscode.ConfigurationTarget.Workspace);
  await vscode.workspace
    .getConfiguration('deckPilot.dubbing')
    .update('executable', dubbingExecutable, vscode.ConfigurationTarget.Workspace);

  const conductor = new Conductor(extension.extensionUri);
  try {
    const deckDocument = await vscode.workspace.openTextDocument(deckPath);
    await vscode.window.showTextDocument(deckDocument);
    const terminalCount = vscode.window.terminals.length;
    const narrationCommand = vscode.commands.executeCommand('deckPilot.recordNarration');
    await new Promise(resolve => setTimeout(resolve, 500));
    const narrationTerminal = vscode.window.terminals.find(
      terminal => terminal.name === 'Deckpilot Narration',
    );
    if (!narrationTerminal || vscode.window.terminals.length !== terminalCount + 1) {
      throw new Error('Deckpilot did not launch standalone narration from the deck');
    }
    const narrationProcessId = await narrationTerminal.processId;
    narrationTerminal.dispose();
    await narrationCommand;

    await conductor.openDeck(parsed.deck);
    await conductor.refreshDeckFromDisk();
    const setup = conductor.createNarrationSetup();
    if (!setup || setup.cues.length !== 8) {
      throw new Error(`Expected eight narration cues, got ${setup?.cues.length ?? 0}`);
    }
    const narrationProject = await createNarrationProject(setup.cues, setup.narrationDirectory);
    const projectTakesDirectory = path.join(setup.narrationDirectory, 'takes');
    await fs.promises.mkdir(projectTakesDirectory, { recursive: true });
    const projectEntries = [];
    for (let cueOffset = 0; cueOffset < setup.cues.length; cueOffset++) {
      const index = cueOffset + 1;
      const rawTakePath = path.join(projectTakesDirectory, `${index}.wav`);
      await fs.promises.copyFile(path.join(fixtureTakesRoot, `${index}.wav`), rawTakePath);
      projectEntries.push({
        index,
        start_ms: cueOffset * 5000,
        end_ms: (cueOffset + 1) * 5000,
        slot_duration_ms: 5000,
        text: setup.cues[cueOffset].text,
        raw_take_path: rawTakePath,
        processed_take_path: '',
        raw_duration_ms: -1,
        processed_duration_ms: -1,
        status: 'pending',
      });
    }
    await fs.promises.writeFile(
      narrationProject.projectPath,
      JSON.stringify(projectEntries, null, 2),
      'utf8',
    );
    await prepareNarrationProject(narrationProject.srtPath, fixtureRoot);
    const narrationTimings = await loadNarrationTimings(narrationProject, setup.cues);
    const session = await conductor.autoRecord(narrationTimings, setup.outputDirectory);
    if (!session?.recorder?.outputPath || !session.recorder.started || !session.recorder.stopped) {
      throw new Error(`Auto-Record did not complete: ${JSON.stringify(session?.recorder)}`);
    }

    const capturePath = session.recorder.outputPath;
    const videoPath = session.composition?.outputPath;
    if (!videoPath || session.composition?.decisions.length !== 3) {
      throw new Error(
        `Expected three composed video items: ${session.compositionError ?? 'no composition output'}; ` +
        `events=${session.events.map(event => `${event.type}:${JSON.stringify(event.metadata ?? {})}`).join(',')}`,
      );
    }
    const videoStartEvents = session.events.filter(event => event.type === 'video.started');
    for (const decision of session.composition.decisions) {
      const start = videoStartEvents.find(event =>
        event.metadata?.['videoId'] === decision.videoId);
      if (!start || start.relativeTimeMs !== decision.outputStartMs) {
        throw new Error(
          `Video composition did not use its mapped runtime event: ${decision.videoId} ` +
          `event=${start?.relativeTimeMs}, output=${decision.outputStartMs}`,
        );
      }
    }
    const narrationEvents = session.events.filter(
      event => event.type === 'narration.cue.started',
    );
    const revealToNarrationGapsMs: number[] = [];
    for (const cue of narrationEvents) {
      const slide = parsed.deck.slides[cue.slideIndex];
      const visible = session.events.find(event =>
        event.slideIndex === cue.slideIndex &&
        event.type === (slide.video ? 'video.started' : 'slide.entered') &&
        event.relativeTimeMs <= cue.relativeTimeMs);
      if (!visible) {
        throw new Error(
          `Narration cue ${String(cue.metadata?.['cueIndex'])} started before item ` +
          `${cue.slideIndex + 1} was visible`,
        );
      }
      const cuesOnSlide = setup.cues.filter(item => item.slideIndex === cue.slideIndex);
      const fragmentEvents = session.events.filter(event =>
        event.type === 'fragment.revealed' && event.slideIndex === cue.slideIndex);
      if (!slide.video && cuesOnSlide.length === 1 && fragmentEvents.length > 0) {
        const finalRevealMs = Math.max(...fragmentEvents.map(event => event.relativeTimeMs));
        const revealToNarrationMs = cue.relativeTimeMs - finalRevealMs;
        revealToNarrationGapsMs.push(revealToNarrationMs);
        if (revealToNarrationMs < 0 || revealToNarrationMs > 250) {
          throw new Error(
            `Narration cue ${String(cue.metadata?.['cueIndex'])} started ` +
            `${revealToNarrationMs}ms after final content reveal`,
          );
        }
      }
    }
    const resolvedRecorderCommand = session.recorder.startCommand ?? '';
    const captureSize = resolvedRecorderCommand.match(/-video_size (\d+)x(\d+)/);
    if (process.platform === 'win32' && !captureSize) {
      throw new Error(`Recorder command did not resolve window bounds: ${resolvedRecorderCommand}`);
    }
    const serializer = new RecordingSerializer();
    const scriptGenerator = new VoiceOverScriptGenerator();
    const captionGenerator = new CaptionsScaffoldGenerator();
    const sessionDirectory = session.outputDirectory;
    if (!sessionDirectory || !sessionDirectory.startsWith(outputRoot)) {
      throw new Error(`Recording did not resolve a session output directory: ${sessionDirectory}`);
    }
    const sessionFiles = await serializer.exportSession(session, sessionDirectory);
    const scriptFiles = await scriptGenerator.exportScripts(session, sessionDirectory);
    const videoBasename = path.basename(videoPath, path.extname(videoPath));
    const sessionProject = await stageNarrationProjectForSession(
      narrationProject,
      sessionDirectory,
      captionGenerator.generateSrt(session),
      videoBasename,
    );
    const srtPath = sessionProject.srtPath;
    for (const artifact of [
      videoPath,
      srtPath,
      sessionProject.projectPath,
      ...sessionFiles,
      ...scriptFiles,
    ]) {
      if (path.dirname(artifact) !== sessionDirectory) {
        throw new Error(`Artifact was written outside the session directory: ${artifact}`);
      }
    }

    await fs.promises.access(videoPath);
    await fs.promises.access(srtPath);
    const srt = await fs.promises.readFile(srtPath, 'utf8');
    const captionCount = (srt.match(/^\d+$/gm) ?? []).length;
    if (captionCount !== 8) {
      throw new Error(`Expected 8 SRT entries, exported ${captionCount}`);
    }
    await resyncNarrationProject(srtPath, fixtureRoot);
    const finalVideoPath = await assembleNarrationProject(srtPath, videoPath, fixtureRoot);
    await fs.promises.access(finalVideoPath);

    if (conductor.isRecording() || conductor.isAutoPilotActive()) {
      throw new Error('First Auto-Record left the conductor busy');
    }
    const repeatSetup = conductor.createNarrationSetup();
    if (!repeatSetup) {
      throw new Error('Could not create output layout for repeated Auto-Record');
    }
    const repeatSession = await conductor.autoRecord(
      narrationTimings,
      repeatSetup.outputDirectory,
    );
    if (!repeatSession?.recorder?.stopped || conductor.isRecording() || conductor.isAutoPilotActive()) {
      throw new Error(
        `Repeated Auto-Record did not finish cleanly: ${JSON.stringify(repeatSession?.recorder)}`,
      );
    }
    if (repeatSession.outputDirectory === session.outputDirectory) {
      throw new Error('Repeated Auto-Record reused the first session directory');
    }

    await fs.promises.writeFile(resultPath, JSON.stringify({
      fixtureRoot,
      outputRoot,
      sessionDirectory,
      videoPath,
      capturePath,
      srtPath,
      finalVideoPath,
      resolvedRecorderCommand,
      captureWidth: captureSize ? Number(captureSize[1]) : undefined,
      captureHeight: captureSize ? Number(captureSize[2]) : undefined,
      narrationProcessId,
      narrationTimings,
      captionCount,
      narrationSegments: session.segments
        .filter(segment => segment.cueText)
        .map(segment => ({
          text: segment.cueText,
          startTimeMs: segment.startTimeMs,
          endTimeMs: segment.endTimeMs,
          durationMs: segment.durationMs,
        })),
      sessionStoppedMs: session.events.find(event => event.type === 'session.stopped')?.relativeTimeMs,
      segmentCount: session.segments.length,
      eventCount: session.events.length,
      compositionDecisionCount: session.composition.decisions.length,
      compositionDecisions: session.composition.decisions,
      runtimeVideoStarts: videoStartEvents.map(event => event.relativeTimeMs),
      outputDurationMs: session.durationMs,
      firstNarrationStartMs: narrationEvents[0]?.relativeTimeMs,
      revealToNarrationGapsMs,
      repeatSessionDirectory: repeatSession.outputDirectory,
      firstVideoGeometry: session.events.find(event => event.type === 'video.started')?.metadata,
    }, null, 2));
  } finally {
    await conductor.close();
    conductor.dispose();
  }
}