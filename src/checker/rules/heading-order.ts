/**
 * Rule: heading-order
 * Verifies heading levels are sequential (no skipped levels).
 */

import type { CheckRule, CheckInput, CheckFinding } from '../types.js';

const rule: CheckRule = {
  id: 'heading-order',
  name: 'Heading Order',
  severity: 'warning',

  check(input: CheckInput): CheckFinding[] {
    const findings: CheckFinding[] = [];

    // Extract all headings in document order
    const headingRe = /<h([1-6])[\s>][^>]*>/gi;
    const headings: { level: number; pos: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = headingRe.exec(input.html)) !== null) {
      headings.push({ level: parseInt(m[1], 10), pos: m.index });
    }

    if (headings.length === 0) return findings;

    // Check for multiple h1
    const h1count = headings.filter((h) => h.level === 1).length;
    if (h1count > 1) {
      findings.push({
        id: `heading-order.${String(findings.length + 1).padStart(3, '0')}`,
        severity: 'warning',
        rule: rule.id,
        location: 'document',
        finding: `Multiple <h1> elements found (${h1count}). A page should have exactly one <h1>.`,
        fix: 'Change secondary h1 elements to h2 or lower.',
      });
    }

    // Check for skipped levels
    let prevLevel = 0;
    for (let i = 0; i < headings.length; i++) {
      const { level } = headings[i];
      if (prevLevel > 0 && level > prevLevel + 1) {
        // Determine which section this heading is in
        const sectionIdx = getSectionIndexForPos(input.html, headings[i].pos);
        const location = sectionIdx >= 0 ? `section[${sectionIdx}]` : 'document';
        findings.push({
          id: `heading-order.${String(findings.length + 1).padStart(3, '0')}`,
          severity: 'warning',
          rule: rule.id,
          location,
          finding: `Heading jumps from h${prevLevel} to h${level}. Screen readers expect sequential levels.`,
          fix: `Change h${level} to h${prevLevel + 1} to maintain heading sequence.`,
        });
      }
      prevLevel = level;
    }

    return findings;
  },
};

/**
 * Approximate which section (by data-section-id or nth section div) a position belongs to.
 * We look at `<section` or section wrapper tags before the position.
 */
function getSectionIndexForPos(html: string, pos: number): number {
  const sectionRe = /<section[\s>]/gi;
  let idx = -1;
  let m: RegExpExecArray | null;
  while ((m = sectionRe.exec(html)) !== null) {
    if (m.index > pos) break;
    idx++;
  }
  return idx;
}

export default rule;
