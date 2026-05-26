/**
 * Renderer utility helpers for resolving values, modifiers, and tokens.
 */

import type { Value, Block, Modifier, ArrayValue } from '../ast/types.js';
import type { ResolvedTokens } from '../tokens/types.js';

/** Resolve a Value node to a plain string. */
export function resolveString(val: Value | undefined): string {
  if (!val) return '';
  switch (val.type) {
    case 'string': return val.value;
    case 'number': return String(val.value);
    case 'reference': return val.path;
    case 'multiline': return val.lines.join('\n');
    case 'modified': return resolveString(val.base);
    case 'blockValue': return '';
    case 'array': return val.items.map(resolveString).join(', ');
  }
}

/** Resolve a Value to its string array items (for arrays). */
export function resolveArray(val: Value | undefined): Value[] {
  if (!val) return [];
  if (val.type === 'array') return val.items;
  return [val];
}

/** Get a modifier's first string argument, or default. */
export function getModArg(modifiers: Modifier[], name: string, def: string = ''): string {
  const mod = modifiers.find((m) => m.name === name);
  if (!mod) return def;
  return mod.args.length > 0 ? String(mod.args[0]) : def;
}

/** Check if a boolean modifier is present. */
export function hasMod(modifiers: Modifier[], name: string): boolean {
  return modifiers.some((m) => m.name === name);
}

/** Get a modifier's numeric first argument, or default. */
export function getModNum(modifiers: Modifier[], name: string, def: number): number {
  const mod = modifiers.find((m) => m.name === name);
  if (!mod || mod.args.length === 0) return def;
  const n = Number(mod.args[0]);
  return isNaN(n) ? def : n;
}

/** CSS var() reference helper. */
export function tv(name: string): string {
  return `var(--t-${name})`;
}

export const T = {
  // Surfaces
  surfaceDefault: tv('surface-default'),
  surfaceElevated: tv('surface-elevated'),
  surfaceWarm: tv('surface-warm'),
  surfaceInverted: tv('surface-inverted'),
  // Text
  textPrimary: tv('text-primary'),
  textSecondary: tv('text-secondary'),
  textCaption: tv('text-caption'),
  textAccent: tv('text-accent'),
  textInverse: tv('text-inverse'),
  // Borders
  borderSubtle: tv('border-subtle'),
  borderDefault: tv('border-default'),
  borderStrong: tv('border-strong'),
  // Accent
  accentDefault: tv('accent-default'),
  accentTint: tv('accent-tint'),
  accentShade: tv('accent-shade'),
  // Spacing
  spaceXs: tv('space-xs'),
  spaceSm: tv('space-sm'),
  spaceMd: tv('space-md'),
  spaceLg: tv('space-lg'),
  spaceXl: tv('space-xl'),
  spaceSection: tv('space-section'),
  // Type scale
  scaleCaption: tv('scale-caption'),
  scaleBody: tv('scale-body'),
  scaleLead: tv('scale-lead'),
  scaleH3: tv('scale-h3'),
  scaleH2: tv('scale-h2'),
  scaleH1: tv('scale-h1'),
  scaleDisplay: tv('scale-display'),
  // Type weight
  weightBody: tv('weight-body'),
  weightHeading: tv('weight-heading'),
  // Leading
  leadingTight: tv('leading-tight'),
  leadingDefault: tv('leading-default'),
  leadingLoose: tv('leading-loose'),
  // Family
  familySerif: tv('family-serif'),
  familySans: tv('family-sans'),
  familyMono: tv('family-mono'),
  // Elevation
  elevationFlat: tv('elevation-flat'),
  elevationRaised: tv('elevation-raised'),
  elevationFloating: tv('elevation-floating'),
  // Radius
  radiusSm: tv('radius-sm'),
  radiusMd: tv('radius-md'),
  radiusLg: tv('radius-lg'),
  radiusXl: tv('radius-xl'),
  radiusPill: tv('radius-pill'),
};

/** Resolve space token from a size name or default. */
export function spaceToken(size: string): string {
  switch (size) {
    case 'xs': return T.spaceXs;
    case 'sm': return T.spaceSm;
    case 'md': return T.spaceMd;
    case 'lg': return T.spaceLg;
    case 'xl': return T.spaceXl;
    case 'section': return T.spaceSection;
    default: return T.spaceMd;
  }
}

/** Resolve shadow token from a size name. */
export function shadowToken(size: string): string {
  switch (size) {
    case 'sm': return T.elevationRaised;
    case 'md': return T.elevationRaised;
    case 'lg': return T.elevationFloating;
    default: return T.elevationRaised;
  }
}

/** Resolve radius from a modifier's arg. */
export function radiusToken(size: string): string {
  switch (size) {
    case 'sm': return T.radiusSm;
    case 'md': return T.radiusMd;
    case 'lg': return T.radiusLg;
    case 'xl': return T.radiusXl;
    case 'pill': return T.radiusPill;
    default: return T.radiusMd;
  }
}

/** Escape HTML entities. */
export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Resolve multiline text — join lines, wrap paragraphs in <p> tags for prose. */
export function multilineToHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/);
  if (paragraphs.length <= 1) {
    return `<p>${esc(text.trim())}</p>`;
  }
  return paragraphs.map((p) => `<p>${esc(p.trim())}</p>`).join('\n');
}

/** Get BlockValue properties from a Value. */
export function getBlockValueProps(val: Value | undefined): Record<string, Value> {
  if (!val || val.type !== 'blockValue') return {};
  return val.properties;
}

/** Get array items from a Value. */
export function getArrayItems(val: Value | undefined): Value[] {
  if (!val) return [];
  if (val.type === 'array') return val.items;
  return [];
}

/**
 * Resolve a site-relative href given the current page's basePath.
 * - External URLs (http/https) and anchors (#) are left unchanged
 * - Site-relative paths (/docs) are made relative to basePath
 */
export function resolveHref(href: string, basePath?: string): string {
  if (!href) return '#';
  if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) {
    return href;
  }
  if (href.startsWith('/') && basePath) {
    // Compute relative path from basePath to href
    const fromParts = basePath.split('/').filter(Boolean);
    const toParts = href.split('/').filter(Boolean);
    const upCount = fromParts.length;
    const parts = [...Array(upCount).fill('..'), ...toParts];
    const result = parts.join('/');
    return result || './';
  }
  return href;
}

/** Inline-style CSS generation helper. */
export function style(props: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) parts.push(`${k}: ${v}`);
  }
  return parts.join('; ');
}
