import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

describe('deckpilot-authoring skill', () => {
  const skillPath = path.resolve(
    process.cwd(),
    'resources/skills/deckpilot-authoring/SKILL.md',
  );
  const skill = fs.readFileSync(skillPath, 'utf-8');
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';

  it('is discoverable from common narration and audio-cue requests', () => {
    expect(frontmatter).to.match(/add audio cues/i);
    expect(frontmatter).to.match(/add narration/i);
  });

  it('requires cue requests to create or merge a companion sidecar', () => {
    expect(skill).to.match(/create or merge.*\.deck\.yaml/is);
    expect(skill).to.match(/preserv(?:e|ing) unrelated sidecar metadata/i);
    expect(skill).to.match(/heading-derived IDs/i);
    expect(skill).to.match(/Do not edit the Markdown to add ID anchors/i);
  });

  it('targets the active or attached deck, including plain Markdown decks', () => {
    expect(skill).to.match(/"this deck".*active editor/i);
    expect(skill).to.match(/plain `\.md` is a deck/i);
    expect(skill).to.match(/Never choose another deck.*sidecar/i);
    expect(skill).to.match(/If none exists, ask once/i);
  });

  it('requires the resulting sidecar and references to be validated', () => {
    expect(skill).to.match(/sidecar parses as YAML/i);
    expect(skill).to.match(/every sidecar item ID matches a slide or video item ID/is);
    expect(skill).to.match(/Report only validation failures/i);
  });

  it('keeps narration tasks local and does not investigate implementation', () => {
    expect(skill).to.match(/Narration\/audio cues:.*no reference file is needed/i);
    expect(skill).to.match(/Do not inspect Deckpilot's source code, tests, `package\.json`, settings, or Git history/i);
    expect(skill).to.match(/Do not run repository-wide searches/i);
    expect(skill).to.match(/do not invoke or search for extension commands/i);
    expect(skill).to.not.include('Deckpilot: Validate Deck');
    expect(skill).to.not.match(/Read the references.*source of truth/is);
  });
});