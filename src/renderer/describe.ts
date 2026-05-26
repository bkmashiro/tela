/**
 * describe — generates a compact text layout manifest from AST + optional pixel measurements.
 * Uses semantic size buckets and fold-relative positioning rather than raw pixel values,
 * so the output is LLM-friendly (less noise, more meaning).
 */

import type { TelaDocument, Value } from '../ast/types.js';
import type { SectionLayout } from './types.js';

export interface DescribeOptions {
  viewportWidth?: number;
  viewportHeight?: number;
}

// ─── Size bucket ─────────────────────────────────────────────────────────────

type SizeBucket = 'strip' | 'compact' | 'medium' | 'large' | 'full';

function heightBucket(h: number): SizeBucket {
  if (h < 80)  return 'strip';
  if (h < 250) return 'compact';
  if (h < 450) return 'medium';
  if (h < 700) return 'large';
  return 'full';
}

// ─── Fold relationship ───────────────────────────────────────────────────────

type FoldLabel = 'above-fold' | `straddles-fold(top ${string}% visible)` | 'below-fold';

function foldLabel(lm: SectionLayout, viewportHeight: number): FoldLabel {
  const bottom = lm.y + lm.h;
  if (bottom <= viewportHeight) return 'above-fold';
  if (lm.y >= viewportHeight)   return 'below-fold';
  // Straddles: compute visible %
  const visiblePx = viewportHeight - lm.y;
  const pct = Math.round((visiblePx / lm.h) * 100);
  return `straddles-fold(top ${pct}% visible)`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function describeDocument(
  doc: TelaDocument,
  sectionIds: string[],
  layout: SectionLayout[] | null,
  opts: DescribeOptions = {}
): string {
  const { viewportWidth = 1440, viewportHeight = 900 } = opts;
  const fm = doc.frontmatter;

  const lines: string[] = [];

  // Header
  lines.push(`doc: "${fm.title ?? 'Untitled'}"  theme: ${fm.theme}  mode: ${fm.mode}  lang: ${fm.lang}`);
  lines.push('━'.repeat(70));

  const layoutMap = new Map<string, SectionLayout>(layout?.map(l => [l.id, l]) ?? []);

  for (let i = 0; i < doc.sections.length; i++) {
    const section = doc.sections[i];
    const id = sectionIds[i] ?? section.id;
    const block = section.block;

    // Modifiers — skip the 'type' mod for charts (shown in typeLabel instead)
    const mods = block.modifiers
      .filter(m => !(block.blockType === 'chart' && m.name === 'type'))
      .map(m => m.args.length ? `${m.name}(${m.args.join(',')})` : m.name)
      .join(' ');

    const typeLabel = block.blockType === 'chart'
      ? `chart/${getModArg(block, 'type') ?? 'bar'}`
      : block.blockType;

    // Section header: §N type  [mods]  size-bucket  fold-label
    const parts: string[] = [`§${i + 1} ${typeLabel}`];
    if (mods) parts.push(`[${mods}]`);

    const lm = layoutMap.get(id);
    if (lm) {
      parts.push(heightBucket(lm.h));
      parts.push(foldLabel(lm, viewportHeight));
      if (lm.position === 'sticky' || lm.position === 'fixed') {
        parts.push(`[${lm.position}]`);
      }
    }

    lines.push(parts.join('  '));

    // Key properties (abbreviated, skip 'datasets' array noise)
    for (const [key, val] of Object.entries(block.properties)) {
      if (!val) continue;
      const str = resolveValueStr(val);
      if (!str || str === '[array]' || str === '[block]') continue;
      const display = str.length > 80 ? str.slice(0, 77) + '…' : str;
      lines.push(`   ${key}: "${display}"`);
    }

    lines.push('');
  }

  // Summary footer (only when layout is available)
  if (layout && layout.length > 0) {
    const pageHeight = Math.round((layout[layout.length - 1].y + layout[layout.length - 1].h) / 50) * 50;
    lines.push(`viewport: ${viewportWidth}×${viewportHeight}  |  page-height: ≈${pageHeight}px`);

    // Overlap: sticky/fixed elements
    const floaters = layout.filter(l => l.position === 'sticky' || l.position === 'fixed');
    if (floaters.length > 0) {
      for (const f of floaters) {
        const idx = layout.findIndex(l => l.id === f.id);
        const covered = layout.slice(idx + 1).map((_, j) => `§${idx + j + 2}`).join('–');
        if (covered) {
          lines.push(`overlap: §${idx + 1}(${f.position}) covers ${covered} — top ${f.h}px of each`);
        }
      }
    } else {
      lines.push('overlap: none');
    }
  }

  return lines.join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getModArg(block: { modifiers: Array<{ name: string; args: (string | number)[] }> }, name: string): string | null {
  const mod = block.modifiers.find(m => m.name === name);
  return mod?.args[0] != null ? String(mod.args[0]) : null;
}

function resolveValueStr(val: Value): string {
  if (!val) return '';
  switch (val.type) {
    case 'string':    return val.value;
    case 'number':    return String(val.value);
    case 'reference': return val.path;
    case 'multiline': return val.lines.join(' ');
    case 'modified':  return resolveValueStr(val.base);
    case 'array':     return '[array]';
    case 'blockValue':return '[block]';
    default:          return '';
  }
}
