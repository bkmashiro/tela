/**
 * Rule: whitespace-balance
 * Checks section padding is symmetric (top ≈ bottom ± one token step).
 * Parses padding shorthand from inline styles.
 */

import type { CheckRule, CheckInput, CheckFinding } from '../types.js';
import { parsePx, parseAttrs } from '../html-utils.js';

interface SectionPadding {
  idx: number;
  top: number;
  bottom: number;
}

const TOKEN_STEP = 8; // 1 token step = 8px

function parsePaddingShorthand(val: string): { top: number; bottom: number } | null {
  const parts = val.trim().split(/\s+/);
  const nums: number[] = [];
  for (const part of parts) {
    if (part === 'auto' || part === 'inherit' || part === 'initial') continue;
    const px = parsePx(part);
    if (px === null) return null; // non-px unit — skip
    nums.push(px);
  }

  if (nums.length === 0) return null;
  if (nums.length === 1) return { top: nums[0], bottom: nums[0] };
  if (nums.length === 2) return { top: nums[0], bottom: nums[0] };
  if (nums.length === 3) return { top: nums[0], bottom: nums[2] };
  if (nums.length >= 4) return { top: nums[0], bottom: nums[2] };
  return null;
}

function getSectionPaddings(html: string): SectionPadding[] {
  const result: SectionPadding[] = [];
  const sectionRe = /<section([^>]*)>([\s\S]*?)<\/section>/gi;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = sectionRe.exec(html)) !== null) {
    const attrsStr = m[1];
    const styleMatch = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrsStr);
    if (styleMatch) {
      const styleStr = styleMatch[1] ?? styleMatch[2] ?? '';
      // Parse padding-related props
      let top = 0;
      let bottom = 0;
      let foundShorthand = false;

      // Try shorthand first
      const paddingMatch = /(?:^|;)\s*padding\s*:\s*([^;]+)/i.exec(styleStr);
      if (paddingMatch) {
        const parsed = parsePaddingShorthand(paddingMatch[1]);
        if (parsed) {
          top = parsed.top;
          bottom = parsed.bottom;
          foundShorthand = true;
        }
      }

      if (!foundShorthand) {
        // Try individual props
        const ptMatch = /(?:^|;)\s*padding-top\s*:\s*([^;]+)/i.exec(styleStr);
        const pbMatch = /(?:^|;)\s*padding-bottom\s*:\s*([^;]+)/i.exec(styleStr);
        if (ptMatch) top = parsePx(ptMatch[1].trim()) ?? 0;
        if (pbMatch) bottom = parsePx(pbMatch[1].trim()) ?? 0;
      }

      if (top > 0 || bottom > 0) {
        result.push({ idx, top, bottom });
      }
    }
    idx++;
  }
  return result;
}

const rule: CheckRule = {
  id: 'whitespace-balance',
  name: 'Whitespace Balance',
  severity: 'warning',

  check(input: CheckInput): CheckFinding[] {
    const findings: CheckFinding[] = [];
    const sections = getSectionPaddings(input.html);

    for (const section of sections) {
      const diff = Math.abs(section.top - section.bottom);
      if (diff > TOKEN_STEP) {
        findings.push({
          id: `whitespace-balance.${String(findings.length + 1).padStart(3, '0')}`,
          severity: 'warning',
          rule: rule.id,
          location: `section[${section.idx}]`,
          finding: `Section[${section.idx}] has asymmetric vertical padding: top=${section.top}px, bottom=${section.bottom}px (diff=${diff}px, threshold=${TOKEN_STEP}px). Creates visual imbalance.`,
          fix: `Make top and bottom padding equal or within ${TOKEN_STEP}px of each other. Consider using pad(${Math.round((section.top + section.bottom) / 2 / 8) * 8}px).`,
        });
      }
    }

    return findings;
  },
};

export default rule;
