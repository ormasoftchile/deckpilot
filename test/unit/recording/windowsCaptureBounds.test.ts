import { expect } from 'chai';
import {
  buildWindowsBoundsScript,
  parseWindowsBounds,
  resolveWindowPlaceholders,
} from '../../../packages/extension/src/recording/windowsCaptureBounds';

describe('Windows capture bounds', () => {
  it('queries physical DWM bounds in a per-monitor-aware thread', () => {
    const script = buildWindowsBoundsScript();

    expect(script).to.include('SetThreadDpiAwarenessContext');
    expect(script).to.include('DwmGetWindowAttribute');
    expect(script).to.include('DWMWA_EXTENDED_FRAME_BOUNDS');
    expect(script).to.include('SM_XVIRTUALSCREEN');
    expect(script).to.include('SM_CXVIRTUALSCREEN');
  });

  it('parses physical bounds with negative multi-monitor coordinates', () => {
    expect(parseWindowsBounds('-1920,40,1600,1000')).to.deep.equal({
      x: -1920,
      y: 40,
      width: 1600,
      height: 1000,
    });
  });

  it('resolves all window placeholders from physical bounds', () => {
    const command = resolveWindowPlaceholders(
      '-offset_x {{windowX}} -offset_y {{windowY}} -video_size {{windowWidth}}x{{windowHeight}}',
      { x: -1920, y: 40, width: 1600, height: 1000 },
    );

    expect(command).to.equal('-offset_x -1920 -offset_y 40 -video_size 1600x1000');
  });

  it('refuses to fall back to a desktop region when bounds are unavailable', () => {
    expect(() => resolveWindowPlaceholders('-i desktop {{windowWidth}}', undefined))
      .to.throw('physical foreground window bounds');
  });
});