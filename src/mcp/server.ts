/**
 * Tela MCP server.
 * Exposes 16 tools for creating, editing, rendering, and checking Tela documents.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DocumentStore } from './store.js';
import { SiteStore } from './site-store.js';
import { ensureChartJs } from '../renderer/assets.js';
import { COMPONENT_REGISTRY, listComponents } from '../primitives/index.js';
import { THEME_NAMES } from '../tokens/types.js';
import { THEME_PRESETS, WARM_EDITORIAL } from '../tokens/presets.js';
import { runChecks } from '../checker/index.js';
import type { CheckReport, AstPatch } from '../checker/types.js';
import { extract } from '../extractor/index.js';
import { describeDocument } from '../renderer/describe.js';
import type { SectionLayout } from '../renderer/types.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const store = new DocumentStore();
const siteStore = new SiteStore(store);

// ─── Per-document check report storage (for apply_fix) ───────────────────────
/** Maps doc_id → latest CheckReport (so apply_fix can look up patches). */
const lastCheckReports = new Map<string, CheckReport>();

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'create_document',
    description: 'Create a new empty Tela document with optional theme, mode, and language.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        theme: { type: 'string', description: 'Theme preset name', default: 'warm-editorial' },
        mode: { type: 'string', enum: ['landing', 'article', 'docs'], default: 'landing' },
        lang: { type: 'string', description: 'BCP 47 language tag', default: 'en' },
      },
    },
  },
  {
    name: 'open_document',
    description: 'Open an existing .tela file and return a document ID for editing.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute path to the .tela file' },
      },
      required: ['path'],
    },
  },
  {
    name: 'save_document',
    description: 'Save a document to disk as a .tela file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string', description: 'Document ID' },
        path: { type: 'string', description: 'Optional path to save to' },
      },
      required: ['doc_id'],
    },
  },
  {
    name: 'list_documents',
    description: 'List all open Tela documents.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'add_section',
    description: 'Add a new section to a document from a .tela fragment.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        tela_fragment: { type: 'string', description: '.tela notation for the new section' },
        position: { type: 'number', description: 'Index to insert at (default: end)' },
      },
      required: ['doc_id', 'tela_fragment'],
    },
  },
  {
    name: 'update_section',
    description: 'Replace a section\'s content with a new .tela fragment.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        section_id: { type: 'string' },
        tela_fragment: { type: 'string' },
      },
      required: ['doc_id', 'section_id', 'tela_fragment'],
    },
  },
  {
    name: 'remove_section',
    description: 'Remove a section from a document.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        section_id: { type: 'string' },
      },
      required: ['doc_id', 'section_id'],
    },
  },
  {
    name: 'reorder_sections',
    description: 'Reorder sections in a document.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        section_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['doc_id', 'section_ids'],
    },
  },
  {
    name: 'set_theme',
    description: 'Change the theme of a document. Supports override syntax: "warm-editorial + color.accent.default=#C84B31".',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        theme_spec: { type: 'string' },
      },
      required: ['doc_id', 'theme_spec'],
    },
  },
  {
    name: 'get_section',
    description: 'Get the annotated .tela notation for a specific section.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        section_id: { type: 'string' },
      },
      required: ['doc_id', 'section_id'],
    },
  },
  {
    name: 'update_block',
    description: 'Update specific properties of a block by path.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        path: { type: 'string', description: 'Path: "section-0.key"' },
        props: { type: 'object', description: 'Key-value pairs to update' },
      },
      required: ['doc_id', 'path', 'props'],
    },
  },
  {
    name: 'render',
    description: 'Render a document to HTML. Writes to a file and returns {html_path, section_ids}. Also attempts a Puppeteer screenshot if available.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        out_dir: { type: 'string', description: 'Directory to write HTML into (default: OS temp dir)' },
      },
      required: ['doc_id'],
    },
  },
  {
    name: 'check',
    description: 'Run aesthetic and structural checks on a rendered document. Returns a CheckReport with score, findings, and auto-applicable fix IDs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
      },
      required: ['doc_id'],
    },
  },
  {
    name: 'apply_fix',
    description: 'Apply a specific fix from the last check() report. Updates the document in-place and returns the mutated section.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
        fix_id: { type: 'string', description: 'Fix ID from CheckReport (e.g. "spacing-rhythm.001")' },
      },
      required: ['doc_id', 'fix_id'],
    },
  },
  {
    name: 'undo',
    description: 'Undo the last mutation to a document.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string' },
      },
      required: ['doc_id'],
    },
  },
  {
    name: 'list_components',
    description: 'List all available Tela components/block types.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_themes',
    description: 'List all available Tela theme presets.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_modifiers',
    description: 'List all available modifiers with their valid values.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'extract_html',
    description: 'Convert existing HTML into a Tela document approximation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        html: { type: 'string', description: 'Raw HTML to extract from' },
      },
      required: ['html'],
    },
  },
  {
    name: 'describe',
    description: 'Generate a compact text layout manifest from a rendered Tela document. Describes sections, their pixel positions/sizes (if available from a prior render), relative positions, and overlaps — so an LLM can understand the rendered result without a screenshot.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string', description: 'Document ID' },
      },
      required: ['doc_id'],
    },
  },
  {
    name: 'create_site',
    description: 'Create a new multi-page site.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Site name' },
        theme: { type: 'string', description: 'Default theme for the site' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_page',
    description: 'Add a page (document) to a site.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        site_id: { type: 'string', description: 'Site ID' },
        slug: { type: 'string', description: 'Page slug (e.g. "index", "docs", "about/team")' },
        doc_id: { type: 'string', description: 'Document ID to associate with this slug' },
      },
      required: ['site_id', 'slug', 'doc_id'],
    },
  },
  {
    name: 'remove_page',
    description: 'Remove a page from a site.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        site_id: { type: 'string' },
        slug: { type: 'string' },
      },
      required: ['site_id', 'slug'],
    },
  },
  {
    name: 'render_site',
    description: 'Render all pages of a site to HTML files in a directory.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        site_id: { type: 'string' },
        out_dir: { type: 'string', description: 'Output directory path' },
      },
      required: ['site_id', 'out_dir'],
    },
  },
  {
    name: 'list_pages',
    description: 'List all pages in a site.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        site_id: { type: 'string' },
      },
      required: ['site_id'],
    },
  },
  {
    name: 'list_sites',
    description: 'List all sites.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

// ─── Modifier vocabulary ─────────────────────────────────────────────────────

const MODIFIER_VOCAB = [
  { name: 'pad', description: 'Padding size', values: ['xs', 'sm', 'md', 'lg', 'xl', 'section'] },
  { name: 'gap', description: 'Gap between children', values: ['xs', 'sm', 'md', 'lg', 'xl'] },
  { name: 'bg', description: 'Background token', values: ['surface.default', 'surface.elevated', 'surface.inverted', 'surface.warm'] },
  { name: 'rounded', description: 'Apply border radius', values: [] },
  { name: 'shadow', description: 'Shadow elevation', values: ['sm', 'md', 'lg'] },
  { name: 'bleed', description: 'Remove max-width constraint', values: [] },
  { name: 'aspect', description: 'Aspect ratio', values: ['16/9', '4/3', '1/1', '3/2'] },
  { name: 'float', description: 'Float element right', values: [] },
  { name: 'accent', description: 'Use accent color treatment', values: [] },
  { name: 'muted', description: 'Use muted color treatment', values: [] },
  { name: 'inverted', description: 'Use inverted color scheme', values: [] },
  { name: 'centered', description: 'Center content horizontally', values: [] },
  { name: 'role', description: 'Button role', values: ['primary', 'ghost', 'danger'] },
  { name: 'grid', description: 'Grid column count', values: ['1', '2', '3', '4', '5', '6'] },
  { name: 'split', description: 'Split ratio', values: ['50/50', '60/40', '40/60', '70/30'] },
  { name: 'sticky', description: 'Sticky positioning (nav)', values: [] },
  { name: 'id', description: 'Explicit section ID', values: [] },
  { name: 'masonry', description: 'Masonry layout (gallery)', values: [] },
];

// ─── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'tela', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case 'create_document': {
        const docId = store.createDocument({
          theme: a['theme'] as string | undefined,
          mode: a['mode'] as 'landing' | 'article' | 'docs' | undefined,
          lang: a['lang'] as string | undefined,
        });
        const doc = store.getDocument(docId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              doc_id: docId,
              theme: doc.ast.frontmatter.theme,
              mode: doc.ast.frontmatter.mode,
            }),
          }],
        };
      }

      case 'open_document': {
        const docId = store.openDocument(a['path'] as string);
        const doc = store.getDocument(docId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              doc_id: docId,
              theme: doc.ast.frontmatter.theme,
              mode: doc.ast.frontmatter.mode,
              section_count: doc.ast.sections.length,
              section_ids: doc.ast.sections.map((s) => s.id),
            }),
          }],
        };
      }

      case 'save_document': {
        const savedPath = store.saveDocument(
          a['doc_id'] as string,
          a['path'] as string | undefined
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ saved_path: savedPath }) }],
        };
      }

      case 'list_documents': {
        const docs = store.listDocuments();
        return {
          content: [{ type: 'text', text: JSON.stringify(docs) }],
        };
      }

      case 'add_section': {
        const sectionId = store.addSection(
          a['doc_id'] as string,
          a['tela_fragment'] as string,
          a['position'] as number | undefined
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ section_id: sectionId }) }],
        };
      }

      case 'update_section': {
        store.updateSection(
          a['doc_id'] as string,
          a['section_id'] as string,
          a['tela_fragment'] as string
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      }

      case 'remove_section': {
        store.removeSection(a['doc_id'] as string, a['section_id'] as string);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      }

      case 'reorder_sections': {
        store.reorderSections(
          a['doc_id'] as string,
          a['section_ids'] as string[]
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      }

      case 'set_theme': {
        store.setTheme(a['doc_id'] as string, a['theme_spec'] as string);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      }

      case 'get_section': {
        const fragment = store.getSection(
          a['doc_id'] as string,
          a['section_id'] as string
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(fragment) }],
        };
      }

      case 'update_block': {
        store.updateBlock(
          a['doc_id'] as string,
          a['path'] as string,
          a['props'] as Record<string, unknown>
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      }

      case 'render': {
        // Pre-fetch Chart.js if document contains chart sections
        const _renderDocId = a['doc_id'] as string;
        const _renderDoc = store.getDocument(_renderDocId);
        const _hasCharts = _renderDoc.ast.sections.some(s => s.block.blockType === 'chart');
        if (_hasCharts) {
          try { await ensureChartJs(); } catch { /* network unavailable — will fall back to CDN */ }
        }
        const result = store.renderDocument(_renderDocId);
        const outDir = (a['out_dir'] as string | undefined) ?? path.join(os.tmpdir(), 'tela');
        fs.mkdirSync(outDir, { recursive: true });
        const htmlPath = path.join(outDir, `${a['doc_id']}.html`);
        fs.writeFileSync(htmlPath, result.html, 'utf8');

        // Attempt Puppeteer screenshot (graceful degradation)
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
          // puppeteer not installed or failed — continue without screenshot
        }

        return {
          content: [{ type: 'text', text: JSON.stringify({
            html_path: htmlPath,
            screenshot_path: screenshotPath,
            section_ids: result.sectionIds,
          }) }],
        };
      }

      case 'check': {
        const docId = a['doc_id'] as string;
        const doc = store.getDocument(docId);
        const renderResult = store.renderDocument(docId);

        const checkInput = {
          html: renderResult.html,
          document: doc.ast,
          sectionIds: renderResult.sectionIds,
        };

        const report = runChecks(checkInput);

        // Store the report for apply_fix to use later
        lastCheckReports.set(docId, report);

        // Serialize (patches Map is not JSON-serializable — omit it)
        const serializable = {
          score: report.score,
          summary: report.summary,
          checks: report.checks,
          patchCount: report.patches.size,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(serializable) }],
        };
      }

      case 'apply_fix': {
        const fixId = a['fix_id'] as string;
        const docId = a['doc_id'] as string;

        const report = lastCheckReports.get(docId);
        if (!report) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              error: 'No check report found for this document. Run check() first.',
              fix_id: fixId,
            }) }],
            isError: true,
          };
        }

        const patch = report.patches.get(fixId);
        if (!patch) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              error: `No auto-applicable patch for fix_id "${fixId}". Apply this fix manually.`,
              fix_id: fixId,
            }) }],
            isError: true,
          };
        }

        // Apply the patch using updateBlock or a direct AST mutation
        const doc = store.getDocument(docId);
        const section = doc.ast.sections.find((s) => s.id === patch.sectionId);
        if (!section) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              error: `Section "${patch.sectionId}" not found.`,
              fix_id: fixId,
            }) }],
            isError: true,
          };
        }

        // Apply the patch operation
        if (patch.op === 'set' && patch.path && patch.value !== undefined) {
          store.updateBlock(docId, `${patch.sectionId}.${patch.path}`, {
            [patch.path.split('.').pop()!]: patch.value,
          });
        } else if (patch.op === 'replace-modifier' || patch.op === 'add-modifier') {
          // Modifier operations: mutate the section's block modifiers
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

        return {
          content: [{ type: 'text', text: JSON.stringify({
            applied: true,
            fix_id: fixId,
            section_id: patch.sectionId,
          }) }],
        };
      }

      case 'undo': {
        const description = store.undo(a['doc_id'] as string);
        return {
          content: [{ type: 'text', text: JSON.stringify({ restored: description }) }],
        };
      }

      case 'list_components': {
        return {
          content: [{ type: 'text', text: JSON.stringify(listComponents()) }],
        };
      }

      case 'list_themes': {
        const themes = THEME_NAMES.map((name) => ({
          name,
          tokenCount: Object.keys(THEME_PRESETS[name]).length,
        }));
        return {
          content: [{ type: 'text', text: JSON.stringify(themes) }],
        };
      }

      case 'list_modifiers': {
        return {
          content: [{ type: 'text', text: JSON.stringify(MODIFIER_VOCAB) }],
        };
      }

      case 'extract_html': {
        const htmlInput = a['html'] as string;
        if (!htmlInput || typeof htmlInput !== 'string') {
          throw new Error('extract_html requires an "html" string parameter.');
        }
        const extractionResult = extract(htmlInput);
        return {
          content: [{ type: 'text', text: JSON.stringify(extractionResult) }],
        };
      }

      case 'describe': {
        const docId = a['doc_id'] as string;
        const doc = store.getDocument(docId);
        const renderResult = store.renderDocument(docId);

        // Try to load layout measurements saved by a prior render
        const layoutPath = path.join(os.tmpdir(), 'tela', `${docId}-layout.json`);
        let layout: SectionLayout[] | null = null;
        try {
          if (fs.existsSync(layoutPath)) {
            layout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8')) as SectionLayout[];
          }
        } catch { /* ignore */ }

        const manifest = describeDocument(doc.ast, renderResult.sectionIds, layout);
        return {
          content: [{ type: 'text', text: JSON.stringify({ manifest }) }],
        };
      }

      case 'create_site': {
        const siteId = siteStore.createSite(
          a['name'] as string,
          a['theme'] as string | undefined
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ site_id: siteId }) }],
        };
      }

      case 'add_page': {
        siteStore.addPage(
          a['site_id'] as string,
          a['slug'] as string,
          a['doc_id'] as string
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      }

      case 'remove_page': {
        siteStore.removePage(a['site_id'] as string, a['slug'] as string);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      }

      case 'render_site': {
        const result = await siteStore.renderSite(
          a['site_id'] as string,
          a['out_dir'] as string
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      }

      case 'list_pages': {
        const pages = siteStore.listPages(a['site_id'] as string);
        return {
          content: [{ type: 'text', text: JSON.stringify({ pages }) }],
        };
      }

      case 'list_sites': {
        const sites = siteStore.listSites();
        return {
          content: [{ type: 'text', text: JSON.stringify({ sites }) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
});

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function startMcpServer(): Promise<void> {
  store.restoreSessions();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
