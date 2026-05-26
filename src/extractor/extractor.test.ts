/**
 * Tests for the HTML extractor.
 */

import { extract } from './index.js';

describe('extract()', () => {
  it('detects hero type from h1 + p + button', () => {
    const html = `
      <section>
        <h1>Welcome to Acme</h1>
        <p>The best product on the market.</p>
        <button>Get Started</button>
      </section>
    `;
    const result = extract(html);
    expect(result.sections.length).toBeGreaterThan(0);
    // Hero or CTA should be detected
    const tela = result.sections[0].tela;
    expect(tela).toMatch(/^(hero|cta)/);
    expect(result.overallConfidence).toBeGreaterThan(0);
  });

  it('detects grid layout from grid-template-columns', () => {
    const html = `
      <section style="display: grid; grid-template-columns: repeat(3, 1fr);">
        <div class="card"><h3>Card 1</h3><p>Text</p></div>
        <div class="card"><h3>Card 2</h3><p>Text</p></div>
        <div class="card"><h3>Card 3</h3><p>Text</p></div>
      </section>
    `;
    const result = extract(html);
    expect(result.sections.length).toBeGreaterThan(0);
    const tela = result.tela;
    expect(tela).toMatch(/grid\(3\)/);
  });

  it('detects quote type from blockquote', () => {
    const html = `
      <section>
        <blockquote>
          <p>Design is not just what it looks like. Design is how it works.</p>
          <cite>Steve Jobs</cite>
        </blockquote>
      </section>
    `;
    const result = extract(html);
    expect(result.sections.length).toBeGreaterThan(0);
    const section = result.sections[0];
    expect(section.tela).toMatch(/^quote/);
    expect(section.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('detects footer type from footer tag', () => {
    const html = `
      <footer>
        <p>© 2024 Acme Corp. All rights reserved.</p>
      </footer>
    `;
    const result = extract(html);
    expect(result.sections.length).toBeGreaterThan(0);
    const section = result.sections[0];
    expect(section.tela).toMatch(/^footer/);
  });

  it('returns valid .tela string for a full page', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Page</title></head>
      <body style="background-color: #f5f4ed;">
        <header>
          <nav>
            <a href="/">Logo</a>
            <a href="/about">About</a>
          </nav>
        </header>
        <main>
          <section>
            <h1>Big Hero Headline</h1>
            <p>A compelling description of the product.</p>
            <button>Get Started</button>
          </section>
          <section>
            <h2>Features</h2>
            <p>All the features you need.</p>
          </section>
        </main>
        <footer>
          <p>© 2024 Acme. All rights reserved.</p>
        </footer>
      </body>
      </html>
    `;
    const result = extract(html);
    expect(result.tela).toContain('---');
    expect(result.tela).toContain('theme:');
    expect(result.tela).toContain('mode:');
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.overallConfidence).toBeGreaterThan(0);
    expect(result.overallConfidence).toBeLessThanOrEqual(1);
  });

  it('includes section confidence scores between 0 and 1', () => {
    const html = `<section><h2>About Us</h2><p>We are a company.</p></section>`;
    const result = extract(html);
    for (const section of result.sections) {
      expect(section.confidence).toBeGreaterThanOrEqual(0);
      expect(section.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(section.notes)).toBe(true);
    }
  });

  it('detects warm-editorial theme from beige background', () => {
    const html = `<body style="background-color: #f5f4ed;"><section><p>Hello</p></section></body>`;
    const result = extract(html);
    expect(result.tela).toMatch(/warm-editorial/);
  });

  it('detects dark-dramatic theme from dark background', () => {
    const html = `<body style="background-color: #0a0a0a;"><section><h1>Dark Page</h1></section></body>`;
    const result = extract(html);
    expect(result.tela).toMatch(/dark-dramatic/);
  });

  it('detects split layout from flex row', () => {
    const html = `
      <section style="display: flex; flex-direction: row;">
        <div><h1>Title</h1><p>Desc</p></div>
        <div><img src="./hero.jpg" alt="Hero"></div>
      </section>
    `;
    const result = extract(html);
    const tela = result.tela;
    expect(tela).toMatch(/split\(50\/50\)/);
  });

  it('includes grid(n) modifier for grid sections', () => {
    const html = `
      <section style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;">
        <div class="card">A</div>
        <div class="card">B</div>
        <div class="card">C</div>
        <div class="card">D</div>
      </section>
    `;
    const result = extract(html);
    expect(result.tela).toMatch(/grid\(4\)/);
  });
});
