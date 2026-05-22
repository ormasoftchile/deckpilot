/**
 * Unit tests for BrowserPanelContent.getHtmlContent
 *
 * Verifies HTML structure, CSP, nonce consistency, iframe src, and empty-state behaviour.
 * All assertions are string-based — no DOM parser required.
 */

import { expect } from 'chai';
import { BrowserPanelContent } from '../../../packages/extension/src/browser/BrowserPanelContent';

// Minimal webview mock — only cspSource is read by getHtmlContent.
const mockWebview = { cspSource: 'https://vscode-resource.vscode-cdn.net' } as Parameters<
  typeof BrowserPanelContent.getHtmlContent
>[0];

describe('BrowserPanelContent.getHtmlContent', () => {
  describe('well-formed document structure', () => {
    it('contains <!DOCTYPE html>', () => {
      const html = BrowserPanelContent.getHtmlContent(mockWebview, 'https://example.com');
      expect(html).to.include('<!DOCTYPE html>');
    });

    it('contains <html', () => {
      const html = BrowserPanelContent.getHtmlContent(mockWebview, 'https://example.com');
      expect(html).to.include('<html');
    });

    it('contains <head>', () => {
      const html = BrowserPanelContent.getHtmlContent(mockWebview, 'https://example.com');
      expect(html).to.include('<head>');
    });

    it('contains <body>', () => {
      const html = BrowserPanelContent.getHtmlContent(mockWebview, 'https://example.com');
      expect(html).to.include('<body>');
    });
  });

  describe('Content-Security-Policy', () => {
    it('has a Content-Security-Policy meta tag', () => {
      const html = BrowserPanelContent.getHtmlContent(mockWebview, 'https://example.com');
      expect(html).to.include('Content-Security-Policy');
    });

    it('CSP contains frame-src *', () => {
      const html = BrowserPanelContent.getHtmlContent(mockWebview, 'https://example.com');
      expect(html).to.include('frame-src *');
    });
  });

  describe('nonce consistency', () => {
    it('nonce in CSP script-src matches nonce attribute on the <script> tag', () => {
      const html = BrowserPanelContent.getHtmlContent(mockWebview, 'https://example.com');

      const cspNonceMatch = html.match(/script-src 'nonce-([A-Za-z0-9]+)'/);
      expect(cspNonceMatch, 'nonce in CSP').to.not.be.null;
      const nonce = cspNonceMatch![1];

      expect(html).to.include(`<script nonce="${nonce}">`);
    });

    it('generates a different nonce on each call (randomness)', () => {
      const html1 = BrowserPanelContent.getHtmlContent(mockWebview, 'https://example.com');
      const html2 = BrowserPanelContent.getHtmlContent(mockWebview, 'https://example.com');

      const nonce1 = html1.match(/script-src 'nonce-([A-Za-z0-9]+)'/)![1];
      const nonce2 = html2.match(/script-src 'nonce-([A-Za-z0-9]+)'/)![1];

      // Statistically impossible for two 32-char random nonces to match
      expect(nonce1).to.not.equal(nonce2);
    });
  });

  describe('iframe src attribute', () => {
    it('iframe src matches the given initialUrl', () => {
      const html = BrowserPanelContent.getHtmlContent(mockWebview, 'https://example.com');
      expect(html).to.include('src="https://example.com"');
    });

    it('iframe src is empty string when initialUrl is empty', () => {
      const html = BrowserPanelContent.getHtmlContent(mockWebview, '');
      // The iframe tag should carry src=""
      expect(html).to.include('src=""');
    });

    it('iframe src is empty string when no initialUrl argument is provided', () => {
      const html = BrowserPanelContent.getHtmlContent(mockWebview);
      expect(html).to.include('src=""');
    });
  });

  describe('#empty-state visibility', () => {
    it('#empty-state does NOT have the hidden class when initialUrl is empty', () => {
      const html = BrowserPanelContent.getHtmlContent(mockWebview, '');
      // Expect class="" (empty string) on the empty-state div
      expect(html).to.match(/id="empty-state" class=""/);
    });

    it('#empty-state has the hidden class when initialUrl is provided', () => {
      const html = BrowserPanelContent.getHtmlContent(mockWebview, 'https://example.com');
      expect(html).to.include('id="empty-state" class="hidden"');
    });
  });
});
