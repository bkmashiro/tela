/**
 * Rule: alt-text
 * Finds <img> tags without alt attribute or with empty alt.
 */

import type { CheckRule, CheckInput, CheckFinding } from '../types.js';
import { findTags } from '../html-utils.js';

const rule: CheckRule = {
  id: 'alt-text',
  name: 'Alt Text',
  severity: 'warning',

  check(input: CheckInput): CheckFinding[] {
    const findings: CheckFinding[] = [];
    const imgs = findTags(input.html, 'img');

    for (const img of imgs) {
      const hasAlt = 'alt' in img.attrs;
      const altValue = img.attrs['alt'] ?? '';

      if (!hasAlt || altValue === '') {
        const sectionIdx = getSectionIndexForPos(input.html, img.pos);
        const location = sectionIdx >= 0 ? `section[${sectionIdx}]` : 'document';
        const src = img.attrs['src'] ?? 'unknown';

        findings.push({
          id: `alt-text.${String(findings.length + 1).padStart(3, '0')}`,
          severity: 'warning',
          rule: rule.id,
          location,
          finding: !hasAlt
            ? `Image "${src}" has no alt attribute. Add a description for screen readers.`
            : `Image "${src}" has an empty alt attribute. Add a meaningful description or confirm it is decorative.`,
          fix: `Add an alt property describing the image: figure: ${src} | alt('Description of image')`,
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
