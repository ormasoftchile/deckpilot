/**
 * Snapshot tests for SRT caption generation against example decks.
 *
 * Strategy:
 *  1. Parse each examples/*.deck.md with parseDeck()
 *  2. Build an auto-pilot plan to determine timing
 *  3. Synthesise a RecordingEvent stream by walking the plan steps
 *  4. Build segments + generate SRT with the same helpers used at runtime
 *  5. On first run (UPDATE_SNAPSHOTS=1 or no snapshot on disk) write the
 *     snapshot; on subsequent runs diff against the stored file.
 *
 * Run once to seed:
 *   UPDATE_SNAPSHOTS=1 npm run test:unit -- --grep "SRT Snapshots"
 *
 * Then on every CI run:
 *   npm run test:unit -- --grep "SRT Snapshots"
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { parseDeck } from '../../../src/parser/deckParser';
import { buildAutoPilotPlan } from '../../../src/recording/autoPilot';
import { buildSegments } from '../../../src/recording/segmentBuilder';
import { parseCues } from '../../../src/recording/cueParser';
import { CaptionsScaffoldGenerator } from '../../../src/recording/captionsScaffoldGenerator';
import { RecordingEvent, RecordingSession } from '../../../src/models/recording';

// ─── Paths ──────────────────────────────────────────────────────────────────

const EXAMPLES_DIR = path.resolve(__dirname, '../../../examples');
const SNAPSHOTS_DIR = path.resolve(__dirname, '../../fixtures/srt-snapshots');
const UPDATE = process.env['UPDATE_SNAPSHOTS'] === '1';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Walk an auto-pilot plan and produce a minimal RecordingEvent stream.
 * Each step advances a fake clock by the step's durationMs so that
 * segment durations match what the runtime would produce for the same plan.
 */
function synthesiseEvents(
  plan: ReturnType<typeof buildAutoPilotPlan>,
): RecordingEvent[] {
  const events: RecordingEvent[] = [];
  let clock = 0;
  let eventId = 0;

  const push = (type: RecordingEvent['type'], slideIndex: number, extra?: Partial<RecordingEvent>) => {
    events.push({
      id: `synth-${++eventId}`,
      type,
      timestamp: 1_000_000 + clock,
      relativeTimeMs: clock,
      slideIndex,
      ...extra,
    });
  };

  let currentSlide = -1;

  for (const step of plan) {
    if (step.type === 'advance') {
      if (step.fragmentIndex !== undefined) {
        // Fragment advance — emit fragment.revealed
        push('fragment.revealed', step.slideIndex, { fragmentIndex: step.fragmentIndex });
      } else {
        // Slide advance — close previous slide, open new one
        if (currentSlide >= 0) {
          push('slide.exited', currentSlide);
        }
        push('slide.entered', step.slideIndex);
        currentSlide = step.slideIndex;
      }
    }

    if (step.type === 'wait' && currentSlide === -1) {
      // Initial wait before first slide
      push('slide.entered', step.slideIndex);
      currentSlide = step.slideIndex;
    }

    clock += step.durationMs;
  }

  // Close final slide
  if (currentSlide >= 0) {
    push('slide.exited', currentSlide);
  }

  return events;
}

function buildSrtForDeck(deckPath: string): string {
  const content = fs.readFileSync(deckPath, 'utf8');
  const result = parseDeck(content, deckPath);
  if (!result.deck) {
    throw new Error(`Failed to parse ${path.basename(deckPath)}: ${result.error}`);
  }

  const { deck } = result;
  const plan = buildAutoPilotPlan(deck.slides);
  const events = synthesiseEvents(plan);
  const cues = parseCues(deck.slides);
  const segments = buildSegments(events, cues, deck.slides);

  const session: RecordingSession = {
    sessionId: 'snapshot-test',
    deckPath,
    deckTitle: deck.metadata.title ?? path.basename(deckPath, '.deck.md'),
    recordingStartTime: 1_000_000,
    recordingEndTime: 1_000_000 + (events[events.length - 1]?.relativeTimeMs ?? 0),
    durationMs: events[events.length - 1]?.relativeTimeMs ?? 0,
    events,
    segments,
    ignoredIntervals: [],
    manualMarkers: [],
    exportMetadata: {
      generatedAt: 0,  // deterministic
      extensionVersion: 'snapshot-test',
      platform: 'test',
      exportFormats: ['srt'],
    },
  };

  const generator = new CaptionsScaffoldGenerator();
  return generator.generateSrt(session);
}

// ─── Test suite ─────────────────────────────────────────────────────────────

describe('SRT Snapshots', () => {
  before(() => {
    if (!fs.existsSync(SNAPSHOTS_DIR)) {
      fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    }
  });

  const deckFiles = fs
    .readdirSync(EXAMPLES_DIR)
    .filter(f => f.endsWith('.deck.md'))
    .sort();

  for (const filename of deckFiles) {
    const deckName = filename.replace('.deck.md', '');
    const deckPath = path.join(EXAMPLES_DIR, filename);
    const snapshotPath = path.join(SNAPSHOTS_DIR, `${deckName}.srt`);

    it(`matches snapshot for ${deckName}`, () => {
      const actual = buildSrtForDeck(deckPath);

      if (UPDATE || !fs.existsSync(snapshotPath)) {
        fs.writeFileSync(snapshotPath, actual, 'utf8');
        // Not a failure — snapshot was written / updated
        return;
      }

      const expected = fs.readFileSync(snapshotPath, 'utf8');
      expect(actual).to.equal(
        expected,
        `SRT output for "${deckName}" has changed. ` +
        `Run with UPDATE_SNAPSHOTS=1 to accept the new output.`,
      );
    });
  }
});
