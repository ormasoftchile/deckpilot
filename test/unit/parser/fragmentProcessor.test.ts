import { expect } from 'chai';
import { processFragments } from '../../../packages/core/src/parser/fragmentProcessor';

function countOccurrences(str: string, sub: string): number {
  return str.split(sub).length - 1;
}

describe('processFragments', () => {
  it('auto-fragments standard markdown blocks in document order', () => {
    const { html, fragmentCount } = processFragments('<h1>Title</h1><h2>Section</h2><p>Body</p>');
    expect(fragmentCount).to.equal(3);
    expect(html).to.contain('<h1 class="fragment" data-fragment="1" data-fragment-animation="fade">Title</h1>');
    expect(html).to.contain('<h2 class="fragment" data-fragment="2" data-fragment-animation="fade">Section</h2>');
    expect(html).to.contain('<p class="fragment" data-fragment="3" data-fragment-animation="fade">Body</p>');
  });

  it('auto-fragments list containers as a single step', () => {
    const { html, fragmentCount } = processFragments('<ul><li>A</li><li>B</li></ul>');
    expect(fragmentCount).to.equal(1);
    expect(html).to.contain('<ul class="fragment" data-fragment="1" data-fragment-animation="fade">');
    expect(html).to.not.match(/<li[^>]*class="fragment"/);
  });

  it('fragments each list item when the list has <!-- .fragment-each -->', () => {
    const { html, fragmentCount } = processFragments(
      '<ul><li>A <!-- .fragment-each --></li><li>B</li><li>C</li></ul>',
    );
    expect(fragmentCount).to.equal(3);
    // the list itself is NOT a fragment
    expect(html).to.not.match(/<ul[^>]*class="fragment"/);
    expect(html).to.contain('<li class="fragment" data-fragment="1" data-fragment-animation="fade">A</li>');
    expect(html).to.contain('<li class="fragment" data-fragment="2" data-fragment-animation="fade">B</li>');
    expect(html).to.contain('<li class="fragment" data-fragment="3" data-fragment-animation="fade">C</li>');
    // the marker comment is consumed
    expect(html).to.not.contain('.fragment-each');
  });

  it('honors a custom animation on .fragment-each', () => {
    const { html } = processFragments(
      '<ul><li>A <!-- .fragment-each slide-up --></li><li>B</li></ul>',
    );
    expect(html).to.contain('data-fragment-animation="slide-up"');
  });

  it('fragments only the items marked with <!-- .fragment -->', () => {
    const { html, fragmentCount } = processFragments(
      '<ul><li>A <!-- .fragment --></li><li>B <!-- .fragment --></li><li>C</li></ul>',
    );
    expect(fragmentCount).to.equal(2);
    expect(html).to.not.match(/<ul[^>]*class="fragment"/);
    expect(html).to.match(/<li class="fragment"[^>]*>A\s*<\/li>/);
    expect(html).to.match(/<li class="fragment"[^>]*>B\s*<\/li>/);
    expect(html).to.contain('<li>C</li>');
  });

  it('numbers list-item fragments in document order after a heading', () => {
    const { html, fragmentCount } = processFragments(
      '<h2>Title</h2><ul><li>A<!-- .fragment-each --></li><li>B</li></ul>',
    );
    expect(fragmentCount).to.equal(3);
    expect(html).to.contain('<h2 class="fragment" data-fragment="1"');
    expect(html).to.contain('<li class="fragment" data-fragment="2" data-fragment-animation="fade">A</li>');
    expect(html).to.contain('<li class="fragment" data-fragment="3" data-fragment-animation="fade">B</li>');
  });

  it('preserves explicit fragment animation names', () => {
    const { html } = processFragments('<p>Body <!-- .fragment slide-up --></p>');
    expect(html).to.contain('data-fragment-animation="slide-up"');
  });

  it('does not fragment data-no-fragment elements even when surrounding blocks auto-fragment', () => {
    const { html, fragmentCount } = processFragments('<p data-no-fragment>Body</p><p>Next</p>');
    expect(fragmentCount).to.equal(1);
    expect(html).to.contain('<p data-no-fragment>Body</p>');
    expect(html).to.contain('<p class="fragment" data-fragment="1" data-fragment-animation="fade">Next</p>');
  });

  it('treats slide-group as one fragment unit and continues numbering after it', () => {
    const html = [
      '<div class="slide-group">',
      '<ul><li>A</li><li>B</li></ul>',
      '</div>',
      '<p>Visible after group</p>',
    ].join('\n');
    const { html: out, fragmentCount } = processFragments(html);
    expect(fragmentCount).to.equal(2);
    expect(out).to.contain('class="slide-group fragment" data-fragment="1"');
    expect(out).to.not.match(/<ul[^>]*class="fragment"/);
    expect(out).to.contain('<p class="fragment" data-fragment="2" data-fragment-animation="fade">Visible after group</p>');
  });

  it('merges fragment into existing slide-group class attribute once', () => {
    const { html } = processFragments('<div class="slide-group"><p>Body</p></div>');
    const openTag = html.match(/<div[^>]*>/)?.[0] ?? '';
    expect(countOccurrences(openTag, 'class=')).to.equal(1);
    expect(openTag).to.contain('slide-group fragment');
  });

  it('treats advanced details blocks as one fragment unit', () => {
    const html = '<details class="disclosure-advanced"><summary>Advanced</summary><p>Inner</p></details>';
    const { html: out, fragmentCount } = processFragments(html);
    expect(fragmentCount).to.equal(1);
    expect(out).to.contain('<details class="disclosure-advanced fragment"');
    expect(out).to.contain('<p>Inner</p>');
    expect(out).to.not.contain('<p class="fragment"');
  });

  it('treats optional blocks as one fragment unit', () => {
    const html = '<div class="step-optional"><span class="optional-badge">Optional</span><p>Run lint</p></div>';
    const { html: out, fragmentCount } = processFragments(html);
    expect(fragmentCount).to.equal(1);
    expect(out).to.contain('class="step-optional fragment"');
    expect(out).to.not.contain('<p class="fragment"');
  });

  it('auto-fragments diagram placeholders in natural document order', () => {
    const html = [
      '<h1>Title</h1>',
      '<figure class="diagram-block diagram-block--loading" data-render-id="diagram-0-0"></figure>',
      '<p>Body</p>',
    ].join('\n');
    const { html: out, fragmentCount } = processFragments(html);
    expect(fragmentCount).to.equal(3);
    expect(out).to.contain('<h1 class="fragment" data-fragment="1" data-fragment-animation="fade">Title</h1>');
    expect(out).to.contain('<figure class="diagram-block diagram-block--loading fragment" data-render-id="diagram-0-0" data-fragment="2" data-fragment-animation="fade"></figure>');
    expect(out).to.contain('<p class="fragment" data-fragment="3" data-fragment-animation="fade">Body</p>');
  });

  it('assigns fragments in document order around wrapper fragments', () => {
    const html = [
      '<p>Intro</p>',
      '<details class="disclosure-advanced"><summary>Advanced</summary><p>Inner</p></details>',
      '<p>Outro <!-- .fragment zoom --></p>',
    ].join('\n');
    const { html: out, fragmentCount } = processFragments(html);
    expect(fragmentCount).to.equal(3);
    expect(out).to.contain('<p class="fragment" data-fragment="1" data-fragment-animation="fade">Intro</p>');
    expect(out).to.contain('<details class="disclosure-advanced fragment" data-fragment="2" data-fragment-animation="fade"');
    expect(out).to.contain('<p class="fragment" data-fragment="3" data-fragment-animation="zoom">Outro </p>');
  });
});
