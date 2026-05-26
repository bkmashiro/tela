/**
 * Tela AST Node Types
 * All typed AST definitions for the .tela notation.
 */

/** Root document node. */
export interface TelaDocument {
  type: 'document';
  frontmatter: Frontmatter;
  sections: Section[];
  source: SourceLocation;
}

export interface Frontmatter {
  theme: string;                              // e.g. "warm-editorial"
  mode: 'landing' | 'article' | 'docs';
  lang: string;                               // BCP 47 language tag
  title?: string;
  description?: string;
  tokenOverrides: Record<string, string | number>;
  raw: Record<string, unknown>;               // full parsed YAML for extension
}

export interface SourceLocation {
  file?: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

/** A section is a top-level content region separated by --- */
export interface Section {
  type: 'section';
  id: string;                                 // auto-generated or explicit
  block: Block;                               // root block of this section
  source: SourceLocation;
}

/** A typed layout block with modifiers, properties, and children. */
export interface Block {
  type: 'block';
  blockType: string;                          // "hero", "features", "grid", "prose", etc.
  modifiers: Modifier[];
  properties: Record<string, Value>;
  children: (Block | ArrayValue)[];
  source: SourceLocation;
}

export interface Modifier {
  type: 'modifier';
  name: string;                               // "split", "pad", "gap", "rounded", etc.
  args: (string | number)[];                  // e.g. [60, 40] for split(60/40), [] for boolean
  source: SourceLocation;
}

/** Discriminated union of all value types. */
export type Value =
  | StringValue
  | NumberValue
  | ReferenceValue
  | MultilineValue
  | ModifiedValue
  | BlockValue
  | ArrayValue;

export interface StringValue {
  type: 'string';
  value: string;
  source: SourceLocation;
}

export interface NumberValue {
  type: 'number';
  value: number;
  source: SourceLocation;
}

export interface ReferenceValue {
  type: 'reference';
  path: string;                               // relative path, e.g. "./hero.png"
  source: SourceLocation;
}

export interface MultilineValue {
  type: 'multiline';
  lines: string[];
  source: SourceLocation;
}

export interface ModifiedValue {
  type: 'modified';
  base: Value;                                // the underlying value
  modifiers: Modifier[];                      // inline modifiers applied to this value
  source: SourceLocation;
}

export interface BlockValue {
  type: 'blockValue';
  properties: Record<string, Value>;
  children: (Block | ArrayValue)[];
  source: SourceLocation;
}

export interface ArrayValue {
  type: 'array';
  items: Value[];
  source: SourceLocation;
}

// ─── Atom types (renderer-level concept) ─────────────────────────────────────

export type Atom =
  | TextAtom
  | ImageAtom
  | IconAtom
  | CodeAtom
  | ListAtom;

export interface TextAtom {
  kind: 'text';
  content: string;
  role: 'headline' | 'eyebrow' | 'body' | 'lead' | 'caption' | 'label';
}

export interface ImageAtom {
  kind: 'image';
  src: string;                                // resolved absolute path or URL
  alt?: string;
  aspect?: [number, number];
}

export interface IconAtom {
  kind: 'icon';
  name: string;                               // icon identifier or literal character
  accent: boolean;
}

export interface CodeAtom {
  kind: 'code';
  content: string;
  language?: string;
}

export interface ListAtom {
  kind: 'list';
  items: string[];
  ordered: boolean;
}

// ─── Helper type guards ───────────────────────────────────────────────────────

export function isBlock(node: Block | ArrayValue | Value): node is Block {
  return (node as Block).type === 'block';
}

export function isArrayValue(node: Block | ArrayValue | Value): node is ArrayValue {
  return (node as ArrayValue).type === 'array';
}

export function isStringValue(v: Value): v is StringValue {
  return v.type === 'string';
}

export function isNumberValue(v: Value): v is NumberValue {
  return v.type === 'number';
}

export function isReferenceValue(v: Value): v is ReferenceValue {
  return v.type === 'reference';
}

export function isMultilineValue(v: Value): v is MultilineValue {
  return v.type === 'multiline';
}

export function isModifiedValue(v: Value): v is ModifiedValue {
  return v.type === 'modified';
}

export function isBlockValue(v: Value): v is BlockValue {
  return v.type === 'blockValue';
}
