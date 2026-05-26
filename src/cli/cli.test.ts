/**
 * Tests for CLI logic functions (parseArgs and formatReport).
 */

import { parseArgs, formatReport } from './index.js';
import type { CheckReport } from '../checker/types.js';

describe('parseArgs()', () => {
  it('parses render command with input file', () => {
    const result = parseArgs(['render', 'foo.tela']);
    expect(result.command).toBe('render');
    expect(result.input).toBe('foo.tela');
    expect(result.out).toBeUndefined();
  });

  it('parses render command with --out flag', () => {
    const result = parseArgs(['render', 'page.tela', '--out', './dist']);
    expect(result.command).toBe('render');
    expect(result.input).toBe('page.tela');
    expect(result.out).toBe('./dist');
  });

  it('parses check command', () => {
    const result = parseArgs(['check', 'document.tela']);
    expect(result.command).toBe('check');
    expect(result.input).toBe('document.tela');
  });

  it('parses extract command with --out flag', () => {
    const result = parseArgs(['extract', 'index.html', '--out', 'extracted.tela']);
    expect(result.command).toBe('extract');
    expect(result.input).toBe('index.html');
    expect(result.out).toBe('extracted.tela');
  });

  it('parses extract command without --out (prints to stdout)', () => {
    const result = parseArgs(['extract', 'index.html']);
    expect(result.command).toBe('extract');
    expect(result.input).toBe('index.html');
    expect(result.out).toBeUndefined();
  });

  it('returns help for --help flag', () => {
    const result = parseArgs(['--help']);
    expect(result.command).toBe('help');
  });

  it('returns help for -h flag', () => {
    const result = parseArgs(['-h']);
    expect(result.command).toBe('help');
  });

  it('returns help for empty args', () => {
    const result = parseArgs([]);
    expect(result.command).toBe('help');
  });

  it('returns help for unknown command', () => {
    const result = parseArgs(['unknown']);
    expect(result.command).toBe('help');
  });

  it('strips node and script path when present', () => {
    const result = parseArgs(['/usr/bin/node', '/path/to/cli.js', 'render', 'foo.tela']);
    expect(result.command).toBe('render');
    expect(result.input).toBe('foo.tela');
  });
});

describe('formatReport()', () => {
  it('formats a clean report with no issues', () => {
    const report: CheckReport = {
      score: 100,
      summary: 'No issues found.',
      checks: [],
      patches: new Map(),
    };
    const output = formatReport(report);
    expect(output).toContain('Score: 100/100');
    expect(output).toContain('No issues found.');
  });

  it('formats a report with warnings', () => {
    const report: CheckReport = {
      score: 84,
      summary: '0 error(s), 2 warning(s)',
      checks: [
        {
          id: 'spacing-rhythm.001',
          severity: 'warning',
          rule: 'spacing-rhythm',
          location: 'features.grid',
          finding: 'gap(16px) conflicts with base unit (24px).',
          fix: 'Change gap modifier to lg or xl',
        },
      ],
      patches: new Map(),
    };
    const output = formatReport(report);
    expect(output).toContain('Score: 84/100');
    expect(output).toContain('spacing-rhythm.001');
    expect(output).toContain('features.grid');
    expect(output).toContain('⚠');
    expect(output).toContain('Fix: Change gap modifier to lg or xl');
  });

  it('formats a report with errors', () => {
    const report: CheckReport = {
      score: 50,
      summary: '1 error(s), 0 warning(s)',
      checks: [
        {
          id: 'unfilled-slots.001',
          severity: 'error',
          rule: 'unfilled-slots',
          location: 'section[0]',
          finding: 'Unfilled placeholder: {{PLACEHOLDER}}',
          fix: 'Replace {{PLACEHOLDER}} with actual content',
        },
      ],
      patches: new Map(),
    };
    const output = formatReport(report);
    expect(output).toContain('Score: 50/100');
    expect(output).toContain('✗');
    expect(output).toContain('unfilled-slots.001');
  });

  it('formats a report with mixed severity findings', () => {
    const report: CheckReport = {
      score: 72,
      summary: '1 error(s), 1 warning(s)',
      checks: [
        {
          id: 'unfilled-slots.001',
          severity: 'error',
          rule: 'unfilled-slots',
          location: 'section[0]',
          finding: 'Unfilled placeholder detected.',
          fix: 'Fill in the placeholder.',
        },
        {
          id: 'heading-order.001',
          severity: 'warning',
          rule: 'heading-order',
          location: 'document',
          finding: 'Heading jumps from h1 to h3.',
          fix: 'Change h3 to h2.',
        },
      ],
      patches: new Map(),
    };
    const output = formatReport(report);
    expect(output).toContain('✗');
    expect(output).toContain('⚠');
    expect(output).toContain('unfilled-slots.001');
    expect(output).toContain('heading-order.001');
  });
});
