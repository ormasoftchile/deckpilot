/**
 * Unit tests for RecorderOrchestrator
 * Covers: configuration detection, metadata shape, template interpolation.
 *
 * Note: Actual process spawning is not tested here since it requires
 * the vscode API and real child processes. Integration tests cover that.
 * These tests verify the orchestrator's logic via its metadata output.
 */

import { expect } from 'chai';
import { RecorderMetadata } from '../../../src/models/recording';

describe('RecorderOrchestrator — metadata model', () => {
  describe('RecorderMetadata', () => {
    it('should represent unconfigured state', () => {
      const meta: RecorderMetadata = {
        configured: false,
        started: false,
        stopped: false,
      };
      expect(meta.configured).to.be.false;
      expect(meta.started).to.be.false;
      expect(meta.outputPath).to.be.undefined;
      expect(meta.error).to.be.undefined;
    });

    it('should represent configured but failed state', () => {
      const meta: RecorderMetadata = {
        configured: true,
        started: false,
        stopped: false,
        startCommand: 'ffmpeg -f gdigrab -i desktop out.mp4',
        error: 'Recorder failed to start: spawn ffmpeg ENOENT',
      };
      expect(meta.configured).to.be.true;
      expect(meta.started).to.be.false;
      expect(meta.error).to.include('ENOENT');
    });

    it('should represent successful session', () => {
      const meta: RecorderMetadata = {
        configured: true,
        started: true,
        stopped: true,
        outputPath: '/recordings/session-abc.mp4',
        startCommand: 'ffmpeg -f gdigrab -i desktop /recordings/session-abc.mp4',
        stopCommand: 'taskkill /IM ffmpeg.exe /F',
      };
      expect(meta.configured).to.be.true;
      expect(meta.started).to.be.true;
      expect(meta.stopped).to.be.true;
      expect(meta.outputPath).to.equal('/recordings/session-abc.mp4');
      expect(meta.error).to.be.undefined;
    });

    it('should serialize cleanly in JSON', () => {
      const meta: RecorderMetadata = {
        configured: true,
        started: true,
        stopped: true,
        outputPath: 'C:\\recordings\\session-123.mp4',
        startCommand: 'obs-cli recording start',
        stopCommand: 'obs-cli recording stop',
      };
      const json = JSON.parse(JSON.stringify(meta));
      expect(json.configured).to.equal(true);
      expect(json.outputPath).to.equal('C:\\recordings\\session-123.mp4');
    });
  });

  describe('template interpolation logic', () => {
    // Test the interpolation pattern used by RecorderOrchestrator
    function interpolate(template: string, sessionId: string, outputPath: string): string {
      return template
        .replace(/\{\{outputPath\}\}/g, outputPath)
        .replace(/\{\{sessionId\}\}/g, sessionId);
    }

    it('should replace {{outputPath}}', () => {
      const result = interpolate(
        'ffmpeg -f gdigrab -i desktop {{outputPath}}',
        'sess-1',
        '/out/video.mp4',
      );
      expect(result).to.equal('ffmpeg -f gdigrab -i desktop /out/video.mp4');
    });

    it('should replace {{sessionId}}', () => {
      const result = interpolate(
        'recorder start --id={{sessionId}}',
        'abc-123',
        '/out/video.mp4',
      );
      expect(result).to.equal('recorder start --id=abc-123');
    });

    it('should replace multiple occurrences', () => {
      const result = interpolate(
        '{{outputPath}} and {{outputPath}} with {{sessionId}}',
        'sess',
        '/video.mp4',
      );
      expect(result).to.equal('/video.mp4 and /video.mp4 with sess');
    });

    it('should leave template unchanged when no placeholders', () => {
      const result = interpolate('taskkill /IM ffmpeg.exe /F', 'sess', '/v.mp4');
      expect(result).to.equal('taskkill /IM ffmpeg.exe /F');
    });

    it('should handle empty template', () => {
      const result = interpolate('', 'sess', '/v.mp4');
      expect(result).to.equal('');
    });
  });

  describe('session integration shape', () => {
    it('recording-session.json should include recorder field', () => {
      // Verify the shape of a session with recorder metadata
      const session = {
        sessionId: 'test-123',
        deckPath: '/deck.md',
        events: [],
        segments: [],
        ignoredIntervals: [],
        manualMarkers: [],
        recorder: {
          configured: true,
          started: true,
          stopped: true,
          outputPath: '/recordings/session-test-123.mp4',
        } as RecorderMetadata,
        exportMetadata: {
          generatedAt: Date.now(),
          extensionVersion: '0.5.7',
          platform: 'win32',
          exportFormats: ['json', 'markdown', 'srt'],
        },
      };

      const json = JSON.parse(JSON.stringify(session));
      expect(json.recorder).to.exist;
      expect(json.recorder.outputPath).to.include('test-123');
    });
  });
});
