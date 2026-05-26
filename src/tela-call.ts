#!/usr/bin/env node
/**
 * tela-call — thin JSON in/out CLI wrapper around DocumentStore + all MCP tools.
 *
 * Usage:
 *   node dist/tela-call.js <tool_name> '<json_args>'
 *
 * Session state persists automatically to ~/.tela/sessions/ between calls.
 *
 * Examples:
 *   node dist/tela-call.js create_document '{"theme":"warm-editorial"}'
 *   node dist/tela-call.js add_section '{"doc_id":"doc-000","tela_fragment":"hero | centered pad(xl):\n  headline: Hello"}'
 *   node dist/tela-call.js render '{"doc_id":"doc-000"}'
 *   node dist/tela-call.js check '{"doc_id":"doc-000"}'
 *   node dist/tela-call.js list_documents '{}'
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { DocumentStore } from './mcp/store.js';
import { runChecks } from './checker/index.js';
import type { CheckReport } from './checker/types.js';
import { extract } from './extractor/index.js';
import { listComponents } from './primitives/index.js';
import { THEME_PRESETS } from './tokens/presets.js';
import { THEME_NAMES } from './tokens/types.js';

// ─── Persistent store (restored from ~/.tela/sessions/) ──────────────────────

const store = new DocumentStore();
store.restoreSessions();

// ─── Per-doc check report cache (written to ~/.tela/reports/) ────────────────

const reportsDir = path.join(os.homedir(), '.tela', 'reports');

function saveReport(docId: string, report: CheckReport): void {
  fs.mkdirSync(reportsDir, { recursive: true });
  const serializable = {
    score: report.score,
    summary: report.summary,
    checks: report.checks,
    patches: Object.fromEntries(report.patches),
  };
  fs.writeFileSync(path.join(reportsDir, `${docId}.json`), JSON.stringify(serializable, null, 2));
}

function loadReport(docId: string): CheckReport | null {
  const p = path.join(reportsDir, `${docId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as {
      score: number;
      summary: string;
      checks: CheckReport['checks'];
      patches: Record<string, CheckReport['patches'] extends Map<string, infer V> ? V : never>;
    };
    return {
      score: raw.score,
      summary: raw.summary,
      checks: raw.checks,
      patches: new Map(Object.entries(raw.patches)),
    };
  } catch {
    return null;
  }
}

// ─── Modifier vocabulary (mirrors server.ts) ─────────────────────────────────

const MODIFIER_VOCAB = [
  { name: 'pad', description: 'Padding size', values: ['xs', 'sm', 'md', 'lg', 'xl', 'section'] },
  { name: 'gap', description: 'Gap between children', values: ['xs', 'sm', 'md', 'lg', 'xl'] },
  { name: 'bg', description: 'Background token', values: ['surface.default', 'surface.elevated', 'surface.inverted', 'surface.warm'] },
  { name: 'rounded', description: 'Border radius (boolean)', values: [] },
  { name: 'shadow', description: 'Box shadow level', values: ['sm', 'md', 'lg'] },
  { name: 'bleed', description: 'Full-width bleed (boolean)', values: [] },
  { name: 'aspect', description: 'Aspect ratio (w/h)', values: ['1/1', '4/3', '16/9', '3/2'] },
  { name: 'accent', description: 'Accent color role (boolean)', values: [] },
  { name: 'muted', description: 'Muted color role (boolean)', values: [] },
  { name: 'inverted', description: 'Inverted color scheme (boolean)', values: [] },
  { name: 'role', description: 'CTA button role', values: ['primary', 'ghost', 'danger'] },
  { name: 'centered', description: 'Center content horizontally (boolean)', values: [] },
  { name: 'split', description: 'Horizontal split ratio', values: ['50/50', '60/40', '40/60', '70/30'] },
  { name: 'grid', description: 'Number of columns', values: ['2', '3', '4'] },
];

// ─── Tool dispatch ────────────────────────────────────────────────────────────

type Args = Record<string, unknown>;

async function dispatch(tool: string, a: Args): Promise<unknown> {
  switch (tool) {
    case 'create_document':
      return store.createDocument({
        theme: (a['theme'] as string | undefined) ?? 'warm-editorial',
        mode: (a['mode'] as 'landing' | 'article' | 'docs' | undefined) ?? 'landing',
        lang: (a['lang'] as string | undefined) ?? 'en',
      });

    case 'open_document':
      return store.openDocument(a['path'] as string);

    case 'save_document':
      return { saved_path: store.saveDocument(a['doc_id'] as string, a['path'] as string | undefined) };

    case 'list_documents':
      return store.listDocuments();

    case 'undo':
      return { restored: store.undo(a['doc_id'] as string) };

    case 'add_section': {
      const secId = store.addSection(
        a['doc_id'] as string,
        a['tela_fragment'] as string,
        a['position'] as number | undefined,
      );
      return { section_id: secId };
    }

    case 'update_section': {
      store.updateSection(a['doc_id'] as string, a['section_id'] as string, a['tela_fragment'] as string);
      return { success: true };
    }

    case 'remove_section': {
      store.removeSection(a['doc_id'] as string, a['section_id'] as string);
      return { success: true };
    }

    case 'reorder_sections': {
      store.reorderSections(a['doc_id'] as string, a['section_ids'] as string[]);
      return { success: true };
    }

    case 'set_theme': {
      store.setTheme(a['doc_id'] as string, a['theme_spec'] as string);
      return { success: true };
    }

    case 'get_section':
      return store.getSection(a['doc_id'] as string, a['section_id'] as string);

    case 'update_block': {
      store.updateBlock(a['doc_id'] as string, a['path'] as string, a['props'] as Record<string, unknown>);
      return { success: true };
    }

    case 'render': {
      const result = store.renderDocument(a['doc_id'] as string);
      const outDir = (a['out_dir'] as string | undefined) ?? path.join(os.tmpdir(), 'tela');
      fs.mkdirSync(outDir, { recursive: true });
      const htmlPath = path.join(outDir, `${a['doc_id']}.html`);
      fs.writeFileSync(htmlPath, result.html, 'utf8');

      let screenshotPath: string | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { default: puppeteer } = await import('puppeteer' as any) as any;
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });
        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
        screenshotPath = path.join(outDir, `${a['doc_id']}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await browser.close();
      } catch {
        // puppeteer not available — skip screenshot
      }

      return { html_path: htmlPath, screenshot_path: screenshotPath, section_ids: result.sectionIds };
    }

    case 'check': {
      const docId = a['doc_id'] as string;
      const doc = store.getDocument(docId);
      const renderResult = store.renderDocument(docId);
      const report = runChecks({ html: renderResult.html, document: doc.ast, sectionIds: renderResult.sectionIds });
      saveReport(docId, report);
      return {
        score: report.score,
        summary: report.summary,
        checks: report.checks,
        patchCount: report.patches.size,
      };
    }

    case 'apply_fix': {
      const docId = a['doc_id'] as string;
      const fixId = a['fix_id'] as string;
      const report = loadReport(docId);
      if (!report) return { error: 'No check report found. Run check() first.' };
      const patch = report.patches.get(fixId);
      if (!patch) return { error: `No auto-applicable patch for "${fixId}". Fix manually.` };

      const doc = store.getDocument(docId);
      const section = doc.ast.sections.find((s) => s.id === patch.sectionId);
      if (!section) return { error: `Section "${patch.sectionId}" not found.` };

      if (patch.op === 'set' && patch.path && patch.value !== undefined) {
        store.updateBlock(docId, `${patch.sectionId}.${patch.path}`, {
          [patch.path.split('.').pop()!]: patch.value,
        });
      } else if (patch.op === 'replace-modifier' || patch.op === 'add-modifier') {
        const [modName] = patch.path.split('.');
        const existingIdx = section.block.modifiers.findIndex((m) => m.name === modName);
        const newMod = {
          type: 'modifier' as const,
          name: modName,
          args: Array.isArray(patch.value) ? (patch.value as (string | number)[]) : [patch.value as string | number],
          source: { line: 0, column: 0 },
        };
        if (existingIdx >= 0) {
          section.block.modifiers[existingIdx] = newMod;
        } else {
          section.block.modifiers.push(newMod);
        }
      } else if (patch.op === 'remove-modifier') {
        const [modName] = patch.path.split('.');
        section.block.modifiers = section.block.modifiers.filter((m) => m.name !== modName);
      }

      return { applied: true, fix_id: fixId, section_id: patch.sectionId };
    }

    case 'list_components':
      return listComponents();

    case 'list_themes':
      return THEME_NAMES.map((name) => ({
        name,
        tokens: THEME_PRESETS[name] ?? {},
      }));

    case 'list_modifiers':
      return MODIFIER_VOCAB;

    case 'extract_html': {
      const html = a['html'] as string;
      if (!html) throw new Error('extract_html requires "html" parameter');
      return extract(html);
    }

    default:
      throw new Error(`Unknown tool: ${tool}. Run with --help to see available tools.`);
  }
}

// ─── Help text ────────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`
tela-call — Tela document tool CLI

Usage:
  node dist/tela-call.js <tool> '<json_args>'

Tools:
  create_document   {"theme?","mode?","lang?"}
  open_document     {"path"}
  save_document     {"doc_id","path?"}
  list_documents    {}
  undo              {"doc_id"}

  add_section       {"doc_id","tela_fragment","position?"}
  update_section    {"doc_id","section_id","tela_fragment"}
  remove_section    {"doc_id","section_id"}
  reorder_sections  {"doc_id","section_ids":[...]}
  set_theme         {"doc_id","theme_spec"}
  get_section       {"doc_id","section_id"}
  update_block      {"doc_id","path","props":{}}

  render            {"doc_id","out_dir?"}
  check             {"doc_id"}
  apply_fix         {"doc_id","fix_id"}

  list_components   {}
  list_themes       {}
  list_modifiers    {}
  extract_html      {"html"}

Session state persists to ~/.tela/sessions/ between calls.
Check reports persist to ~/.tela/reports/.
`.trim());
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [,, tool, rawArgs] = process.argv;

  if (!tool || tool === '--help' || tool === '-h') {
    printHelp();
    process.exit(0);
  }

  let args: Args = {};
  if (rawArgs) {
    try {
      args = JSON.parse(rawArgs) as Args;
    } catch {
      console.error(JSON.stringify({ error: `Invalid JSON args: ${rawArgs}` }));
      process.exit(1);
    }
  }

  try {
    const result = await dispatch(tool, args);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ error: message }));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ error: String(err) }));
  process.exit(1);
});
