/**
 * Tests for the token resolution system.
 */

import { resolveTokens, tokenPathToCssVar, parseThemeSpec, renderTokensCSS } from './resolver.js';

describe('tokenPathToCssVar', () => {
  it('converts color.surface.default to --t-surface-default', () => {
    expect(tokenPathToCssVar('color.surface.default')).toBe('--t-surface-default');
  });

  it('converts color.text.primary to --t-text-primary', () => {
    expect(tokenPathToCssVar('color.text.primary')).toBe('--t-text-primary');
  });

  it('converts space.lg to --t-space-lg', () => {
    expect(tokenPathToCssVar('space.lg')).toBe('--t-space-lg');
  });

  it('converts type.scale.h1 to --t-scale-h1', () => {
    expect(tokenPathToCssVar('type.scale.h1')).toBe('--t-scale-h1');
  });

  it('converts type.leading.default to --t-leading-default', () => {
    expect(tokenPathToCssVar('type.leading.default')).toBe('--t-leading-default');
  });

  it('converts type.family.serif to --t-family-serif', () => {
    expect(tokenPathToCssVar('type.family.serif')).toBe('--t-family-serif');
  });

  it('converts elevation.flat to --t-elevation-flat', () => {
    expect(tokenPathToCssVar('elevation.flat')).toBe('--t-elevation-flat');
  });

  it('converts radius.md to --t-radius-md', () => {
    expect(tokenPathToCssVar('radius.md')).toBe('--t-radius-md');
  });
});

describe('parseThemeSpec', () => {
  it('parses a plain theme name', () => {
    const r = parseThemeSpec('warm-editorial');
    expect(r.themeName).toBe('warm-editorial');
    expect(r.overrides).toEqual({});
  });

  it('parses inline override syntax', () => {
    const r = parseThemeSpec('warm-editorial + color.accent.default=#C84B31');
    expect(r.themeName).toBe('warm-editorial');
    expect(r.overrides['color.accent.default']).toBe('#C84B31');
  });
});

describe('resolveTokens', () => {
  it('resolves warm-editorial tokens', () => {
    const resolved = resolveTokens('warm-editorial');
    expect(resolved.theme).toBe('warm-editorial');
    expect(resolved.values['--t-surface-default']).toBe('#f5f4ed');
    expect(resolved.values['--t-accent-default']).toBe('#1B365D');
    expect(resolved.overrides).toHaveLength(0);
  });

  it('resolves cool-technical tokens', () => {
    const resolved = resolveTokens('cool-technical');
    expect(resolved.values['--t-surface-default']).toBe('#f8f9fa');
    expect(resolved.values['--t-accent-default']).toBe('#2563eb');
  });

  it('resolves neutral-minimal tokens', () => {
    const resolved = resolveTokens('neutral-minimal');
    expect(resolved.values['--t-surface-default']).toBe('#ffffff');
  });

  it('resolves dark-dramatic tokens', () => {
    const resolved = resolveTokens('dark-dramatic');
    expect(resolved.values['--t-surface-default']).toBe('#0a0a0a');
    expect(resolved.values['--t-accent-default']).toBe('#ff6b35');
  });

  it('applies user overrides', () => {
    const resolved = resolveTokens('warm-editorial', {
      'color.accent.default': '#C84B31',
    });
    expect(resolved.values['--t-accent-default']).toBe('#C84B31');
    expect(resolved.overrides).toContain('--t-accent-default');
  });

  it('throws on unknown override keys', () => {
    expect(() =>
      resolveTokens('warm-editorial', { 'color.unknown.token': '#fff' })
    ).toThrow(/Unknown token override keys/);
  });

  it('falls back to warm-editorial for unknown theme', () => {
    const resolved = resolveTokens('nonexistent-theme');
    expect(resolved.values['--t-surface-default']).toBe('#f5f4ed');
  });
});

describe('renderTokensCSS', () => {
  it('emits a :root block', () => {
    const resolved = resolveTokens('warm-editorial');
    const css = renderTokensCSS(resolved);
    expect(css).toContain(':root {');
    expect(css).toContain('--t-surface-default: #f5f4ed;');
    expect(css).toContain('}');
  });
});
