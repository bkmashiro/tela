/**
 * Tela Checker — runs all 11 structural validation rules and produces a CheckReport.
 */

import type { CheckInput, CheckReport, CheckFinding, AstPatch, CheckRule } from './types.js';
import unfilledSlots from './rules/unfilled-slots.js';
import headingOrder from './rules/heading-order.js';
import altText from './rules/alt-text.js';
import typeScale from './rules/type-scale.js';
import textContrast from './rules/text-contrast.js';
import spacingRhythm from './rules/spacing-rhythm.js';
import focalPoints from './rules/focal-points.js';
import ctaPlacement from './rules/cta-placement.js';
import whitespaceBalance from './rules/whitespace-balance.js';
import lineLength from './rules/line-length.js';
import gridConsistency from './rules/grid-consistency.js';

export type { CheckInput, CheckReport, CheckFinding, AstPatch, CheckRule } from './types.js';

const ALL_RULES: CheckRule[] = [
  unfilledSlots,
  headingOrder,
  altText,
  typeScale,
  textContrast,
  spacingRhythm,
  focalPoints,
  ctaPlacement,
  whitespaceBalance,
  lineLength,
  gridConsistency,
];

// Score penalties per the spec
const ERROR_PENALTY = 20;
const WARNING_PENALTY = 8;

/** Run all checker rules and produce a CheckReport. */
export function runChecks(input: CheckInput): CheckReport {
  const allFindings: CheckFinding[] = [];

  for (const rule of ALL_RULES) {
    const findings = rule.check(input);
    allFindings.push(...findings);
  }

  // Compute score
  const errorCount = allFindings.filter((f) => f.severity === 'error').length;
  const warningCount = allFindings.filter((f) => f.severity === 'warning').length;

  const score = Math.max(0, 100 - errorCount * ERROR_PENALTY - warningCount * WARNING_PENALTY);

  // Build patches map
  const patches = new Map<string, AstPatch>();
  for (const finding of allFindings) {
    if (finding.patch) {
      patches.set(finding.id, finding.patch);
    }
  }

  // Generate summary
  const summary = buildSummary(allFindings, score);

  return {
    score,
    summary,
    checks: allFindings,
    patches,
  };
}

function buildSummary(findings: CheckFinding[], score: number): string {
  if (findings.length === 0) {
    return 'No issues found. Document is production ready.';
  }

  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');

  // Find most impactful finding (errors first, then warnings)
  const topFinding = errors[0] ?? warnings[0];
  const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';

  const parts: string[] = [`Score: ${score}/100 (${label}).`];
  if (errors.length > 0) parts.push(`${errors.length} error(s).`);
  if (warnings.length > 0) parts.push(`${warnings.length} warning(s).`);
  if (topFinding) parts.push(`Most critical: ${topFinding.finding}`);

  return parts.join(' ');
}
