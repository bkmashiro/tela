/**
 * Rule: grid-consistency
 * For grid sections, checks that grid-template-columns is defined and not 'auto'.
 */

import type { CheckRule, CheckInput, CheckFinding } from '../types.js';
import { parseAttrs } from '../html-utils.js';

const rule: CheckRule = {
  id: 'grid-consistency',
  name: 'Grid Consistency',
  severity: 'warning',

  check(input: CheckInput): CheckFinding[] {
    const findings: CheckFinding[] = [];

    // Find elements with display: grid in inline styles
    const styleTagRe = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
    // We need to find the full opening tag to also get other attributes
    const tagRe = /<(\w+)([^>]*)>/gi;
    let m: RegExpExecArray | null;
    let counter = 0;

    while ((m = tagRe.exec(input.html)) !== null) {
      const tagName = m[1];
      const attrsStr = m[2];

      const styleMatch = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrsStr);
      if (!styleMatch) continue;

      const styleStr = styleMatch[1] ?? styleMatch[2] ?? '';
      if (!/display\s*:\s*grid/i.test(styleStr)) continue;

      // It's a grid — check for grid-template-columns
      const hasTemplateCols = /grid-template-columns\s*:/i.test(styleStr);
      const templateColVal = hasTemplateCols
        ? (/grid-template-columns\s*:\s*([^;]+)/i.exec(styleStr)?.[1]?.trim() ?? '')
        : '';
      const isAuto = !hasTemplateCols || templateColVal.toLowerCase() === 'auto' || templateColVal === '';

      if (isAuto) {
        const attrs = parseAttrs(attrsStr);
        const sectionId = attrs['data-section-id'] ?? attrs['id'] ?? '';
        // Find section index by looking at position
        const pos = m.index;
        const sectionIdx = getSectionIndexForPos(input.html, pos);
        const location = sectionIdx >= 0 ? `section[${sectionIdx}].${tagName}` : tagName;

        counter++;
        findings.push({
          id: `grid-consistency.${String(counter).padStart(3, '0')}`,
          severity: 'warning',
          rule: rule.id,
          location: sectionId ? `section.${sectionId}` : location,
          finding: hasTemplateCols
            ? `Grid element in ${location} has grid-template-columns: auto. Define explicit column widths for predictable layout.`
            : `Grid element in ${location} has no grid-template-columns defined. Browser will default to single-column layout.`,
          fix: 'Add explicit grid-template-columns (e.g. repeat(3, 1fr)) to define the grid structure.',
        });
      }
    }

    return findings;
  },
};

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
