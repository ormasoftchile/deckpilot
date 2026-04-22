import { expect } from 'chai';
import { extractIdComment, generateSlideId, resolveUniqueIds, slugify } from '../../../src/parser/slideIdParser';
import { parseSlides } from '../../../src/parser/slideParser';

describe('slideIdParser — unit', () => {
  // ── slugify ─────────────────────────────────────────────────────────────

  describe('slugify()', () => {
    it('lowercases text', () => {
      expect(slugify('Hello World')).to.equal('hello-world');
    });

    it('replaces spaces with hyphens', () => {
      expect(slugify('Getting Started')).to.equal('getting-started');
    });

    it('strips special characters', () => {
      expect(slugify('Hello, World!')).to.equal('hello-world');
    });

    it('collapses consecutive hyphens', () => {
      expect(slugify('A -- B')).to.equal('a-b');
    });

    it('strips leading and trailing hyphens', () => {
      expect(slugify('  hello  ')).to.equal('hello');
    });

    it('handles code-like headings', () => {
      expect(slugify('Using `npm install`')).to.equal('using-npm-install');
    });
  });

  // ── extractIdComment ─────────────────────────────────────────────────────

  describe('extractIdComment() — HTML comment (priority 1)', () => {
    it('extracts id from <!-- id: intro --> comment', () => {
      const content = '<!-- id: intro -->\n# Introduction\nSome text.';
      const { commentId, cleanedContent } = extractIdComment(content);
      expect(commentId).to.equal('intro');
      expect(cleanedContent).to.not.include('<!-- id:');
      expect(cleanedContent).to.include('# Introduction');
    });

    it('handles extra whitespace in comment', () => {
      const { commentId } = extractIdComment('<!--  id:  my-slide  -->\nContent');
      expect(commentId).to.equal('my-slide');
    });

    it('strips the comment from cleanedContent', () => {
      const { cleanedContent } = extractIdComment('<!-- id: foo -->\nHello');
      expect(cleanedContent).to.equal('Hello');
    });

    it('returns undefined commentId when no comment present', () => {
      const { commentId, cleanedContent } = extractIdComment('# Hello\nWorld');
      expect(commentId).to.be.undefined;
      expect(cleanedContent).to.equal('# Hello\nWorld');
    });
  });

  // ── generateSlideId ───────────────────────────────────────────────────────

  describe('generateSlideId() — frontmatter (priority 2)', () => {
    it('uses frontmatter id when present', () => {
      const id = generateSlideId('# Setup\nContent', { id: 'setup' }, 0);
      expect(id).to.equal('setup');
    });

    it('trims whitespace from frontmatter id', () => {
      const id = generateSlideId('Content', { id: '  my-id  ' }, 0);
      expect(id).to.equal('my-id');
    });

    it('falls through to heading when frontmatter id is blank', () => {
      const id = generateSlideId('# Hello World', { id: '   ' }, 0);
      expect(id).to.equal('hello-world');
    });
  });

  describe('generateSlideId() — heading slug (priority 3)', () => {
    it('derives id from first heading', () => {
      const id = generateSlideId('# Introduction\nSome text.', undefined, 0);
      expect(id).to.equal('introduction');
    });

    it('uses first heading even if not H1', () => {
      const id = generateSlideId('## Getting Started\nContent', undefined, 0);
      expect(id).to.equal('getting-started');
    });

    it('takes first heading when multiple exist', () => {
      const id = generateSlideId('# First\n## Second\nText', undefined, 2);
      expect(id).to.equal('first');
    });
  });

  describe('generateSlideId() — positional fallback (priority 4)', () => {
    it('generates slide-{index} when no heading', () => {
      const id = generateSlideId('Just some text.', undefined, 3);
      expect(id).to.equal('slide-3');
    });

    it('uses 0-based index', () => {
      expect(generateSlideId('Text', undefined, 0)).to.equal('slide-0');
      expect(generateSlideId('Text', undefined, 7)).to.equal('slide-7');
    });

    it('falls back when heading slugifies to empty string', () => {
      const id = generateSlideId('# !!!', undefined, 4);
      expect(id).to.equal('slide-4');
    });
  });

  // ── resolveUniqueIds ─────────────────────────────────────────────────────

  describe('resolveUniqueIds()', () => {
    it('leaves unique IDs unchanged', () => {
      const slides = [{ id: 'intro' }, { id: 'setup' }, { id: 'demo' }];
      resolveUniqueIds(slides);
      expect(slides.map(s => s.id)).to.deep.equal(['intro', 'setup', 'demo']);
    });

    it('appends -2 for a single duplicate', () => {
      const slides = [{ id: 'intro' }, { id: 'intro' }];
      resolveUniqueIds(slides);
      expect(slides[0].id).to.equal('intro');
      expect(slides[1].id).to.equal('intro-2');
    });

    it('appends -2, -3 for three duplicates', () => {
      const slides = [{ id: 'setup' }, { id: 'setup' }, { id: 'setup' }];
      resolveUniqueIds(slides);
      expect(slides.map(s => s.id)).to.deep.equal(['setup', 'setup-2', 'setup-3']);
    });

    it('avoids colliding with existing suffixed IDs', () => {
      const slides = [{ id: 'setup' }, { id: 'setup-2' }, { id: 'setup' }];
      resolveUniqueIds(slides);
      expect(slides[0].id).to.equal('setup');
      expect(slides[1].id).to.equal('setup-2');
      expect(slides[2].id).to.not.equal('setup');
      expect(slides[2].id).to.not.equal('setup-2');
    });

    it('handles empty string ids gracefully', () => {
      const slides = [{ id: '' }, { id: 'ok' }];
      resolveUniqueIds(slides);
      expect(slides[0].id).to.equal('');
      expect(slides[1].id).to.equal('ok');
    });
  });
});

// ── Integration: parseSlides populates slide.id ───────────────────────────

describe('slideIdParser — integration via parseSlides()', () => {
  it('populates id from <!-- id: --> comment', () => {
    const deck = `<!-- id: intro -->
# Introduction
Hello world.`;
    const slides = parseSlides(deck);
    expect(slides[0].id).to.equal('intro');
    expect(slides[0].html).to.not.include('id:');
  });

  it('strips id comment from rendered HTML', () => {
    const deck = `<!-- id: clean -->
# Clean Slide
Content.`;
    const slides = parseSlides(deck);
    expect(slides[0].html).to.not.include('<!-- id:');
    expect(slides[0].html).to.not.include('id: clean');
  });

  it('auto-generates id from first heading', () => {
    const deck = `# Getting Started
Some content.`;
    const slides = parseSlides(deck);
    expect(slides[0].id).to.equal('getting-started');
  });

  it('falls back to slide-0 when no heading', () => {
    const deck = `Just some plain text without a heading.`;
    const slides = parseSlides(deck);
    expect(slides[0].id).to.equal('slide-0');
  });

  it('populates id from frontmatter id: field via pending-frontmatter merge', () => {
    // A frontmatter-only block preceding a slide is merged in parseSlides
    const deck = `# Slide One
First.

---

notes: speaker notes
id: setup

---

# Setup
Content here.`;
    const slides = parseSlides(deck);
    const setupSlide = slides.find(s => s.content.includes('# Setup'));
    expect(setupSlide).to.exist;
    expect(setupSlide!.id).to.equal('setup');
  });

  it('HTML comment id takes priority over frontmatter id', () => {
    const deck = `<!-- id: from-comment -->
# Slide
Content.`;
    const slides = parseSlides(deck);
    expect(slides[0].id).to.equal('from-comment');
  });

  it('assigns unique IDs to multiple slides with same heading', () => {
    const deck = `# Introduction
First slide.

---

# Introduction
Second slide.

---

# Introduction
Third slide.`;
    const slides = parseSlides(deck);
    const ids = slides.map(s => s.id);
    expect(ids[0]).to.equal('introduction');
    expect(ids[1]).to.equal('introduction-2');
    expect(ids[2]).to.equal('introduction-3');
  });

  it('assigns correct IDs across a multi-slide deck', () => {
    const deck = `# Welcome
Intro.

---

<!-- id: explicit -->
## Step Two
Content.

---

Just text.`;
    const slides = parseSlides(deck);
    expect(slides[0].id).to.equal('welcome');
    expect(slides[1].id).to.equal('explicit');
    expect(slides[2].id).to.equal('slide-2');
  });

  it('preserves all other slide fields unchanged', () => {
    const deck = `# Regular Slide
[Run test](action:terminal.run?command=npm+test)`;
    const slides = parseSlides(deck);
    expect(slides[0].id).to.equal('regular-slide');
    expect(slides[0].interactiveElements.length).to.be.greaterThan(0);
  });
});
