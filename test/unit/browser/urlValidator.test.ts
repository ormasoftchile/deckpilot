/**
 * Unit tests for isAllowedUrl — URL allowlist for the browser panel.
 */

import { expect } from 'chai';
import { isAllowedUrl } from '../../../src/browser/urlValidator';

describe('isAllowedUrl', () => {
  describe('allowed URLs', () => {
    it('allows https://example.com', () => {
      expect(isAllowedUrl('https://example.com')).to.equal(true);
    });

    it('allows https:// with path and query params', () => {
      expect(isAllowedUrl('https://api.myapp.com/docs?q=foo')).to.equal(true);
    });

    it('allows http://localhost:3000', () => {
      expect(isAllowedUrl('http://localhost:3000')).to.equal(true);
    });

    it('allows http://localhost (no port)', () => {
      expect(isAllowedUrl('http://localhost')).to.equal(true);
    });

    it('allows http://127.0.0.1:8080', () => {
      expect(isAllowedUrl('http://127.0.0.1:8080')).to.equal(true);
    });

    it('allows http://127.0.0.1 (no port)', () => {
      expect(isAllowedUrl('http://127.0.0.1')).to.equal(true);
    });
  });

  describe('blocked URLs', () => {
    it('blocks http://example.com (non-localhost HTTP)', () => {
      expect(isAllowedUrl('http://example.com')).to.equal(false);
    });

    it('blocks javascript: scheme', () => {
      expect(isAllowedUrl('javascript:alert(1)')).to.equal(false);
    });

    it('blocks file: scheme', () => {
      expect(isAllowedUrl('file:///etc/passwd')).to.equal(false);
    });

    it('blocks data: scheme', () => {
      expect(isAllowedUrl('data:text/html,<h1>')).to.equal(false);
    });

    it('blocks empty string', () => {
      expect(isAllowedUrl('')).to.equal(false);
    });

    it('blocks ftp: scheme', () => {
      expect(isAllowedUrl('ftp://example.com')).to.equal(false);
    });

    it('blocks malformed URL (no scheme)', () => {
      expect(isAllowedUrl('not-a-url')).to.equal(false);
    });
  });
});
