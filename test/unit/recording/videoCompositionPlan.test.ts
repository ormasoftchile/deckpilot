import { expect } from 'chai';
import { RecordingEvent, RecordingSession } from '../../../packages/core/src/models/recording';
import {
  alignRecordingSessionToCapture,
  buildVideoCompositionPlan,
} from '../../../packages/extension/src/recording/videoCompositionPlan';

function event(
  type: RecordingEvent['type'],
  relativeTimeMs: number,
  metadata: Record<string, unknown> = {},
): RecordingEvent {
  return {
    id: `${type}-${relativeTimeMs}`,
    type,
    timestamp: 1000 + relativeTimeMs,
    relativeTimeMs,
    slideIndex: 1,
    metadata,
  };
}

describe('buildVideoCompositionPlan', () => {
  it('aligns the event clock to authoritative captured media duration', () => {
    const session: RecordingSession = {
      sessionId: 'session',
      deckPath: '/deck.md',
      recordingStartTime: 1000,
      recordingEndTime: 19500,
      durationMs: 18500,
      events: [
        event('session.started', 0),
        event('fragment.revealed', 500),
        { ...event('narration.cue.started', 1500), metadata: { cueIndex: 1 } },
        event('slide.entered', 1900),
        event('video.started', 7000),
        event('session.stopped', 18500),
      ],
      segments: [],
      ignoredIntervals: [{ startTimeMs: 4000, endTimeMs: 5000 }],
      manualMarkers: [{ id: 'm', type: 'narration', relativeTimeMs: 6000, slideIndex: 0 }],
      exportMetadata: { generatedAt: 0, extensionVersion: '', platform: 'test', exportFormats: [] },
    };

    const offset = alignRecordingSessionToCapture(session, 17600);

    expect(offset).to.equal(900);
    expect(session.recordingStartTime).to.equal(1900);
    expect(session.durationMs).to.equal(17600);
    expect(session.events.map(item => item.relativeTimeMs)).to.deep.equal([0, 600, 1000, 6100, 17600]);
    expect(session.events.some(item => item.type === 'fragment.revealed')).to.equal(false);
    expect(session.ignoredIntervals[0]).to.deep.include({ startTimeMs: 3100, endTimeMs: 4100 });
    expect(session.manualMarkers[0].relativeTimeMs).to.equal(5100);
  });

  it('replaces a captured interval and remaps later timestamps', () => {
    const events = [
      event('session.started', 0),
      event('video.started', 5000, { videoId: 'demo', src: './clips/demo.mp4', trimStartMs: 1000, trimEndMs: 5000, audio: 'duck' }),
      event('video.ended', 9500, { videoId: 'demo' }),
      event('session.stopped', 15000),
    ];

    const plan = buildVideoCompositionPlan(events, 15000, new Map([['demo', 8000]]));

    expect(plan.decisions).to.have.length(1);
    expect(plan.decisions[0]).to.deep.include({
      videoId: 'demo',
      captureStartMs: 5000,
      captureEndMs: 9500,
      sourceStartMs: 1000,
      sourceEndMs: 5000,
      outputStartMs: 5000,
      outputEndMs: 9000,
      audio: 'duck',
    });
    expect(plan.outputDurationMs).to.equal(14500);
    expect(plan.mapTime(12000)).to.equal(11500);
  });

  it('uses source duration when no trim end is authored', () => {
    const events = [
      event('video.started', 1000, { videoId: 'demo', src: './demo.mp4', trimStartMs: 2000, audio: 'mute' }),
      event('video.ended', 3000, { videoId: 'demo' }),
    ];

    const plan = buildVideoCompositionPlan(events, 5000, new Map([['demo', 7000]]));

    expect(plan.decisions[0].sourceEndMs).to.equal(7000);
    expect(plan.decisions[0].outputEndMs).to.equal(6000);
    expect(plan.outputDurationMs).to.equal(8000);
  });

  it('places a clip from its actual capture event timing', () => {
    const events = [
      event('video.started', 5400, {
        videoId: 'demo',
        src: './demo.mp4',
        plannedStartMs: 5273,
      }),
      event('video.ended', 9400, { videoId: 'demo' }),
    ];

    const plan = buildVideoCompositionPlan(
      events,
      12000,
      new Map([['demo', 4000]]),
    );

    expect(plan.decisions[0].captureStartMs).to.equal(5400);
    expect(plan.decisions[0].outputStartMs).to.equal(5400);
    expect(plan.decisions[0].outputEndMs).to.equal(9400);
    expect(plan.outputDurationMs).to.equal(12000);
    expect(plan.mapTime(5400)).to.equal(5400);
    expect(plan.mapTime(12000)).to.equal(12000);
  });
});