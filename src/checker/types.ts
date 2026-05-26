/**
 * Checker types for Tela's structural validation engine.
 */

import type { TelaDocument } from '../ast/types.js';

export interface CheckInput {
  html: string;          // rendered HTML
  document: TelaDocument; // parsed AST
  sectionIds: string[];
}

export interface CheckFinding {
  id: string;            // e.g. "spacing-rhythm.001"
  severity: 'error' | 'warning' | 'pass';
  rule: string;
  location: string;      // e.g. "section[1].grid"
  finding: string;       // human-readable description
  fix: string;           // what to change
  patch?: AstPatch;      // optional machine-applicable patch
}

export interface AstPatch {
  sectionId: string;
  path: string;          // dot-path to the thing to change
  op: 'set' | 'replace-modifier' | 'remove-modifier' | 'add-modifier';
  value?: unknown;
}

export interface CheckReport {
  score: number;         // 0-100
  summary: string;
  checks: CheckFinding[];
  patches: Map<string, AstPatch>; // fix_id → patch (for apply_fix)
}

export interface CheckRule {
  id: string;
  name: string;
  severity: 'error' | 'warning';
  check(input: CheckInput): CheckFinding[];
}
