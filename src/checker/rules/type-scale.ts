/**
 * Rule: type-scale
 * Checks that font-size values follow an approximate 1.25× geometric progression.
 * Warns if more than 2 sizes deviate by more than ±15%.
 */

import type { CheckRule, CheckInput, CheckFinding } from '../types.js';
import { extractAllStyles, parsePx } from '../html-utils.js';

const RATIO = 1.25;
const TOLERANCE = 0.15; // ±15%

const rule: CheckRule = {
  id: 'type-scale',
  name: 'Type Scale',
  severity: 'warning',

  check(input: CheckInput): CheckFinding[] {
    const findings: CheckFinding[] = [];

    // Collect all font-size px values
    const styles = extractAllStyles(input.html);
    const rawSizes = new Set<number>();
    for (const style of styles) {
      const fs = style['font-size'];
      if (fs) {
        const px = parsePx(fs);
        if (px !== null && px > 0) rawSizes.add(Math.round(px));
      }
    }

    const sizes = [...rawSizes].sort((a, b) => a - b);
    if (sizes.length < 2) return findings; // need at least 2 to check scale

    // Build ideal geometric scale anchored at the smallest size
    const base = sizes[0];
    let deviating = 0;
    const deviatingList: string[] = [];

    for (let i = 1; i < sizes.length; i++) {
      // Expected size at step i assuming 1.25× ratio from base
      const steps = Math.round(Math.log(sizes[i] / base) / Math.log(RATIO));
      const expected = base * Math.pow(RATIO, steps);
      const ratio = sizes[i] / expected;
      if (ratio < 1 - TOLERANCE || ratio > 1 + TOLERANCE) {
        deviating++;
        deviatingList.push(`${sizes[i]}px`);
      }
    }

    if (deviating > 2) {
      findings.push({
        id: `type-scale.001`,
        severity: 'warning',
        rule: rule.id,
        location: 'document',
        finding: `${deviating} font sizes deviate from a 1.25× geometric scale: ${deviatingList.join(', ')}. Inconsistent type scale harms visual rhythm.`,
        fix: 'Align font sizes to the theme type scale tokens (base × 1.25^n).',
      });
    }

    return findings;
  },
};

export default rule;
