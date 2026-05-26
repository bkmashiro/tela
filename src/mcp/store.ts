/**
 * DocumentStore — central state manager for all open Tela documents.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { TelaDocument, Value } from '../ast/types.js';
import { parse } from '../parser/index.js';
import { parseThemeSpec } from '../tokens/resolver.js';
import { compile, render, makeEmptyCache } from '../renderer/index.js';
import type {
  ComponentTree,
  RenderCache,
} from '../renderer/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  ast: TelaDocument;
  compiled: ComponentTree | null;
  rendered: string | null;
  renderCache: RenderCache;
  history: Snapshot[];
  pendingFixes: Map<string, FixPatch>;
  filePath: string | null;
  dirty: boolean;
  createdAt: number;
  modifiedAt: number;
}

export interface Snapshot {
  telaSource: string;
  timestamp: number;
  description: string;
}

export interface DocumentSummary {
  id: string;
  mode: string;
  theme: string;
  sectionCount: number;
  dirty: boolean;
  filePath: string | null;
}

export interface AnnotatedFragment {
  tela: string;
  sectionId: string;
  blockType: string;
  modifiers: string[];
  propertyPaths: string[];
}

export interface FixPatch {
  fixId: string;
  ruleId: string;
  sectionId: string;
  description: string;
  apply: (ast: TelaDocument) => TelaDocument;
}

export interface RenderDocResult {
  html: string;
  renderedSections: string[];
  sectionIds: string[];
}

// ─── Value serializer ─────────────────────────────────────────────────────────

function serializeValue(val: Value): string {
  switch (val.type) {
    case 'string':
      return (val.value.includes(':') || val.value.includes('|') || val.value.startsWith('"'))
        ? `"${val.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
        : val.value;
    case 'number':
      return String(val.value);
    case 'reference':
      return val.path;
    case 'multiline':
      return val.lines.join('\n');
    case 'modified': {
      const base = serializeValue(val.base);
      const mods = val.modifiers.map((m) =>
        m.args.length === 0 ? m.name : `${m.name}(${m.args.join('/')})`
      ).join(' ');
      return `${base} | ${mods}`;
    }
    case 'array':
      return val.items.map(serializeValue).join(', ');
    case 'blockValue':
      return '{}';
  }
}

function docToSource(doc: TelaDocument): string {
  const parts: string[] = [];

  // Frontmatter
  parts.push('---');
  const fm = doc.frontmatter;
  parts.push(`theme: ${fm.theme}`);
  parts.push(`mode: ${fm.mode}`);
  parts.push(`lang: ${fm.lang}`);
  if (fm.title) parts.push(`title: "${fm.title.replace(/"/g, '\\"')}"`);
  if (fm.description) parts.push(`description: "${fm.description.replace(/"/g, '\\"')}"`);
  const overrides = fm.tokenOverrides;
  if (Object.keys(overrides).length > 0) {
    parts.push('tokens:');
    for (const [k, v] of Object.entries(overrides)) {
      parts.push(`  ${k}: ${v}`);
    }
  }
  parts.push('---');

  // Sections
  for (const section of doc.sections) {
    parts.push('');
    const { block } = section;
    let header = block.blockType;
    if (block.modifiers.length > 0) {
      const modStr = block.modifiers.map((m) =>
        m.args.length === 0 ? m.name : `${m.name}(${m.args.join('/')})`
      ).join(' ');
      header += ` | ${modStr}`;
    }
    parts.push(`${header}:`);
    for (const [key, val] of Object.entries(block.properties)) {
      const sv = serializeValue(val);
      if (sv.includes('\n')) {
        parts.push(`  ${key}: |`);
        for (const line of sv.split('\n')) {
          parts.push(`    ${line}`);
        }
      } else {
        parts.push(`  ${key}: ${sv}`);
      }
    }
    parts.push('---');
  }

  return parts.join('\n');
}

// ─── DocumentStore ────────────────────────────────────────────────────────────

export class DocumentStore {
  private documents: Map<string, Document> = new Map();
  private nextId: number = 1;
  private sessionsDir: string;

  constructor(sessionsDir?: string) {
    this.sessionsDir = sessionsDir ?? join(homedir(), '.tela', 'sessions');
  }

  private newId(): string {
    return `doc-${String(this.nextId++).padStart(3, '0')}`;
  }

  private buildDocument(source: string, filePath: string | null = null): Document {
    const ast = parse(source);
    const id = this.newId();
    const now = Date.now();
    return {
      id,
      ast,
      compiled: null,
      rendered: null,
      renderCache: makeEmptyCache(),
      history: [],
      pendingFixes: new Map(),
      filePath,
      dirty: false,
      createdAt: now,
      modifiedAt: now,
    };
  }

  private pushSnapshot(doc: Document, description: string): void {
    const telaSource = docToSource(doc.ast);
    doc.history.push({ telaSource, timestamp: Date.now(), description });
    if (doc.history.length > 50) doc.history.shift();
  }

  private invalidateCompiled(doc: Document): void {
    doc.compiled = null;
    doc.rendered = null;
    doc.dirty = true;
    doc.modifiedAt = Date.now();
    doc.pendingFixes.clear();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  createDocument(opts?: {
    theme?: string;
    mode?: 'landing' | 'article' | 'docs';
    lang?: string;
  }): string {
    const theme = opts?.theme ?? 'warm-editorial';
    const mode = opts?.mode ?? 'landing';
    const lang = opts?.lang ?? 'en';

    const source = [
      '---',
      `theme: ${theme}`,
      `mode: ${mode}`,
      `lang: ${lang}`,
      '---',
      '',
      'hero:',
      '  headline: New Page',
      '',
    ].join('\n');

    const doc = this.buildDocument(source);
    this.documents.set(doc.id, doc);
    this.persistSession(doc);
    return doc.id;
  }

  openDocument(filePath: string): string {
    const absPath = resolve(filePath);
    const source = readFileSync(absPath, 'utf-8');
    const doc = this.buildDocument(source, absPath);
    this.documents.set(doc.id, doc);
    this.persistSession(doc);
    return doc.id;
  }

  saveDocument(docId: string, filePath?: string): string {
    const doc = this.getDocument(docId);
    const savePath = filePath ? resolve(filePath) : (doc.filePath ?? resolve('document.tela'));
    const source = docToSource(doc.ast);
    writeFileSync(savePath, source, 'utf-8');
    doc.filePath = savePath;
    doc.dirty = false;
    this.persistSession(doc);
    return savePath;
  }

  listDocuments(): DocumentSummary[] {
    return [...this.documents.values()].map((doc) => ({
      id: doc.id,
      mode: doc.ast.frontmatter.mode,
      theme: doc.ast.frontmatter.theme,
      sectionCount: doc.ast.sections.length,
      dirty: doc.dirty,
      filePath: doc.filePath,
    }));
  }

  getDocument(docId: string): Document {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);
    return doc;
  }

  addSection(docId: string, telaFragment: string, position?: number): string {
    const doc = this.getDocument(docId);
    this.pushSnapshot(doc, `add_section at position ${position ?? 'end'}`);

    const wrapSource = [
      '---',
      `theme: ${doc.ast.frontmatter.theme}`,
      '---',
      '',
      telaFragment.trim(),
      '',
    ].join('\n');

    const fragDoc = parse(wrapSource);
    if (fragDoc.sections.length === 0) throw new Error('Fragment produced no sections');

    const newSection = { ...fragDoc.sections[0] };

    // Ensure unique ID
    const existingIds = new Set(doc.ast.sections.map((s) => s.id));
    let sectionId = newSection.id;
    let counter = 0;
    while (existingIds.has(sectionId)) {
      sectionId = `${newSection.block.blockType}-${++counter}`;
    }
    newSection.id = sectionId;

    const insertAt = position != null
      ? Math.max(0, Math.min(position, doc.ast.sections.length))
      : doc.ast.sections.length;

    doc.ast.sections.splice(insertAt, 0, newSection);
    this.invalidateCompiled(doc);
    this.persistSession(doc);
    return sectionId;
  }

  updateSection(docId: string, sectionId: string, telaFragment: string): void {
    const doc = this.getDocument(docId);
    const idx = doc.ast.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) throw new Error(`Section not found: ${sectionId}`);

    this.pushSnapshot(doc, `update_section: ${sectionId}`);

    const wrapSource = [
      '---',
      `theme: ${doc.ast.frontmatter.theme}`,
      '---',
      '',
      telaFragment.trim(),
      '',
    ].join('\n');

    const fragDoc = parse(wrapSource);
    if (fragDoc.sections.length === 0) throw new Error('Fragment produced no sections');

    const newSection = { ...fragDoc.sections[0], id: sectionId };
    doc.ast.sections[idx] = newSection;
    doc.renderCache.sections.delete(sectionId);
    this.invalidateCompiled(doc);
    this.persistSession(doc);
  }

  removeSection(docId: string, sectionId: string): void {
    const doc = this.getDocument(docId);
    const idx = doc.ast.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) throw new Error(`Section not found: ${sectionId}`);

    this.pushSnapshot(doc, `remove_section: ${sectionId}`);
    doc.ast.sections.splice(idx, 1);
    doc.renderCache.sections.delete(sectionId);
    this.invalidateCompiled(doc);
    this.persistSession(doc);
  }

  reorderSections(docId: string, sectionIds: string[]): void {
    const doc = this.getDocument(docId);
    const sectionMap = new Map(doc.ast.sections.map((s) => [s.id, s]));
    const reordered = sectionIds.map((id) => {
      const s = sectionMap.get(id);
      if (!s) throw new Error(`Section not found: ${id}`);
      return s;
    });
    doc.ast.sections = reordered;
    doc.dirty = true;
    doc.modifiedAt = Date.now();
    this.persistSession(doc);
  }

  setTheme(docId: string, themeSpec: string): void {
    const doc = this.getDocument(docId);
    this.pushSnapshot(doc, `set_theme: ${themeSpec}`);

    const { themeName, overrides } = parseThemeSpec(themeSpec);
    doc.ast.frontmatter.theme = themeName;
    doc.ast.frontmatter.tokenOverrides = {
      ...doc.ast.frontmatter.tokenOverrides,
      ...overrides,
    };

    doc.renderCache.sections.clear();
    doc.renderCache.tokenHash = '';
    this.invalidateCompiled(doc);
    this.persistSession(doc);
  }

  getSection(docId: string, sectionId: string): AnnotatedFragment {
    const doc = this.getDocument(docId);
    const section = doc.ast.sections.find((s) => s.id === sectionId);
    if (!section) throw new Error(`Section not found: ${sectionId}`);

    const { block } = section;
    let tela = block.blockType;
    if (block.modifiers.length > 0) {
      const modStr = block.modifiers.map((m) =>
        m.args.length === 0 ? m.name : `${m.name}(${m.args.join('/')})`
      ).join(' ');
      tela += ` | ${modStr}`;
    }
    tela += ':';
    for (const [key, val] of Object.entries(block.properties)) {
      tela += `\n  ${key}: ${serializeValue(val)}`;
    }

    return {
      tela,
      sectionId,
      blockType: block.blockType,
      modifiers: block.modifiers.map((m) =>
        m.args.length === 0 ? m.name : `${m.name}(${m.args.join('/')})`
      ),
      propertyPaths: Object.keys(block.properties),
    };
  }

  updateBlock(docId: string, path: string, props: Record<string, unknown>): void {
    const doc = this.getDocument(docId);
    this.pushSnapshot(doc, `update_block: ${path}`);

    // path format: "sectionId" or "sectionId.key"
    const dotIdx = path.indexOf('.');
    const sectionId = dotIdx === -1 ? path : path.slice(0, dotIdx);

    const section = doc.ast.sections.find((s) => s.id === sectionId);
    if (!section) throw new Error(`Section not found: ${sectionId}`);

    for (const [key, value] of Object.entries(props)) {
      section.block.properties[key] = {
        type: 'string',
        value: String(value),
        source: { line: 0, column: 0 },
      };
    }

    doc.renderCache.sections.delete(sectionId);
    this.invalidateCompiled(doc);
    this.persistSession(doc);
  }

  renderDocument(docId: string): RenderDocResult {
    const doc = this.getDocument(docId);

    if (!doc.compiled) {
      doc.compiled = compile(doc.ast);
    }

    const result = render(doc.compiled, doc.renderCache);
    doc.rendered = result.html;

    return {
      html: result.html,
      renderedSections: result.renderedSections,
      sectionIds: doc.ast.sections.map((s) => s.id),
    };
  }

  undo(docId: string): string {
    const doc = this.getDocument(docId);
    if (doc.history.length === 0) throw new Error('Nothing to undo');

    const snapshot = doc.history.pop()!;
    doc.ast = parse(snapshot.telaSource);
    doc.renderCache.sections.clear();
    doc.renderCache.tokenHash = '';
    this.invalidateCompiled(doc);
    this.persistSession(doc);
    return snapshot.description;
  }

  // ─── Session persistence ─────────────────────────────────────────────────

  persistSession(doc: Document): void {
    try {
      mkdirSync(this.sessionsDir, { recursive: true });
      const sessionPath = join(this.sessionsDir, `session-${doc.id}.json`);
      const data = {
        id: doc.id,
        filePath: doc.filePath,
        telaSource: docToSource(doc.ast),
        history: doc.history,
        createdAt: doc.createdAt,
        modifiedAt: doc.modifiedAt,
      };
      writeFileSync(sessionPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Non-fatal
    }
  }

  restoreSessions(): void {
    try {
      if (!existsSync(this.sessionsDir)) return;
      const files = readdirSync(this.sessionsDir);
      for (const file of files) {
        if (!file.startsWith('session-') || !file.endsWith('.json')) continue;
        try {
          const data = JSON.parse(readFileSync(join(this.sessionsDir, file), 'utf-8')) as {
            id: string;
            filePath: string | null;
            telaSource: string;
            history: Snapshot[];
            createdAt: number;
            modifiedAt: number;
          };
          const ast = parse(data.telaSource);
          const doc: Document = {
            id: data.id,
            ast,
            compiled: null,
            rendered: null,
            renderCache: makeEmptyCache(),
            history: data.history ?? [],
            pendingFixes: new Map(),
            filePath: data.filePath,
            dirty: false,
            createdAt: data.createdAt,
            modifiedAt: data.modifiedAt,
          };
          this.documents.set(doc.id, doc);
          // Ensure nextId is ahead of restored IDs
          const num = parseInt(doc.id.replace('doc-', ''), 10);
          if (!isNaN(num) && num >= this.nextId) {
            this.nextId = num + 1;
          }
        } catch {
          // Ignore corrupt session files
        }
      }
    } catch {
      // Ignore
    }
  }

  persistSessions(): void {
    for (const doc of this.documents.values()) {
      this.persistSession(doc);
    }
  }
}
