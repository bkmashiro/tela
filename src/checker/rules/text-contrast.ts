/**
 * Rule: text-contrast
 * Computes WCAG contrast ratio for color/background-color pairs in inline styles.
 * Parses hex colors only.
 */

import type { CheckRule, CheckInput, CheckFinding } from '../types.js';
import { extractAllStyles } from '../html-utils.js';

/** Parse a hex color (#rgb, #rrggbb) to [r, g, b] in 0-255. */
function parseHex(hex: string): [number, number, number] | null {
  const h = hex.trim();
  if (h.startsWith('#')) {
    if (h.length === 4) {
      const r = parseInt(h[1] + h[1], 16);
      const g = parseInt(h[2] + h[2], 16);
      const b = parseInt(h[3] + h[3], 16);
      return [r, g, b];
    }
    if (h.length === 7) {
      const r = parseInt(h.slice(1, 3), 16);
      const g = parseInt(h.slice(3, 5), 16);
      const b = parseInt(h.slice(5, 7), 16);
      return [r, g, b];
    }
  }
  return null;
}

/** Linearize an 8-bit sRGB channel value. */
function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Compute WCAG relative luminance. */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Compute WCAG contrast ratio between two luminances. */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const rule: CheckRule = {
  id: 'text-contrast',
  name: 'Text Contrast',
  severity: 'error',

  check(input: CheckInput): CheckFinding[] {
    const findings: CheckFinding[] = [];

    const styles = extractAllStyles(input.html);
    let counter = 0;

    for (const style of styles) {
      const colorStr = style['color'];
      const bgStr = style['background-color'];

      if (!colorStr || !bgStr) continue;

      const fg = parseHex(colorStr);
      const bg = parseHex(bgStr);

      if (!fg || !bg) continue; // skip non-hex

      const fgL = luminance(...fg);
      const bgL = luminance(...bg);
      const ratio = contrastRatio(fgL, bgL);

      // AA large text minimum: 3.0; AA normal text: 4.5
      if (ratio < 3.0) {
        counter++;
        findings.push({
          id: `text-contrast.${String(counter).padStart(3, '0')}`,
          severity: 'error',
          rule: rule.id,
          location: 'document',
          finding: `Color pair ${colorStr} on ${bgStr} has contrast ratio ${ratio.toFixed(2)}:1, below WCAG AA large text minimum (3.0:1).`,
          fix: `Increase contrast between text color (${colorStr}) and background (${bgStr}) to at least 4.5:1 for normal text or 3.0:1 for large text.`,
        });
      } else if (ratio < 4.5) {
        counter++;
        findings.push({
          id: `text-contrast.${String(counter).padStart(3, '0')}`,
          severity: 'warning',
          rule: rule.id,
          location: 'document',
          finding: `Color pair ${colorStr} on ${bgStr} has contrast ratio ${ratio.toFixed(2)}:1, below WCAG AA normal text minimum (4.5:1).`,
          fix: `Increase contrast between text color (${colorStr}) and background (${bgStr}) to at least 4.5:1.`,
        });
      }
    }

    return findings;
  },
};

export default rule;
