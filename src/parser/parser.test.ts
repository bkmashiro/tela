/**
 * Tests for the .tela parser.
 */

import { parse, ParseError } from './index.js';

const MINIMAL_DOC = `---
theme: warm-editorial
mode: landing
---

hero:
  headline: Hello World
`;

const FULL_DOC = `---
theme: cool-technical
mode: landing
lang: en
title: Test Page
---

hero | split(60/40) pad(xl):
  left:
    eyebrow: "v2.0 · Now in beta"
    headline: Make something worth reading
    body: Tela composes HTML pages from layout primitives.
    cta:
      - label: Get started   | role(primary)
      - label: See examples  | role(ghost)
  right:
    figure: ./hero.png | aspect(4/3) rounded shadow(lg)

---

features | grid(3) gap(lg):
  - icon: ◆
    title: Composable
    body: 30+ primitives. Combine freely.
`;

describe('parse - minimal document', () => {
  it('parses a minimal document', () => {
    const doc = parse(MINIMAL_DOC);
    expect(doc.type).toBe('document');
    expect(doc.frontmatter.theme).toBe('warm-editorial');
    expect(doc.frontmatter.mode).toBe('landing');
    expect(doc.sections).toHaveLength(1);
  });

  it('assigns auto section IDs', () => {
    const doc = parse(MINIMAL_DOC);
    expect(doc.sections[0].id).toBe('section-0');
  });
});

describe('parse - frontmatter', () => {
  it('parses theme, mode, lang, title', () => {
    const doc = parse(FULL_DOC);
    expect(doc.frontmatter.theme).toBe('cool-technical');
    expect(doc.frontmatter.mode).toBe('landing');
    expect(doc.frontmatter.lang).toBe('en');
    expect(doc.frontmatter.title).toBe('Test Page');
  });

  it('parses inline theme override syntax', () => {
    const src = `---
theme: warm-editorial + color.accent.default=#C84B31
---

hero:
  headline: Hi
`;
    const doc = parse(src);
    expect(doc.frontmatter.theme).toBe('warm-editorial');
    expect(doc.frontmatter.tokenOverrides['color.accent.default']).toBe('#C84B31');
  });
});

describe('parse - block headers', () => {
  it('parses block type with modifiers', () => {
    const doc = parse(FULL_DOC);
    const heroSection = doc.sections[0];
    expect(heroSection.block.blockType).toBe('hero');
    const mods = heroSection.block.modifiers;
    const split = mods.find((m) => m.name === 'split');
    expect(split).toBeDefined();
    expect(split!.args).toEqual([60, 40]);
    const pad = mods.find((m) => m.name === 'pad');
    expect(pad).toBeDefined();
    expect(pad!.args).toEqual(['xl']);
  });

  it('parses boolean modifiers', () => {
    const src = `---
theme: warm-editorial
---

figure | rounded shadow(lg):
  src: ./img.png
`;
    const doc = parse(src);
    const block = doc.sections[0].block;
    expect(block.modifiers.find((m) => m.name === 'rounded')?.args).toEqual([]);
    expect(block.modifiers.find((m) => m.name === 'shadow')?.args).toEqual(['lg']);
  });
});

describe('parse - values', () => {
  it('parses quoted strings', () => {
    const doc = parse(FULL_DOC);
    const leftBlock = doc.sections[0].block.properties['left'];
    expect(leftBlock?.type).toBe('blockValue');
    if (leftBlock?.type === 'blockValue') {
      const eyebrow = leftBlock.properties['eyebrow'];
      expect(eyebrow?.type).toBe('string');
      if (eyebrow?.type === 'string') {
        expect(eyebrow.value).toBe('v2.0 · Now in beta');
      }
    }
  });

  it('parses reference values', () => {
    const doc = parse(FULL_DOC);
    const leftBlock = doc.sections[0].block.properties['left'];
    // not right, let's check right
    const rightBlock = doc.sections[0].block.properties['right'];
    if (rightBlock?.type === 'blockValue') {
      const figure = rightBlock.properties['figure'];
      expect(figure?.type).toBe('modified');
      if (figure?.type === 'modified') {
        expect(figure.base.type).toBe('reference');
        if (figure.base.type === 'reference') {
          expect(figure.base.path).toBe('./hero.png');
        }
      }
    }
  });

  it('parses multiline values', () => {
    const src = `---
theme: warm-editorial
---

hero:
  headline: |
    Make something
    worth reading
`;
    const doc = parse(src);
    const headline = doc.sections[0].block.properties['headline'];
    expect(headline?.type).toBe('multiline');
    if (headline?.type === 'multiline') {
      expect(headline.lines).toEqual(['Make something', 'worth reading']);
    }
  });
});

describe('parse - multiple sections', () => {
  it('parses two sections', () => {
    const doc = parse(FULL_DOC);
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[1].block.blockType).toBe('features');
  });

  it('assigns sequential section IDs', () => {
    const doc = parse(FULL_DOC);
    expect(doc.sections[0].id).toBe('section-0');
    expect(doc.sections[1].id).toBe('section-1');
  });
});

describe('parse - explicit section IDs', () => {
  it('uses id modifier for section ID', () => {
    const src = `---
theme: warm-editorial
---

hero | id(intro) split(60/40):
  headline: Hello
`;
    const doc = parse(src);
    expect(doc.sections[0].id).toBe('intro');
  });

  it('throws on duplicate section IDs', () => {
    const src = `---
theme: warm-editorial
---

hero | id(intro):
  headline: Hello

---

features | id(intro):
  title: Features
`;
    expect(() => parse(src)).toThrow(ParseError);
  });
});

describe('parse - errors', () => {
  it('throws ParseError on missing frontmatter', () => {
    expect(() => parse('hero:\n  headline: Hi\n')).toThrow(ParseError);
  });

  it('throws ParseError on tabs', () => {
    const src = `---
theme: warm-editorial
---

hero:
\t  headline: Hi
`;
    expect(() => parse(src)).toThrow();
  });

  it('throws ParseError on empty sections', () => {
    expect(() => parse('---\ntheme: warm-editorial\n---\n')).toThrow(ParseError);
  });
});
