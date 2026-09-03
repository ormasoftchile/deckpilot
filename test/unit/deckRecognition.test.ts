import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { isExplicitDeckPath } from '../../packages/extension/src/deckRecognition';

describe('isExplicitDeckPath', () => {
  it('recognizes canonical deck files', () => {
    expect(isExplicitDeckPath('/talk/demo.deck.md')).to.equal(true);
    expect(isExplicitDeckPath('/talk/demo.deck.yaml')).to.equal(true);
  });

  it('recognizes a plain Markdown deck when its companion sidecar exists', () => {
    const exists = (candidate: string): boolean => candidate === '/talk/demo.deck.yaml';

    expect(isExplicitDeckPath('/talk/demo.md', exists)).to.equal(true);
  });

  it('does not recognize unrelated plain Markdown when the setting is disabled', () => {
    expect(isExplicitDeckPath('/talk/notes.md', () => false)).to.equal(false);
  });

  it('requires the exact companion sidecar name', () => {
    const exists = (candidate: string): boolean => candidate === '/talk/demo.yaml';

    expect(isExplicitDeckPath('/talk/demo.md', exists)).to.equal(false);
  });

  it('uses computed deck context for editor menu visibility', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'),
    ) as {
      contributes: {
        menus: Record<string, Array<{ when?: string }>>;
      };
    };
    const editorMenus = [
      ...manifest.contributes.menus['editor/title'],
      ...manifest.contributes.menus['editor/title/context'],
      ...manifest.contributes.menus['editor/context'],
    ];

    expect(editorMenus).to.not.be.empty;
    for (const item of editorMenus) {
      expect(item.when).to.equal(
        'deckPilot.activeIsDeck || deckPilot.activeIsDeckContent',
      );
    }
  });
});