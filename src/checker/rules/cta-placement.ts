/**
 * Rule: cta-placement
 * Checks that at least one CTA element exists in the first 40% of sections.
 * Warns if all CTAs are in the bottom 60%.
 */

import type { CheckRule, CheckInput, CheckFinding } from '../types.js';
import { parseAttrs } from '../html-utils.js';

interface SectionChunk {
  idx: number;
  html: string;
}

function splitSections(html: string): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  const sectionRe = /<section([^>]*)>([\s\S]*?)<\/section>/gi;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = sectionRe.exec(html)) !== null) {
    chunks.push({ idx: idx++, html: m[2] });
  }
  if (chunks.length === 0) {
    chunks.push({ idx: 0, html });
  }
  return chunks;
}

function hasCta(sectionHtml: string): boolean {
  // role=button
  if (/role\s*=\s*(?:"|')button(?:"|')/i.test(sectionHtml)) return true;
  // class containing "cta"
  if (/class\s*=\s*(?:"[^"]*\bcta\b[^"]*"|'[^']*\bcta\b[^']*')/i.test(sectionHtml)) return true;
  return false;
}

const rule: CheckRule = {
  id: 'cta-placement',
  name: 'CTA Placement',
  severity: 'warning',

  check(input: CheckInput): CheckFinding[] {
    const findings: CheckFinding[] = [];
    const sections = splitSections(input.html);
    const total = sections.length;

    if (total === 0) return findings;

    // Determine which sections have CTAs
    const ctaSections = sections.filter((s) => hasCta(s.html));

    if (ctaSections.length === 0) {
      // No CTAs at all — no CTA placement issue per se, skip (alt check in another rule)
      return findings;
    }

    // Check if any CTA is in first 40% of sections
    const cutoff = Math.max(1, Math.floor(total * 0.4));
    const hasCtaAboveFold = ctaSections.some((s) => s.idx < cutoff);

    if (!hasCtaAboveFold) {
      findings.push({
        id: `cta-placement.001`,
        severity: 'warning',
        rule: rule.id,
        location: 'document',
        finding: `All CTAs are in the bottom ${100 - 40}% of sections (below the fold). Users who don't scroll will miss the conversion prompt.`,
        fix: 'Add a CTA button to the hero section, or insert a CTA section in the first 40% of the page.',
      });
    }

    return findings;
  },
};

export default rule;
