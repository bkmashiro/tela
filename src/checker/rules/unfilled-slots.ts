/**
 * Rule: unfilled-slots
 * Scans HTML for {{...}} patterns — unfilled template placeholders.
 */

import type { CheckRule, CheckInput, CheckFinding } from '../types.js';

const rule: CheckRule = {
  id: 'unfilled-slots',
  name: 'Unfilled Slots',
  severity: 'error',

  check(input: CheckInput): CheckFinding[] {
    const findings: CheckFinding[] = [];
    const re = /\{\{([^}]+)\}\}/g;
    let m: RegExpExecArray | null;
    let counter = 0;
    while ((m = re.exec(input.html)) !== null) {
      counter++;
      const name = m[1].trim();
      findings.push({
        id: `unfilled-slots.${String(counter).padStart(3, '0')}`,
        severity: 'error',
        rule: rule.id,
        location: 'document',
        finding: `Unfilled placeholder: {{${name}}}`,
        fix: `Replace {{${name}}} with actual content`,
      });
    }
    return findings;
  },
};

export default rule;
