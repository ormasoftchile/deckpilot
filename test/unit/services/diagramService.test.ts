import { expect } from 'chai';
import { injectDiagramPlaceholders } from '../../../packages/core/src/renderer/diagramPlaceholderRenderer';
import type { DiagramBlockRef, DiagramFenceInfo, IDiagramRenderer } from '../../../packages/core/src/renderer/diagramRenderer';
import { DiagramRendererRegistry } from '../../../packages/extension/src/renderer/diagram/registry';
import { DiagramService, annotateDiagramPlaceholders } from '../../../packages/extension/src/services/diagramService';

function makeBlock(): DiagramBlockRef {
  return {
    id: 'diagram-0-0',
    slideIndex: 0,
    source: 'graph TD\n  A --> B & C\n',
    fence: {
      language: 'mermaid',
      attributes: {
        caption: 'Flow',
        theme: 'auto',
      },
    },
    position: { start: 0, end: 24 },
  };
}

describe('DiagramService', () => {
  it('resolves loading placeholders through the registry', async () => {
    const registry = new DiagramRendererRegistry();
    let received: { source?: string; fence?: DiagramFenceInfo; workspaceRoot?: string; theme?: string } = {};
    const renderer: IDiagramRenderer = {
      id: 'test-renderer',
      supportedFenceLanguages: ['mermaid'],
      render: async (source, fence, options) => {
        received = {
          source,
          fence,
          workspaceRoot: options?.workspaceRoot,
          theme: options?.theme,
        };
        return {
          ok: true,
          format: 'svg',
          svg: '<svg><text>ok</text></svg>',
          rendererId: 'test-renderer',
        };
      },
    };
    registry.register(renderer);

    const html = annotateDiagramPlaceholders(
      injectDiagramPlaceholders('<!--DIAGRAM:diagram-0-0-->', [makeBlock()]),
      '/workspace/demo',
    );

    const updates = await new DiagramService(registry).resolveSlideBlocks(html);

    expect(updates).to.deep.equal([{
      blockId: 'diagram-0-0',
      html: '<figure class="diagram-block diagram-block--mermaid" data-render-id="diagram-0-0" data-diagram-renderer="test-renderer" data-diagram-language="mermaid"><div class="diagram-block__viewport"><svg><text>ok</text></svg></div><figcaption class="diagram-block__caption">Flow</figcaption></figure>',
    }]);
    expect(received.source).to.equal('graph TD\n  A --> B & C\n');
    expect(received.fence?.attributes?.caption).to.equal('Flow');
    expect(received.workspaceRoot).to.equal('/workspace/demo');
    expect(received.theme).to.equal('dark');
  });

  it('escapes caption text and omits empty captions', async () => {
    const registry = new DiagramRendererRegistry();
    const renderer: IDiagramRenderer = {
      id: 'test-renderer',
      supportedFenceLanguages: ['mermaid'],
      render: async () => ({
        ok: true,
        format: 'svg',
        svg: '<svg><text>ok</text></svg>',
        rendererId: 'test-renderer',
      }),
    };
    registry.register(renderer);

    const specialCaptionBlock: DiagramBlockRef = {
      ...makeBlock(),
      fence: {
        language: 'mermaid',
        attributes: {
          caption: 'A <B> & "C" 🚀 — 日本語 Ω',
        },
      },
    };
    const emptyCaptionBlock: DiagramBlockRef = {
      ...makeBlock(),
      id: 'diagram-0-1',
      fence: {
        language: 'mermaid',
        attributes: {
          caption: '   ',
        },
      },
    };

    const html = annotateDiagramPlaceholders(
      injectDiagramPlaceholders(
        '<!--DIAGRAM:diagram-0-0-->\n<!--DIAGRAM:diagram-0-1-->',
        [specialCaptionBlock, emptyCaptionBlock],
      ),
      '/workspace/demo',
    );

    const updates = await new DiagramService(registry).resolveSlideBlocks(html);

    expect(updates[0].html).to.contain('<figcaption class="diagram-block__caption">A &lt;B&gt; &amp; &quot;C&quot; 🚀 — 日本語 Ω</figcaption>');
    expect(updates[1].html).to.not.contain('<figcaption');
  });

  it('returns an error block when no renderer is registered', async () => {
    const html = injectDiagramPlaceholders('<!--DIAGRAM:diagram-0-0-->', [makeBlock()]);

    const updates = await new DiagramService(new DiagramRendererRegistry()).resolveSlideBlocks(html);

    expect(updates).to.have.lengthOf(1);
    expect(updates[0].blockId).to.equal('diagram-0-0');
    expect(updates[0].html).to.include('diagram-block--error');
    expect(updates[0].html).to.include('No diagram renderer registered for &quot;mermaid&quot;');
  });
});
