/**
 * Rule: spacing-rhythm
 * Checks padding/margin/gap values are multiples of 8px (base unit).
 * Warns for values that are not multiples of 4px.
 * Flags non-multiples of 8px as rhythm breaks.
 */

import type { CheckRule, CheckInput, CheckFinding } from '../types.js';
import { extractAllStyles, parsePx, splitShorthand } from '../html-utils.js';

const BASE_UNIT = 8;
const FINE_UNIT = 4;

function checkSpacingValue(val: string): { px: number; ok: boolean; warn: boolean } | null {
  const parts = splitShorthand(val);
  // Use the first non-zero value for simplicity
  for (const part of parts) {
    if (part === '0' || part === 'auto' || part === 'inherit') continue;
    const px = parsePx(part);
    if (px === null) continue;
    if (px === 0) continue;
    const okMult8 = Math.abs(Math.round(px) % BASE_UNIT) === 0;
    const okMult4 = Math.abs(Math.round(px) % FINE_UNIT) === 0;
    return { px, ok: okMult8, warn: !okMult4 };
  }
  return null;
}

const rule: CheckRule = {
  id: 'spacing-rhythm',
  name: 'Spacing Rhythm',
  severity: 'warning',

  check(input: CheckInput): CheckFinding[] {
    const findings: CheckFinding[] = [];
    const styles = extractAllStyles(input.html);
    let counter = 0;

    const spacingProps = ['padding', 'margin', 'gap', 'padding-top', 'padding-bottom',
      'padding-left', 'padding-right', 'margin-top', 'margin-bottom',
      'margin-left', 'margin-right', 'row-gap', 'column-gap'];

    const flagged = new Set<string>();

    for (const style of styles) {
      for (const prop of spacingProps) {
        const val = style[prop];
        if (!val) continue;
        const result = checkSpacingValue(val);
        if (!result) continue;

        const key = `${prop}:${val}`;
        if (flagged.has(key)) continue;

        if (result.warn) {
          // Not even a multiple of 4px
          flagged.add(key);
          counter++;
          findings.push({
            id: `spacing-rhythm.${String(counter).padStart(3, '0')}`,
            severity: 'warning',
            rule: rule.id,
            location: 'document',
            finding: `${prop}: ${val} (${result.px}px) is not a multiple of 4px. Use multiples of 4px for consistent spacing rhythm.`,
            fix: `Change ${prop} to the nearest multiple of 4px (e.g. ${Math.round(result.px / 4) * 4}px).`,
          });
        } else if (!result.ok) {
          // Multiple of 4 but not 8 — rhythm break
          flagged.add(key);
          counter++;
          findings.push({
            id: `spacing-rhythm.${String(counter).padStart(3, '0')}`,
            severity: 'warning',
            rule: rule.id,
            location: 'document',
            finding: `${prop}: ${val} (${result.px}px) is not a multiple of 8px. Creates visual dissonance with the base spacing unit.`,
            fix: `Change ${prop} to the nearest multiple of 8px (e.g. ${Math.round(result.px / 8) * 8}px).`,
          });
        }
      }
    }

    return findings;
  },
};

export default rule;
