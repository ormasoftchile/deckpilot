import { expect } from 'chai';
import { parseDiagramBlocks } from '../../packages/core/src/parser/diagramBlockParser';

describe('parseDiagramBlocks', () => {
  it('extracts a single diagram fence and emits a marker', () => {
    const content = [
      '```diagram:mermaid',
      'graph TD',
      '  A --> B',
      '```',
    ].join('\n');

    const result = parseDiagramBlocks(content, 0);

    expect(result.cleanedContent).to.equal('<!--DIAGRAM:diagram-0-0-->');
    expect(result.blocks).to.have.lengthOf(1);
    expect(result.blocks[0]).to.deep.include({
      id: 'diagram-0-0',
      slideIndex: 0,
      source: 'graph TD\n  A --> B\n',
      fence: {
        language: 'mermaid',
        attributes: undefined,
      },
    });
  });

  it('increments ids for multiple diagram fences on the same slide', () => {
    const content = [
      '```diagram:mermaid',
      'graph TD',
      '  A --> B',
      '```',
      '',
      '```diagram:d2',
      'x -> y',
      '```',
    ].join('\n');

    const result = parseDiagramBlocks(content, 0);

    expect(result.cleanedContent).to.equal([
      '<!--DIAGRAM:diagram-0-0-->',
      '<!--DIAGRAM:diagram-0-1-->',
    ].join('\n'));
    expect(result.blocks.map(block => block.id)).to.deep.equal([
      'diagram-0-0',
      'diagram-0-1',
    ]);
  });

  it('uses the provided slide index in generated ids', () => {
    const content = [
      '```diagram:mermaid',
      'graph TD',
      '  A --> B',
      '```',
    ].join('\n');

    const result = parseDiagramBlocks(content, 3);

    expect(result.cleanedContent).to.equal('<!--DIAGRAM:diagram-3-0-->');
    expect(result.blocks[0].id).to.equal('diagram-3-0');
    expect(result.blocks[0].slideIndex).to.equal(3);
  });

  it('parses inline fence attributes', () => {
    const content = [
      '```diagram:mermaid {theme: dark, caption: "System"}',
      'graph TD',
      '  A --> B',
      '```',
    ].join('\n');

    const result = parseDiagramBlocks(content, 0);

    expect(result.blocks).to.have.lengthOf(1);
    expect(result.blocks[0].fence.language).to.equal('mermaid');
    expect(result.blocks[0].fence.attributes).to.deep.equal({
      theme: 'dark',
      caption: 'System',
    });
  });

  it('returns the input unchanged when no diagram fences exist', () => {
    const content = [
      '# Slide title',
      '',
      'Regular paragraph.',
      '',
      '```ts',
      'const untouched = true;',
      '```',
    ].join('\n');

    const result = parseDiagramBlocks(content, 0);

    expect(result.cleanedContent).to.equal(content);
    expect(result.blocks).to.deep.equal([]);
  });

  it('preserves content around diagram fences', () => {
    const content = [
      '# Architecture',
      '',
      'Intro paragraph before diagram.',
      '',
      '```diagram:mermaid',
      'graph TD',
      '  A --> B',
      '```',
      '',
      'Closing paragraph after diagram.',
    ].join('\n');

    const result = parseDiagramBlocks(content, 0);

    expect(result.cleanedContent).to.equal([
      '# Architecture',
      '',
      'Intro paragraph before diagram.',
      '',
      '<!--DIAGRAM:diagram-0-0-->',
      'Closing paragraph after diagram.',
    ].join('\n'));
  });

  it('preserves internal newlines inside the fence body', () => {
    const content = [
      '```diagram:mermaid',
      'graph TD',
      '  A --> B',
      '',
      '  B --> C',
      '```',
    ].join('\n');

    const result = parseDiagramBlocks(content, 1);

    expect(result.blocks).to.have.lengthOf(1);
    expect(result.blocks[0].source).to.equal('graph TD\n  A --> B\n\n  B --> C\n');
  });

  it('parses diagram fences with up to three leading spaces', () => {
    const content = [
      ' # Architecture',
      '',
      ' ```diagram:mermaid',
      ' graph TD',
      '   A --> B',
      ' ```',
    ].join('\n');

    const result = parseDiagramBlocks(content, 0);

    expect(result.blocks).to.have.lengthOf(1);
    expect(result.cleanedContent).to.equal([
      ' # Architecture',
      '',
      '<!--DIAGRAM:diagram-0-0-->',
    ].join('\n'));
  });

  it('parses CRLF diagram fences', () => {
    const content = '```diagram:mermaid\r\ngraph TD\r\n  A --> B\r\n```\r\n';

    const result = parseDiagramBlocks(content, 2);

    expect(result.blocks).to.have.lengthOf(1);
    expect(result.blocks[0].id).to.equal('diagram-2-0');
    expect(result.cleanedContent).to.equal('<!--DIAGRAM:diagram-2-0-->');
  });
});
