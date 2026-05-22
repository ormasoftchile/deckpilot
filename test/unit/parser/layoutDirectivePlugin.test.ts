import { expect } from 'chai';
import { processLayoutComments } from '../../../packages/core/src/parser/layoutCommentProcessor';

describe('Layout Comment Processor', () => {
  describe('processLayoutComments', () => {
    it('should transform <!-- center --> block', () => {
      const html = '<!-- center -->\n<p>Big idea</p>\n<!-- /center -->';
      const result = processLayoutComments(html);
      expect(result).to.contain('<div class="layout-center">');
      expect(result).to.contain('Big idea');
      expect(result).to.contain('</div>');
      expect(result).not.to.contain('<!-- center -->');
    });

    it('should transform <!-- columns --> with <!-- left --> and <!-- right -->', () => {
      const html = '<!-- columns -->\n<!-- left -->\n<p>Text</p>\n<!-- /left -->\n<!-- right -->\n<p>Code</p>\n<!-- /right -->\n<!-- /columns -->';
      const result = processLayoutComments(html);
      expect(result).to.contain('<div class="layout-columns">');
      expect(result).to.contain('<div class="layout-left">');
      expect(result).to.contain('<div class="layout-right">');
      expect(result).to.contain('Text');
      expect(result).to.contain('Code');
    });

    it('should pass through HTML with no markers', () => {
      const html = '<h1>Hello</h1>\n<p>Some text</p>';
      const result = processLayoutComments(html);
      expect(result).to.equal(html);
    });

    it('should transform <!-- group --> block', () => {
      const html = '<!-- group -->\n<p>First</p>\n<p>Second</p>\n<!-- /group -->';
      const result = processLayoutComments(html);
      expect(result).to.contain('<div class="slide-group">');
      expect(result).to.contain('</div>');
    });

    it('should transform <!-- advanced --> into details/summary', () => {
      const html = '<!-- advanced -->\n<p>Deep dive</p>\n<!-- /advanced -->';
      const result = processLayoutComments(html);
      expect(result).to.contain('<details class="disclosure-advanced">');
      expect(result).to.contain('<summary>Advanced</summary>');
      expect(result).to.contain('</details>');
      expect(result).to.contain('Deep dive');
    });

    it('should transform <!-- optional --> with badge', () => {
      const html = '<!-- optional -->\n<p>Optional step</p>\n<!-- /optional -->';
      const result = processLayoutComments(html);
      expect(result).to.contain('<div class="step-optional">');
      expect(result).to.contain('<span class="optional-badge">Optional</span>');
      expect(result).to.contain('Optional step');
      expect(result).to.contain('</div>');
    });

    it('should handle nested directives', () => {
      const html = '<!-- columns -->\n<!-- left -->\n<p>Left</p>\n<!-- /left -->\n<!-- right -->\n<!-- advanced -->\n<p>Details</p>\n<!-- /advanced -->\n<!-- /right -->\n<!-- /columns -->';
      const result = processLayoutComments(html);
      expect(result).to.contain('<div class="layout-columns">');
      expect(result).to.contain('<details class="disclosure-advanced">');
      expect(result).to.contain('</details>');
      expect(result).to.contain('</div>');
    });

    it('should tolerate extra whitespace in comment markers', () => {
      const html = '<!--  center  -->\n<p>Text</p>\n<!--  /center  -->';
      const result = processLayoutComments(html);
      expect(result).to.contain('<div class="layout-center">');
      expect(result).to.contain('</div>');
    });
  });
});
