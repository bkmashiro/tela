/**
 * Tests for the renderer (compile + render pipeline).
 */

import { parse } from '../parser/index.js';
import { compile, render, makeEmptyCache } from './index.js';

const SIMPLE_DOC = `---
theme: warm-editorial
mode: landing
---

hero:
  headline: Hello World
  body: Welcome to Tela.
`;

const TWO_SECTION_DOC = `---
theme: cool-technical
mode: landing
---

nav:
  brand: Tela

---

hero | split(60/40) pad(xl):
  left:
    headline: Make something
    body: Tela is great.
  right:
    figure: ./hero.png | aspect(4/3) rounded shadow(lg)
`;

describe('compile', () => {
  it('compiles a simple document', () => {
    const doc = parse(SIMPLE_DOC);
    const tree = compile(doc);
    expect(tree.frontmatter.theme).toBe('warm-editorial');
    expect(tree.sections).toHaveLength(1);
    expect(tree.tokens.values['--t-surface-default']).toBe('#f5f4ed');
  });

  it('applies theme token overrides', () => {
    const src = `---
theme: warm-editorial + color.accent.default=#C84B31
---

hero:
  headline: Hi
`;
    const doc = parse(src);
    const tree = compile(doc);
    expect(tree.tokens.values['--t-accent-default']).toBe('#C84B31');
    expect(tree.tokens.overrides).toContain('--t-accent-default');
  });
});

describe('render', () => {
  it('renders a simple document to HTML', () => {
    const doc = parse(SIMPLE_DOC);
    const tree = compile(doc);
    const { html } = render(tree);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain(':root {');
    expect(html).toContain('--t-surface-default: #f5f4ed');
    expect(html).toContain('Hello World');
    expect(html).toContain('Welcome to Tela.');
  });

  it('includes section ID comments', () => {
    const doc = parse(SIMPLE_DOC);
    const tree = compile(doc);
    const { html } = render(tree);
    expect(html).toContain('<!-- Section: section-0 -->');
  });

  it('renders a nav section', () => {
    const doc = parse(TWO_SECTION_DOC);
    const tree = compile(doc);
    const { html } = render(tree);
    expect(html).toContain('tela-nav');
    expect(html).toContain('Tela');
  });

  it('renders a hero section', () => {
    const doc = parse(TWO_SECTION_DOC);
    const tree = compile(doc);
    const { html } = render(tree);
    expect(html).toContain('tela-hero');
    expect(html).toContain('Make something');
  });

  it('uses incremental rendering cache', () => {
    const doc = parse(SIMPLE_DOC);
    const tree = compile(doc);
    const cache = makeEmptyCache();

    const result1 = render(tree, cache);
    expect(result1.renderedSections).toContain('section-0');

    // Second render — should use cache
    const result2 = render(tree, cache);
    expect(result2.renderedSections).toHaveLength(0);
    expect(result2.html).toBe(result1.html);
  });

  it('invalidates cache on theme change', () => {
    const doc = parse(SIMPLE_DOC);
    const tree1 = compile(doc);
    const cache = makeEmptyCache();
    render(tree1, cache);

    // Change theme
    const doc2 = parse(SIMPLE_DOC.replace('warm-editorial', 'dark-dramatic'));
    const tree2 = compile(doc2);
    const result2 = render(tree2, cache);

    // All sections should be re-rendered
    expect(result2.renderedSections).toContain('section-0');
    expect(result2.html).toContain('--t-surface-default: #0a0a0a');
  });
});

describe('render - component types', () => {
  const renderComponent = (tela: string) => {
    const src = `---\ntheme: warm-editorial\n---\n\n${tela}`;
    const doc = parse(src);
    const tree = compile(doc);
    return render(tree).html;
  };

  it('renders hero', () => {
    const html = renderComponent(`hero:\n  headline: Test Hero\n  body: Test body\n`);
    expect(html).toContain('tela-hero');
    expect(html).toContain('Test Hero');
  });

  it('renders prose', () => {
    const html = renderComponent(`prose:\n  title: Prose Title\n  body: Some text.\n`);
    expect(html).toContain('tela-prose');
    expect(html).toContain('Prose Title');
  });

  it('renders quote', () => {
    const html = renderComponent(`quote | accent:\n  text: A great quote.\n  cite: Someone\n`);
    expect(html).toContain('tela-quote');
    expect(html).toContain('A great quote.');
    expect(html).toContain('Someone');
  });

  it('renders footer', () => {
    const html = renderComponent(`footer:\n  copyright: "© 2026 Tela"\n`);
    expect(html).toContain('tela-footer');
    expect(html).toContain('© 2026 Tela');
  });

  it('renders divider', () => {
    const html = renderComponent(`divider:\n  label: Section\n`);
    expect(html).toContain('tela-divider');
    expect(html).toContain('Section');
  });

  it('renders cta', () => {
    const html = renderComponent(`cta:\n  headline: Get started\n  body: Join us today.\n`);
    expect(html).toContain('tela-cta');
    expect(html).toContain('Get started');
  });
});
