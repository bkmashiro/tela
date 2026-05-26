/**
 * Token resolution: theme preset + user overrides → flat CSS custom property map.
 *
 * Resolution precedence (highest to lowest):
 *   1. User overrides (frontmatter tokens: map or inline theme: name + key=value)
 *   2. Theme preset token values
 *   3. Default theme (warm-editorial) as final fallback
 */

import { THEME_PRESETS, WARM_EDITORIAL } from './presets.js';
import type { ResolvedTokens, TokenMap } from './types.js';

/**
 * Maps a token path (e.g. "color.surface.default") to a CSS custom property name.
 *
 * Rules per spec:
 *   color.surface.default  →  --t-surface-default
 *   color.text.primary     →  --t-text-primary
 *   space.lg               →  --t-space-lg
 *   type.scale.h1          →  --t-scale-h1
 *   type.leading.default   →  --t-leading-default
 *   type.family.serif      →  --t-family-serif
 *   elevation.flat         →  --t-elevation-flat
 *   radius.md              →  --t-radius-md
 */
export function tokenPathToCssVar(path: string): string {
  // Drop "color." prefix from color tokens
  let normalized = path;
  if (normalized.startsWith('color.')) {
    normalized = normalized.slice('color.'.length);
  }
  // Drop "type." prefix from type tokens
  else if (normalized.startsWith('type.')) {
    normalized = normalized.slice('type.'.length);
  }
  // Replace dots with dashes
  const cssName = normalized.replace(/\./g, '-');
  return `--t-${cssName}`;
}

/**
 * Parse override syntax: "warm-editorial + color.accent.default=#C84B31 space.section=100"
 * Returns { themeName, overrides }.
 */
export function parseThemeSpec(spec: string): {
  themeName: string;
  overrides: Record<string, string | number>;
} {
  const plusIdx = spec.indexOf('+');
  if (plusIdx === -1) {
    return { themeName: spec.trim(), overrides: {} };
  }
  const themeName = spec.slice(0, plusIdx).trim();
  const overridePart = spec.slice(plusIdx + 1).trim();
  const overrides: Record<string, string | number> = {};
  // Split on whitespace boundaries between key=value pairs
  // But values may contain spaces (e.g. font stacks), so we split only on
  // patterns that look like "token.path=value" → find all key=value tokens
  const re = /([\w.]+)=([^\s=]+(?:\s[^\s=]+)*?)(?=\s+[\w.]+\s*=|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(overridePart)) !== null) {
    const [, key, val] = m;
    const num = Number(val);
    overrides[key] = isNaN(num) ? val : num;
  }
  return { themeName, overrides };
}

const ALL_TOKEN_KEYS = new Set(Object.keys(WARM_EDITORIAL));

/**
 * Resolve tokens to a flat CSS custom property map.
 * @param themeName  Theme preset name (e.g. "warm-editorial")
 * @param overrides  User-specified token overrides
 */
export function resolveTokens(
  themeName: string,
  overrides: Record<string, string | number> = {}
): ResolvedTokens {
  const preset: TokenMap = THEME_PRESETS[themeName] ?? WARM_EDITORIAL;

  // Validate override keys
  const unknownKeys = Object.keys(overrides).filter((k) => !ALL_TOKEN_KEYS.has(k));
  if (unknownKeys.length > 0) {
    throw new Error(
      `Unknown token override keys: ${unknownKeys.join(', ')}. ` +
        `Valid keys are the token paths defined in src/tokens/presets.ts`
    );
  }

  const values: Record<string, string> = {};
  const overriddenCssVars: string[] = [];

  // Walk all known token keys (from warm-editorial as the canonical reference)
  for (const tokenPath of ALL_TOKEN_KEYS) {
    const cssVar = tokenPathToCssVar(tokenPath);
    let resolvedValue: string | number;

    if (tokenPath in overrides) {
      resolvedValue = overrides[tokenPath];
      overriddenCssVars.push(cssVar);
    } else if (tokenPath in preset) {
      resolvedValue = preset[tokenPath];
    } else {
      // Fallback to warm-editorial
      resolvedValue = WARM_EDITORIAL[tokenPath];
    }

    values[cssVar] = String(resolvedValue);
  }

  return {
    values,
    overrides: overriddenCssVars,
    theme: themeName,
  };
}

/**
 * Render the :root CSS block from resolved tokens.
 */
export function renderTokensCSS(tokens: ResolvedTokens): string {
  const lines = [':root {'];
  for (const [cssVar, value] of Object.entries(tokens.values)) {
    lines.push(`  ${cssVar}: ${value};`);
  }
  lines.push('}');
  return lines.join('\n');
}

/** Simple hash of resolved token values for cache invalidation. */
export function hashTokens(tokens: ResolvedTokens): string {
  return JSON.stringify(tokens.values);
}
