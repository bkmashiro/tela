/**
 * Tela notation parser.
 * Converts .tela source text into a typed TelaDocument AST.
 *
 * Grammar summary:
 *   TelaDocument := Frontmatter SectionSep (Section SectionSep)* Section EOF
 *   Frontmatter  := SectionSep YAML SectionSep
 *   Section      := Block+
 *   Block        := BlockHeader NEWLINE IndentedBody
 *   BlockHeader  := Type ("|" Modifier+)? ":"
 */

import * as yaml from 'js-yaml';
import type {
  TelaDocument,
  Frontmatter,
  Section,
  Block,
  Modifier,
  Value,
  ArrayValue,
  StringValue,
  NumberValue,
  ReferenceValue,
  MultilineValue,
  ModifiedValue,
  BlockValue,
  SourceLocation,
} from '../ast/types.js';
import { parseThemeSpec } from '../tokens/resolver.js';
import { ParseError } from './errors.js';

export { ParseError };

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ParseOptions {
  file?: string;
}

export function parse(source: string, options: ParseOptions = {}): TelaDocument {
  const parser = new TelaParser(source, options.file);
  return parser.parse();
}

// ─── Tokenizer / Line model ───────────────────────────────────────────────────

interface Line {
  raw: string;
  content: string;  // after stripping comments and trailing whitespace
  indent: number;
  lineNumber: number;
}

function tokenizeLines(source: string): Line[] {
  const rawLines = source.split('\n');
  return rawLines.map((raw, i) => {
    const lineNumber = i + 1;
    // Strip inline comment (# preceded by whitespace, or leading #)
    // But preserve # inside quoted strings — simple heuristic: scan outside quotes
    const stripped = stripComment(raw);
    const indent = getIndent(stripped);
    return { raw, content: stripped.trimEnd(), indent, lineNumber };
  });
}

function stripComment(line: string): string {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inQuote = !inQuote;
    }
    if (!inQuote && ch === '#') {
      // Must be preceded by whitespace or at start
      if (i === 0 || /\s/.test(line[i - 1])) {
        return line.slice(0, i);
      }
    }
  }
  return line;
}

function getIndent(line: string): number {
  let count = 0;
  for (const ch of line) {
    if (ch === ' ') count++;
    else if (ch === '\t') throw new Error('Tabs are not allowed in .tela files. Use 2-space indentation.');
    else break;
  }
  return count;
}

function makeLoc(line: number, column: number, file?: string): SourceLocation {
  return { line, column, file };
}

// ─── Parser ───────────────────────────────────────────────────────────────────

class TelaParser {
  private lines: Line[];
  private pos: number = 0;
  private file?: string;
  private sectionIdSet = new Set<string>();
  private sectionAutoIndex = 0;

  constructor(source: string, file?: string) {
    this.file = file;
    try {
      this.lines = tokenizeLines(source);
    } catch (e: unknown) {
      throw new ParseError(String(e), 1, 1, file);
    }
  }

  parse(): TelaDocument {
    const startLine = this.currentLineNumber();

    // First --- must open frontmatter
    this.expectSectionSep('Expected --- to open frontmatter block');
    const frontmatter = this.parseFrontmatter();
    this.expectSectionSep('Expected --- to close frontmatter block');

    const sections: Section[] = [];
    while (!this.atEnd()) {
      // Skip blank lines between sections
      this.skipBlanks();
      if (this.atEnd()) break;

      const section = this.parseSection();
      sections.push(section);

      this.skipBlanks();
      if (!this.atEnd()) {
        if (this.isSectionSep()) {
          this.advance(); // consume ---
        }
      }
    }

    if (sections.length === 0) {
      throw new ParseError('Document must have at least one section', startLine, 1, this.file);
    }

    return {
      type: 'document',
      frontmatter,
      sections,
      source: makeLoc(startLine, 1, this.file),
    };
  }

  // ─── Frontmatter ─────────────────────────────────────────────────────────

  private parseFrontmatter(): Frontmatter {
    const yamlLines: string[] = [];
    const startLine = this.currentLineNumber();

    while (!this.atEnd() && !this.isSectionSep()) {
      yamlLines.push(this.currentLine().raw);
      this.advance();
    }

    const yamlText = yamlLines.join('\n');
    let raw: Record<string, unknown>;
    try {
      raw = (yaml.load(yamlText) as Record<string, unknown>) ?? {};
    } catch (e: unknown) {
      throw new ParseError(`Invalid YAML frontmatter: ${String(e)}`, startLine, 1, this.file);
    }

    const themeRaw = String(raw['theme'] ?? 'warm-editorial');
    const { themeName, overrides: inlineOverrides } = parseThemeSpec(themeRaw);

    // Merge frontmatter tokens: map with inline overrides
    const frontmatterTokens = raw['tokens'] as Record<string, string | number> | undefined ?? {};
    const tokenOverrides: Record<string, string | number> = { ...frontmatterTokens, ...inlineOverrides };

    const modeRaw = raw['mode'];
    const mode: Frontmatter['mode'] =
      modeRaw === 'article' ? 'article' :
      modeRaw === 'docs' ? 'docs' :
      'landing';

    return {
      theme: themeName,
      mode,
      lang: String(raw['lang'] ?? 'en'),
      title: raw['title'] != null ? String(raw['title']) : undefined,
      description: raw['description'] != null ? String(raw['description']) : undefined,
      tokenOverrides,
      raw,
    };
  }

  // ─── Section ─────────────────────────────────────────────────────────────

  private parseSection(): Section {
    const startLine = this.currentLineNumber();
    this.skipBlanks();

    if (this.atEnd()) {
      throw new ParseError('Expected section content', startLine, 1, this.file);
    }

    const block = this.parseBlock(0);

    // Extract section ID from block modifiers (id modifier)
    let sectionId = '';
    const idMod = block.modifiers.find((m) => m.name === 'id');
    if (idMod && idMod.args.length > 0) {
      sectionId = String(idMod.args[0]);
    } else {
      sectionId = `section-${this.sectionAutoIndex}`;
    }
    this.sectionAutoIndex++;

    if (this.sectionIdSet.has(sectionId)) {
      throw new ParseError(`Duplicate section ID: "${sectionId}"`, startLine, 1, this.file);
    }
    this.sectionIdSet.add(sectionId);

    return {
      type: 'section',
      id: sectionId,
      block,
      source: makeLoc(startLine, 1, this.file),
    };
  }

  // ─── Block ───────────────────────────────────────────────────────────────

  private parseBlock(expectedIndent: number): Block {
    const line = this.currentLine();
    const startLine = line.lineNumber;

    if (line.indent !== expectedIndent) {
      throw new ParseError(
        `Expected indent ${expectedIndent}, got ${line.indent}`,
        startLine, line.indent + 1, this.file
      );
    }

    // Parse block header: "type | mod1 mod2(arg):"
    const headerText = line.content.slice(expectedIndent);
    const { blockType, modifiers } = this.parseBlockHeader(headerText, startLine);
    this.advance();

    // Parse indented body
    const bodyIndent = expectedIndent + 2;
    const properties: Record<string, Value> = {};
    const children: (Block | ArrayValue)[] = [];

    while (!this.atEnd() && !this.isSectionSep()) {
      this.skipBlanks();
      if (this.atEnd() || this.isSectionSep()) break;

      const nextLine = this.currentLine();
      if (nextLine.indent < bodyIndent) break;
      if (nextLine.indent > bodyIndent) {
        throw new ParseError(
          `Unexpected indent ${nextLine.indent} (expected ${bodyIndent})`,
          nextLine.lineNumber, nextLine.indent + 1, this.file
        );
      }

      const bodyText = nextLine.content.slice(bodyIndent);

      // Array item: starts with "- "
      if (bodyText.startsWith('- ')) {
        const arrayVal = this.parseArrayItems(bodyIndent);
        // Store as unnamed child array
        children.push(arrayVal);
        continue;
      }

      // Key: value or nested block
      const colonIdx = findColon(bodyText);
      if (colonIdx === -1) {
        throw new ParseError(
          `Expected "key: value" or "- item", got: ${bodyText}`,
          nextLine.lineNumber, bodyIndent + 1, this.file
        );
      }

      const key = bodyText.slice(0, colonIdx).trim();
      const rest = bodyText.slice(colonIdx + 1).trim();

      if (rest === '') {
        // Check next line — is it deeper (nested block or multiline)?
        this.advance();
        const peek = this.peekLine();

        if (peek && peek.indent > bodyIndent) {
          // Could be a block or a multiline YAML literal
          const deeperText = peek.content.slice(peek.indent);
          if (this.isBlockHeader(deeperText)) {
            // Nested block under this key
            const nestedBlock = this.parseBlock(peek.indent);
            properties[key] = {
              type: 'blockValue',
              properties: nestedBlock.properties,
              children: nestedBlock.children,
              source: makeLoc(peek.lineNumber, peek.indent + 1, this.file),
            } satisfies BlockValue;
          } else if (deeperText.startsWith('- ')) {
            // Array under this key
            const arr = this.parseArrayItems(peek.indent);
            properties[key] = arr;
          } else {
            // Treat as blockValue with nested key-values
            const bv = this.parseBlockValueBody(peek.indent);
            properties[key] = bv;
          }
        } else {
          // Empty value → empty string
          properties[key] = {
            type: 'string',
            value: '',
            source: makeLoc(nextLine.lineNumber, bodyIndent + colonIdx + 1, this.file),
          } satisfies StringValue;
        }
        continue;
      }

      // Multiline block scalar: "key: |"
      if (rest === '|') {
        this.advance();
        const mlVal = this.parseMultilineValue(bodyIndent + 2, nextLine.lineNumber);
        properties[key] = mlVal;
        continue;
      }

      // Inline value
      const val = this.parseInlineValue(rest, nextLine.lineNumber, bodyIndent + colonIdx + 1);
      properties[key] = val;
      this.advance();
    }

    return {
      type: 'block',
      blockType,
      modifiers,
      properties,
      children,
      source: makeLoc(startLine, expectedIndent + 1, this.file),
    };
  }

  private parseBlockHeader(headerText: string, lineNum: number): {
    blockType: string;
    modifiers: Modifier[];
  } {
    // Must end with ":"
    let text = headerText;
    if (!text.endsWith(':')) {
      throw new ParseError(
        `Block header must end with ":". Got: ${headerText}`,
        lineNum, 1, this.file
      );
    }
    text = text.slice(0, -1); // remove trailing ":"

    // Split on "|" for modifier chain
    const pipeIdx = text.indexOf('|');
    let blockType: string;
    let modChain = '';

    if (pipeIdx === -1) {
      blockType = text.trim();
    } else {
      blockType = text.slice(0, pipeIdx).trim();
      modChain = text.slice(pipeIdx + 1).trim();
    }

    if (!blockType) {
      throw new ParseError(`Missing block type in header: ${headerText}`, lineNum, 1, this.file);
    }

    const modifiers = modChain ? this.parseModifierChain(modChain, lineNum) : [];
    return { blockType, modifiers };
  }

  private parseModifierChain(chain: string, lineNum: number): Modifier[] {
    const modifiers: Modifier[] = [];
    // Tokenize by spaces, but keep parenthesized args together
    const tokens = tokenizeModifierChain(chain);
    for (const tok of tokens) {
      const mod = this.parseModifier(tok, lineNum);
      if (mod) modifiers.push(mod);
    }
    return modifiers;
  }

  private parseModifier(text: string, lineNum: number): Modifier {
    const parenIdx = text.indexOf('(');
    if (parenIdx === -1) {
      // Boolean modifier
      return {
        type: 'modifier',
        name: text.trim(),
        args: [],
        source: makeLoc(lineNum, 1, this.file),
      };
    }
    const name = text.slice(0, parenIdx).trim();
    const argsRaw = text.slice(parenIdx + 1, text.lastIndexOf(')'));
    const args = argsRaw.split('/').map((a) => {
      const trimmed = a.trim();
      const num = Number(trimmed);
      return isNaN(num) ? trimmed : num;
    });
    return {
      type: 'modifier',
      name,
      args,
      source: makeLoc(lineNum, 1, this.file),
    };
  }

  // ─── Array items ─────────────────────────────────────────────────────────

  private parseArrayItems(indent: number): ArrayValue {
    const items: Value[] = [];
    const startLine = this.currentLineNumber();
    const continuationIndent = indent + 2;

    while (!this.atEnd() && !this.isSectionSep()) {
      const line = this.currentLine();
      if (line.content.trim() === '') { this.advance(); continue; }
      if (line.indent < indent) break;
      if (line.indent > indent) {
        // deeper — belongs to previous item (shouldn't reach here normally)
        break;
      }

      const bodyText = line.content.slice(indent);
      if (!bodyText.startsWith('- ')) break;

      const itemText = bodyText.slice(2).trim();
      this.advance();

      // Collect continuation properties at continuationIndent
      const continuationProps: Record<string, Value> = {};

      // Parse the first line of the item (may have key: value)
      if (itemText.includes(': ')) {
        const kvPairs = splitInlineObject(itemText);
        for (const [key, valText] of kvPairs) {
          const val = this.parseInlineValue(valText.trim(), line.lineNumber, 1);
          continuationProps[key.trim()] = val;
        }
      }

      // Now collect continuation lines at continuationIndent
      while (!this.atEnd() && !this.isSectionSep()) {
        const nextLine = this.currentLine();
        if (nextLine.content.trim() === '') break;  // blank line ends item
        if (nextLine.indent !== continuationIndent) break;  // different indent ends item

        const contText = nextLine.content.slice(continuationIndent);
        const colonIdx = findColon(contText);
        if (colonIdx === -1) break;

        const key = contText.slice(0, colonIdx).trim();
        const rest = contText.slice(colonIdx + 1).trim();
        this.advance();

        if (rest === '|') {
          const mlVal = this.parseMultilineValue(continuationIndent + 2, nextLine.lineNumber);
          continuationProps[key] = mlVal;
        } else if (rest === '') {
          continuationProps[key] = { type: 'string', value: '', source: makeLoc(nextLine.lineNumber, 1, this.file) };
        } else {
          continuationProps[key] = this.parseInlineValue(rest, nextLine.lineNumber, continuationIndent + colonIdx + 1);
        }
      }

      // Build result
      if (Object.keys(continuationProps).length > 0) {
        // Multi-property item — produce a BlockValue
        items.push({
          type: 'blockValue',
          properties: continuationProps,
          children: [],
          source: makeLoc(line.lineNumber, indent + 1, this.file),
        } satisfies BlockValue);
      } else {
        // Simple value
        const val = this.parseInlineValue(itemText, line.lineNumber, indent + 2);
        items.push(val);
      }
    }

    return {
      type: 'array',
      items,
      source: makeLoc(startLine, indent + 1, this.file),
    };
  }

  private parseInlineObject(text: string, lineNum: number): BlockValue {
    // Split properties by " | " that look like "key: value"
    // But we need to be careful — " | " can also be a modifier chain on a value
    const properties: Record<string, Value> = {};

    // Simple approach: split on the first "key: value" patterns
    // First, find all "word: " positions
    let remaining = text;
    const kvPairs = splitInlineObject(remaining);

    for (const [key, valText] of kvPairs) {
      const val = this.parseInlineValue(valText.trim(), lineNum, 1);
      properties[key.trim()] = val;
    }

    return {
      type: 'blockValue',
      properties,
      children: [],
      source: makeLoc(lineNum, 1, this.file),
    };
  }

  // ─── Values ──────────────────────────────────────────────────────────────

  private parseInlineValue(text: string, lineNum: number, column: number): Value {
    const src = makeLoc(lineNum, column, this.file);

    if (!text) {
      return { type: 'string', value: '', source: src } satisfies StringValue;
    }

    // Check for inline modifier chain on value: "value | mod1 mod2"
    // Split carefully: only if "|" is not inside quotes
    const pipeInfo = findValuePipe(text);

    if (pipeInfo !== -1) {
      const baseText = text.slice(0, pipeInfo).trim();
      const modText = text.slice(pipeInfo + 1).trim();
      const base = this.parseSimpleValue(baseText, lineNum, column);
      const modifiers = this.parseModifierChain(modText, lineNum);
      if (modifiers.length > 0) {
        return {
          type: 'modified',
          base,
          modifiers,
          source: src,
        } satisfies ModifiedValue;
      }
      return base;
    }

    return this.parseSimpleValue(text, lineNum, column);
  }

  private parseSimpleValue(text: string, lineNum: number, column: number): Value {
    const src = makeLoc(lineNum, column, this.file);

    // Reference: starts with "./"
    if (text.startsWith('./')) {
      return { type: 'reference', path: text, source: src } satisfies ReferenceValue;
    }

    // Quoted string
    if (text.startsWith('"')) {
      const unquoted = parseQuotedString(text, lineNum, this.file);
      return { type: 'string', value: unquoted, source: src } satisfies StringValue;
    }

    // Number
    const num = Number(text);
    if (!isNaN(num) && text !== '') {
      return { type: 'number', value: num, source: src } satisfies NumberValue;
    }

    // Unescape bare string
    const unescaped = unescapeBareString(text);
    return { type: 'string', value: unescaped, source: src } satisfies StringValue;
  }

  private parseMultilineValue(indent: number, startLine: number): MultilineValue {
    const lines: string[] = [];

    while (!this.atEnd() && !this.isSectionSep()) {
      const line = this.currentLine();
      if (line.content.trim() === '' && lines.length > 0) {
        // blank line inside multiline — include as empty line
        lines.push('');
        this.advance();
        continue;
      }
      if (line.indent < indent && line.content.trim() !== '') break;
      lines.push(line.content.slice(indent));
      this.advance();
    }

    // Strip trailing blank lines
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    return {
      type: 'multiline',
      lines,
      source: makeLoc(startLine, indent + 1, this.file),
    };
  }

  private parseBlockValueBody(indent: number): BlockValue {
    const properties: Record<string, Value> = {};
    const children: (Block | ArrayValue)[] = [];
    const startLine = this.currentLineNumber();

    while (!this.atEnd() && !this.isSectionSep()) {
      this.skipBlanks();
      if (this.atEnd() || this.isSectionSep()) break;

      const line = this.currentLine();
      if (line.indent < indent) break;

      const bodyText = line.content.slice(indent);

      if (bodyText.startsWith('- ')) {
        const arr = this.parseArrayItems(indent);
        children.push(arr);
        continue;
      }

      const colonIdx = findColon(bodyText);
      if (colonIdx === -1) break;

      const key = bodyText.slice(0, colonIdx).trim();
      const rest = bodyText.slice(colonIdx + 1).trim();
      this.advance();

      if (rest === '|') {
        const mlVal = this.parseMultilineValue(indent + 2, line.lineNumber);
        properties[key] = mlVal;
        continue;
      }

      if (rest === '') {
        const peek = this.peekLine();
        if (peek && peek.indent > indent) {
          const deeperText = peek.content.slice(peek.indent);
          if (deeperText.startsWith('- ')) {
            // Array property (e.g. cta: → - label: ...)
            const arr = this.parseArrayItems(peek.indent);
            properties[key] = arr;
          } else {
            const bv = this.parseBlockValueBody(peek.indent);
            properties[key] = bv;
          }
        } else {
          properties[key] = { type: 'string', value: '', source: makeLoc(line.lineNumber, 1, this.file) };
        }
        continue;
      }

      properties[key] = this.parseInlineValue(rest, line.lineNumber, indent + colonIdx + 1);
    }

    return {
      type: 'blockValue',
      properties,
      children,
      source: makeLoc(startLine, indent + 1, this.file),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private isBlockHeader(text: string): boolean {
    // A block header looks like: "word:" or "word | ...:"
    return /^\w[\w-]*(\s*\|[^:]*)?\s*:$/.test(text.trim());
  }

  private expectSectionSep(msg: string): void {
    this.skipBlanks();
    if (!this.isSectionSep()) {
      const line = this.currentLine();
      throw new ParseError(msg, line.lineNumber, 1, this.file);
    }
    this.advance();
  }

  private isSectionSep(): boolean {
    if (this.atEnd()) return false;
    return this.currentLine().content.trim() === '---';
  }

  private skipBlanks(): void {
    while (!this.atEnd() && this.currentLine().content.trim() === '') {
      this.advance();
    }
  }

  private atEnd(): boolean {
    return this.pos >= this.lines.length;
  }

  private currentLine(): Line {
    return this.lines[this.pos];
  }

  private peekLine(): Line | null {
    return this.pos < this.lines.length ? this.lines[this.pos] : null;
  }

  private currentLineNumber(): number {
    return this.atEnd() ? this.lines.length : this.lines[this.pos].lineNumber;
  }

  private advance(): void {
    this.pos++;
  }
}

// ─── Utility functions ────────────────────────────────────────────────────────

function tokenizeModifierChain(chain: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of chain) {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ' ' && depth === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

/** Find the first "|" that separates a value from its modifier chain. */
function findValuePipe(text: string): number {
  let inQuote = false;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && !inQuote) inQuote = true;
    else if (ch === '"' && inQuote) inQuote = false;
    else if (!inQuote && ch === '(') depth++;
    else if (!inQuote && ch === ')') depth--;
    else if (!inQuote && depth === 0 && ch === '|') {
      return i;
    }
  }
  return -1;
}

/** Find the first ":" that separates a key from its value, skipping quoted strings. */
function findColon(text: string): number {
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuote = !inQuote;
    if (!inQuote && ch === ':') return i;
  }
  return -1;
}

function parseQuotedString(text: string, lineNum: number, file?: string): string {
  if (!text.startsWith('"') || !text.endsWith('"')) {
    throw new ParseError(`Invalid quoted string: ${text}`, lineNum, 1, file);
  }
  const inner = text.slice(1, -1);
  return inner
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\');
}

function unescapeBareString(text: string): string {
  return text
    .replace(/\\\|/g, '|')
    .replace(/\\#/g, '#')
    .replace(/\\\\/g, '\\');
}

/**
 * Split an inline object like "label: Get started | role: primary"
 * into [["label", "Get started"], ["role", "primary"]]
 *
 * The challenge: "label: Get started | role(primary)" — here "|" starts a modifier.
 * We detect if the part after "|" looks like a key: value (has ": " not inside parens).
 */
function splitInlineObject(text: string): [string, string][] {
  const result: [string, string][] = [];
  // Find all "word: " positions that are not inside parentheses
  const re = /(?:^|\|\s*)([\w-]+)\s*:\s*/g;
  let m: RegExpExecArray | null;
  const positions: { start: number; keyStart: number; valueStart: number; key: string }[] = [];

  while ((m = re.exec(text)) !== null) {
    const fullMatch = m[0];
    const key = m[1];
    const keyStart = m.index + (m[0].startsWith('|') ? fullMatch.indexOf(key) : 0);
    const valueStart = m.index + fullMatch.length;
    positions.push({ start: m.index, keyStart, valueStart, key });
  }

  if (positions.length === 0) {
    return [['', text]];
  }

  for (let i = 0; i < positions.length; i++) {
    const { key, valueStart } = positions[i];
    const valueEnd = i + 1 < positions.length ? positions[i + 1].start : text.length;
    const value = text.slice(valueStart, valueEnd).replace(/\s*\|\s*$/, '').trim();
    result.push([key, value]);
  }

  return result;
}
