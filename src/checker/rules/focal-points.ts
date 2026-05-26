/**
 * Rule: focal-points
 * Counts high-emphasis elements per section.
 * Warns if count > 2 per section.
 */

import type { CheckRule, CheckInput, CheckFinding } from '../types.js';
import { parsePx, parseAttrs } from '../html-utils.js';

interface SectionChunk {
  idx: number;
  html: string;
  sectionId?: string;
}

/** Split HTML into per-section chunks using <section> boundaries. */
function splitSections(html: string): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  const sectionRe = /<section([^>]*)>([\s\S]*?)<\/section>/gi;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = sectionRe.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    chunks.push({
      idx: idx++,
      html: m[2],
      sectionId: attrs['data-section-id'] ?? attrs['id'],
    });
  }
  // If no sections found, treat whole HTML as one section
  if (chunks.length === 0) {
    chunks.push({ idx: 0, html });
  }
  return chunks;
}

/** Count focal points in a section's HTML. */
function countFocalPoints(sectionHtml: string): number {
  let count = 0;

  // 1. Elements with font-size >= 32px in inline styles
  const styleRe = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = styleRe.exec(sectionHtml)) !== null) {
    const styleStr = m[1] ?? m[2] ?? '';
    const fsMatch = /font-size\s*:\s*([\d.]+(?:px|rem))/i.exec(styleStr);
    if (fsMatch) {
      const px = parsePx(fsMatch[1]);
      if (px !== null && px >= 32) {
        count++;
        continue;
      }
    }
    const fwMatch = /font-weight\s*:\s*(\d+|bold|bolder)/i.exec(styleStr);
    if (fwMatch) {
      const fw = fwMatch[1];
      const fwNum = fw === 'bold' || fw === 'bolder' ? 700 : parseInt(fw, 10);
      if (fwNum >= 700) count++;
    }
  }

  // 2. Elements with .cta-primary class
  const ctaRe = /class\s*=\s*(?:"[^"]*cta-primary[^"]*"|'[^']*cta-primary[^']*')/gi;
  while ((m = ctaRe.exec(sectionHtml)) !== null) {
    count++;
  }

  return count;
}

const rule: CheckRule = {
  id: 'focal-points',
  name: 'Focal Points',
  severity: 'warning',

  check(input: CheckInput): CheckFinding[] {
    const findings: CheckFinding[] = [];
    const sections = splitSections(input.html);

    for (const section of sections) {
      const count = countFocalPoints(section.html);
      if (count > 2) {
        findings.push({
          id: `focal-points.${String(findings.length + 1).padStart(3, '0')}`,
          severity: 'warning',
          rule: rule.id,
          location: `section[${section.idx}]`,
          finding: `${count} competing focal points in section[${section.idx}]. Too many high-emphasis elements dilute attention.`,
          fix: 'Reduce to at most 2 focal points per section. Consider downscaling secondary headings or removing redundant CTAs.',
        });
      }
    }

    return findings;
  },
};

export default rule;
