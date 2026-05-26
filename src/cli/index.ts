#!/usr/bin/env node
/**
 * Tela CLI — render, check, and extract Tela documents.
 *
 * Commands:
 *   tela render <file.tela> [--out <dir>]
 *   tela check <file.tela>
 *   tela extract <file.html> [--out <file.tela>]
 *   tela --help
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../parser/index.js';
import { compile, render } from '../renderer/index.js';
import { runChecks } from '../checker/index.js';
import { extract } from '../extractor/index.js';
import type { CheckReport } from '../checker/types.js';

// ─── Argument parsing ─────────────────────────────────────────────────────────

export interface ParsedArgs {
  command: 'render' | 'check' | 'extract' | 'help';
  input: string;
  out?: string;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];

  // Strip node and script path if present
  if (args[0]?.endsWith('node') || args[0]?.endsWith('node.exe')) args.shift();
  if (args[0]?.includes('cli')) args.shift();

  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    return { command: 'help', input: '' };
  }

  if (cmd !== 'render' && cmd !== 'check' && cmd !== 'extract') {
    return { command: 'help', input: '' };
  }

  const input = args[1] ?? '';
  let out: string | undefined;

  // Parse --out flag
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1 && args[outIdx + 1]) {
    out = args[outIdx + 1];
  }

  return { command: cmd, input, out };
}

// ─── Report formatting ────────────────────────────────────────────────────────

export function formatReport(report: CheckReport): string {
  const lines: string[] = [];
  lines.push(`Score: ${report.score}/100`);
  lines.push('');

  if (report.checks.length === 0) {
    lines.push('No issues found.');
    return lines.join('\n');
  }

  for (const finding of report.checks) {
    const icon = finding.severity === 'error' ? '✗' :
                 finding.severity === 'warning' ? '⚠' : '✓';
    lines.push(`${icon} ${finding.id} [${finding.location}]`);
    lines.push(`  ${finding.finding}`);
    if (finding.fix) {
      lines.push(`  Fix: ${finding.fix}`);
    }
    lines.push('');
  }

  // Add passing rules summary if there are no failures
  const passing = report.checks.filter(f => f.severity === 'pass');
  const failing = report.checks.filter(f => f.severity !== 'pass');

  if (passing.length > 0 && failing.length === 0) {
    for (const p of passing) {
      lines.push(`✓ ${p.rule} — OK`);
    }
  }

  return lines.join('\n').trimEnd();
}

// ─── Command implementations ──────────────────────────────────────────────────

function printHelp(): void {
  console.log(`
Tela — LLM-native HTML page composer

Usage:
  tela render <file.tela> [--out <dir>]    Render .tela file to HTML
  tela check  <file.tela>                  Check a .tela file for issues
  tela extract <file.html> [--out <file>]  Extract .tela from existing HTML
  tela --help                              Show this help

Examples:
  tela render page.tela --out ./dist
  tela check page.tela
  tela extract existing.html --out extracted.tela
`.trim());
}

function cmdRender(input: string, outDir?: string): void {
  if (!input) {
    console.error('Error: No input file specified.');
    process.exit(1);
  }

  const inputPath = path.resolve(input);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(inputPath, 'utf8');
  const ast = parse(source, { file: inputPath });
  const tree = compile(ast);
  const result = render(tree);

  const resolvedOutDir = outDir
    ? path.resolve(outDir)
    : path.dirname(inputPath);

  fs.mkdirSync(resolvedOutDir, { recursive: true });

  const basename = path.basename(inputPath, path.extname(inputPath));
  const outPath = path.join(resolvedOutDir, `${basename}.html`);

  fs.writeFileSync(outPath, result.html, 'utf8');

  const relPath = path.relative(process.cwd(), outPath);
  console.log(`✓ Rendered to ./${relPath}`);
}

function cmdCheck(input: string): void {
  if (!input) {
    console.error('Error: No input file specified.');
    process.exit(1);
  }

  const inputPath = path.resolve(input);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(inputPath, 'utf8');
  const ast = parse(source, { file: inputPath });
  const tree = compile(ast);
  const renderResult = render(tree);

  const sectionIds = ast.sections.map((s) => s.id);
  const report = runChecks({
    html: renderResult.html,
    document: ast,
    sectionIds,
  });

  console.log(formatReport(report));
}

function cmdExtract(input: string, outFile?: string): void {
  if (!input) {
    console.error('Error: No input file specified.');
    process.exit(1);
  }

  const inputPath = path.resolve(input);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  const html = fs.readFileSync(inputPath, 'utf8');
  const result = extract(html);

  if (outFile) {
    const outPath = path.resolve(outFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, result.tela, 'utf8');

    const relPath = path.relative(process.cwd(), outPath);
    console.log(`✓ Extracted to ./${relPath}`);
  } else {
    // Print to stdout
    console.log(result.tela);
  }

  // Print confidence summary to stderr (so it doesn't interfere with stdout tela output)
  const stream = outFile ? process.stdout : process.stderr;
  stream.write(`\nConfidence: ${(result.overallConfidence * 100).toFixed(0)}%\n`);
  stream.write(`Sections: ${result.sections.length}\n`);

  if (result.warnings.length > 0) {
    stream.write('Warnings:\n');
    for (const w of result.warnings) {
      stream.write(`  ⚠ ${w}\n`);
    }
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function main(argv: string[] = process.argv): void {
  const parsed = parseArgs(argv.slice(2));

  switch (parsed.command) {
    case 'render':
      cmdRender(parsed.input, parsed.out);
      break;
    case 'check':
      cmdCheck(parsed.input);
      break;
    case 'extract':
      cmdExtract(parsed.input, parsed.out);
      break;
    case 'help':
    default:
      printHelp();
      break;
  }
}

// Run if invoked directly
main();
