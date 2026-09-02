import { expect } from 'chai';
import { RecordingEvent } from '../../../packages/core/src/models/recording';
import { buildVideoCompositionPlan } from '../../../packages/extension/src/recording/videoCompositionPlan';

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
});