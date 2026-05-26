/**
 * Rule: line-length
 * For prose sections, checks that the container has max-width set.
 * Warns if no max-width constraint (unlimited line length).
 */

import type { CheckRule, CheckInput, CheckFinding } from '../types.js';
import { parseAttrs } from '../html-utils.js';

interface SectionChunk {
  idx: number;
  attrs: Record<string, string>;
  html: string;
}

function splitSections(html: string): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  const sectionRe = /<section([^>]*)>([\s\S]*?)<\/section>/gi;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = sectionRe.exec(html)) !== null) {
    chunks.push({
      idx: idx++,
      attrs: parseAttrs(m[1]),
      html: m[2],
    });
  }
  return chunks;
}

function isProse(sectionHtml: string, attrs: Record<string, string>): boolean {
  // Check data-block-type attribute
  if (attrs['data-block-type'] === 'prose') return true;
  if (attrs['data-type'] === 'prose') return true;
  if (attrs['class'] && /\bprose\b/.test(attrs['class'])) return true;

  // Heuristic: majority of direct text elements are prose-like
  const proseTagCount = (sectionHtml.match(/<(?:p|h[2-6]|blockquote|ul|ol)\b/gi) ?? []).length;
  return proseTagCount >= 2;
}

function hasMaxWidth(sectionHtml: string, sectionAttrs: Record<string, string>): boolean {
  // Check section's own style
  const sectionStyle = sectionAttrs['style'] ?? '';
  if (/max-width\s*:/i.test(sectionStyle)) return true;

  // Check for any inner container with max-width
  return /max-width\s*:[^;}"']+(?:px|rem|ch|em)/i.test(sectionHtml);
}

const rule: CheckRule = {
  id: 'line-length',
  name: 'Line Length',
  severity: 'warning',

  check(input: CheckInput): CheckFinding[] {
    const findings: CheckFinding[] = [];
    const sections = splitSections(input.html);

    for (const section of sections) {
      if (!isProse(section.html, section.attrs)) continue;

      if (!hasMaxWidth(section.html, section.attrs)) {
        findings.push({
          id: `line-length.${String(findings.length + 1).padStart(3, '0')}`,
          severity: 'warning',
          rule: rule.id,
          location: `section[${section.idx}]`,
          finding: `Prose section[${section.idx}] has no max-width constraint. Unlimited line length (> 85 characters) is hard to read.`,
          fix: 'Add a max-width constraint (e.g. max-width: 720px) or use the centered modifier to constrain line length.',
        });
      }
    }

    return findings;
  },
};

export default rule;
