# Tela -- Technical Design Document

This is the source-of-truth design document for Tela, an LLM-native HTML page composer. Read this before writing any code. Every type, algorithm, threshold, and template in this document is a binding contract -- deviations require updating this document first.

---

## 1. Problem Statement & Design Goals

### What Kami gets wrong

Kami produces beautiful documents, but it was designed for human developers, not LLM agents. Three structural problems make it unsuitable as an LLM tool:

1. **Raw HTML is the interface.** Kami's templates are 400-800 line single-file HTML documents. An LLM must generate or edit the entire file in one shot, which means it must hold CSS variables, WeasyPrint-specific workarounds, font stacks, and layout math in context simultaneously. Every generation risks violating one of Kami's 10 invariants because the invariants are documented in prose, not enforced by the tool.

2. **Validation is post-hoc and coarse.** Kami's checker (`checks.py`) operates on rendered PDFs via pixel sweeps -- it can detect trailing whitespace and orphans, but it cannot tell you that a heading skipped a level, that a CTA is buried below the fold, or that a grid has inconsistent column widths. The lint rules (`lint.py`) catch CSS-level bugs (rgba backgrounds, cool grays) but nothing about layout quality. There is no feedback loop: the checker reports problems but cannot fix them.

3. **No incremental editing.** Changing a single section requires the LLM to re-emit the entire HTML file. There is no concept of a "section" at the tool level, no diffing, and no undo.

### Why Tela exists

Tela replaces the raw-HTML interface with a structured notation (`.tela`) that decomposes pages into sections of typed, composable primitives. An LLM never writes CSS. Instead, it declares intent (`hero | split(60/40) pad(xl)`) and Tela handles the translation to production HTML.

The feedback loop is built in: after every render, the checker produces machine-readable diagnostics with auto-applicable fixes. The LLM reads the check report, decides which fixes to apply, and iterates. The entire workflow runs through an MCP server that maintains document state, history, and undo.

### Three design axioms

**Axiom 1: Primitive Composition.** Every visual outcome is achieved by combining typed blocks with modifier chains. There are no escape hatches to raw CSS. If a visual effect cannot be expressed through the primitive vocabulary, the vocabulary must be extended -- not bypassed.

**Axiom 2: Semantic Feedback.** The checker does not report "line 347 has wrong padding." It reports "section[1].grid gap conflicts with the theme's base spacing unit, creating visual dissonance" and offers a concrete fix. Feedback is tied to the AST, not to generated HTML line numbers.

**Axiom 3: Bidirectional Flow.** Pages can be created from `.tela` notation (forward) or extracted from existing HTML back into `.tela` (reverse). The extractor does not produce perfect output -- it produces annotated approximations with per-section confidence scores, giving the LLM a starting point for refinement.

---

## 2. Tela Notation -- Full Grammar Spec

A `.tela` file is a UTF-8 text file consisting of a frontmatter block followed by one or more sections separated by `---`.

### 2.1 Document structure

```
TelaDocument   := Frontmatter SectionSep (Section SectionSep)* Section EOF
Frontmatter    := SectionSep YAML SectionSep
SectionSep     := NEWLINE "---" NEWLINE
Section        := Block+
```

The first `---` ... `---` block is always frontmatter. Every subsequent `---` starts a new section. A document must contain at least one section after the frontmatter.

### 2.2 Frontmatter

The frontmatter block is YAML with the following recognized keys:

```yaml
---
theme: warm-editorial          # required: theme preset name
mode: landing                  # optional: page mode (landing | article | docs)
lang: en                       # optional: language code (default: en)
title: "Page Title"            # optional: HTML <title>
description: "..."             # optional: meta description
tokens:                        # optional: token overrides (see Section 4)
  color.accent.default: "#C84B31"
  space.section: 100
---
```

**`theme`** is required. Override syntax supports inline shorthand: `theme: warm-editorial + color.accent.default=#C84B31`, which is desugared into the `tokens` map during parsing.

**`mode`** controls global layout parameters:
- `landing`: full-width sections, no max-width constraint on outer wrapper, section padding from `space.section` token.
- `article`: centered content column at `max-width: 720px`, prose-optimized spacing.
- `docs`: two-column layout with sidebar nav at 240px and content column at remaining width.

Default is `landing`.

### 2.3 Block declaration

```
Block          := BlockHeader NEWLINE IndentedBody
BlockHeader    := Type ModChain? ":"
Type           := IDENTIFIER
ModChain       := "|" Modifier (Modifier)*
Modifier       := IDENTIFIER ModArg?
ModArg         := "(" ArgValue ("/" ArgValue)* ")"
ArgValue       := NUMBER | IDENTIFIER | STRING
```

Examples:
```
hero | split(60/40) pad(xl):
features | grid(3) gap(lg):
quote | accent:
prose:
cta | role(primary) centered:
figure | aspect(4/3) rounded shadow(lg):
```

**Type** is one of the built-in section types (Section 5) or `stack` / `grid` / `split` for generic layout containers.

**Modifier chain** follows the `|` separator. Modifiers are space-separated. Each modifier is a keyword optionally followed by parenthesized arguments. Arguments within parens are `/`-separated (not comma-separated) to avoid quoting issues. A modifier without arguments is a boolean flag (`rounded`, `accent`, `bleed`).

### 2.4 Properties and children

Inside a block's indented body, content is expressed as key-value properties or nested blocks.

```
IndentedBody   := (Property | NestedBlock | ArrayItem)*
Property       := Key ":" Value
NestedBlock    := Key ":" NEWLINE INDENT IndentedBody DEDENT
ArrayItem      := "-" (InlineObject | Value)
InlineObject   := Property ("|" Property)*
Key            := IDENTIFIER | IDENTIFIER "[" NUMBER "]"
Value          := InlineValue | BlockValue
InlineValue    := StringLiteral | Reference | InlineModified
BlockValue     := "|" NEWLINE INDENT TextLines DEDENT
InlineModified := Value "|" Modifier (Modifier)*
```

**Inline values** appear on the same line as the key:

```yaml
headline: Make something worth reading
body: Tela composes HTML pages from layout primitives.
figure: ./hero.png | aspect(4/3) rounded shadow(lg)
icon: star
```

**Block values** (multiline text) use `|` followed by an indented block, identical to YAML literal block scalar syntax:

```yaml
headline: |
  Make something
  worth reading
```

Lines are joined with a single newline. Trailing newlines are stripped.

**References** start with `./` and point to asset files relative to the `.tela` file's directory:

```yaml
figure: ./hero.png
```

**Inline modifier chains** can be appended to any value with `|`:

```yaml
figure: ./hero.png | aspect(4/3) rounded shadow(lg)
label: Get started | role(primary)
icon: star | accent
```

**Array shorthand** uses `-` for lists of items:

```yaml
cta:
  - label: Get started   | role(primary)
  - label: See examples  | role(ghost)
```

Array items can be inline objects (properties separated by `|` on the same line) or simple values:

```yaml
tags:
  - TypeScript
  - MCP
  - HTML
```

**Inline objects** within array items use `|` to separate properties on one line:

```yaml
- label: Get started | role(primary)
```

This parses as `{ label: "Get started", role: "primary" }`. The rule: if the text after `|` matches `key(value)` or a known modifier name, it is a modifier. If it matches `key: value`, it is an inline property. Ambiguity is resolved by checking the modifier registry first.

### 2.5 String literals

Bare strings (unquoted) are the default and cover most cases:

```yaml
headline: Make something worth reading
```

Quoted strings (double quotes) are required when the value contains `:`, `|`, `#`, or leading/trailing whitespace:

```yaml
eyebrow: "v2.0 · Now in beta"
```

Single quotes are not supported. Use double quotes exclusively.

### 2.6 Comments

Lines starting with `#` (after optional whitespace) are comments and ignored by the parser:

```yaml
# This section showcases the product
hero | split(60/40):
  headline: Build faster  # inline comments also work
```

Inline comments start with `#` preceded by at least one space.

### 2.7 Escaping

- `\"` within double-quoted strings produces a literal `"`
- `\n` within double-quoted strings produces a newline
- `\|` produces a literal `|` in bare strings (prevents modifier chain parsing)
- `\#` produces a literal `#` in bare strings (prevents comment parsing)
- `\\` produces a literal `\`

### 2.8 Indentation

Indentation is 2 spaces per level. Tabs are rejected by the parser with a clear error message. Mixed indentation within a file is a parse error.

### 2.9 Section IDs

Each section is assigned an auto-generated ID based on its position (`section-0`, `section-1`, ...) unless the block header includes an explicit ID via the `id` modifier:

```yaml
hero | id(intro) split(60/40):
```

Section IDs must be unique within a document. Duplicate IDs are a parse error.

---

## 3. AST Node Types

All AST types are defined in `src/ast/types.ts`.

```typescript
/** Root document node. */
interface TelaDocument {
  type: 'document';
  frontmatter: Frontmatter;
  sections: Section[];
  source: SourceLocation;
}

interface Frontmatter {
  theme: string;               // e.g. "warm-editorial"
  mode: 'landing' | 'article' | 'docs';
  lang: string;                // BCP 47 language tag
  title?: string;
  description?: string;
  tokenOverrides: Record<string, string | number>;
  raw: Record<string, unknown>; // full parsed YAML for extension
}

interface SourceLocation {
  file?: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

/** A section is a top-level content region separated by --- */
interface Section {
  type: 'section';
  id: string;                  // auto-generated or explicit
  block: Block;                // root block of this section
  source: SourceLocation;
}

/** A typed layout block with modifiers, properties, and children. */
interface Block {
  type: 'block';
  blockType: string;           // "hero", "features", "grid", "prose", etc.
  modifiers: Modifier[];
  properties: Record<string, Value>;
  children: (Block | ArrayValue)[];
  source: SourceLocation;
}

interface Modifier {
  type: 'modifier';
  name: string;                // "split", "pad", "gap", "rounded", etc.
  args: (string | number)[];   // e.g. [60, 40] for split(60/40), [] for boolean
  source: SourceLocation;
}

/** Discriminated union of all value types. */
type Value =
  | StringValue
  | NumberValue
  | ReferenceValue
  | MultilineValue
  | ModifiedValue
  | BlockValue
  | ArrayValue;

interface StringValue {
  type: 'string';
  value: string;
  source: SourceLocation;
}

interface NumberValue {
  type: 'number';
  value: number;
  source: SourceLocation;
}

interface ReferenceValue {
  type: 'reference';
  path: string;               // relative path, e.g. "./hero.png"
  source: SourceLocation;
}

interface MultilineValue {
  type: 'multiline';
  lines: string[];
  source: SourceLocation;
}

interface ModifiedValue {
  type: 'modified';
  base: Value;                 // the underlying value
  modifiers: Modifier[];       // inline modifiers applied to this value
  source: SourceLocation;
}

interface BlockValue {
  type: 'blockValue';
  properties: Record<string, Value>;
  children: (Block | ArrayValue)[];
  source: SourceLocation;
}

interface ArrayValue {
  type: 'array';
  items: Value[];
  source: SourceLocation;
}
```

### 3.1 Atom types

Atoms are leaf-level content that the renderer resolves from property values. They are not AST nodes themselves -- they are a renderer-level concept that maps from `Value` nodes during compilation.

```typescript
type Atom =
  | TextAtom
  | ImageAtom
  | IconAtom
  | CodeAtom
  | ListAtom;

interface TextAtom {
  kind: 'text';
  content: string;
  role: 'headline' | 'eyebrow' | 'body' | 'lead' | 'caption' | 'label';
}

interface ImageAtom {
  kind: 'image';
  src: string;                 // resolved absolute path or URL
  alt?: string;
  aspect?: [number, number];
}

interface IconAtom {
  kind: 'icon';
  name: string;                // icon identifier or literal character
  accent: boolean;
}

interface CodeAtom {
  kind: 'code';
  content: string;
  language?: string;
}

interface ListAtom {
  kind: 'list';
  items: string[];
  ordered: boolean;
}
```

---

## 4. Token System -- Complete Spec

Tokens are the design vocabulary. Every visual property (color, spacing, typography, elevation, radius) is expressed as a token. Components never use raw values -- they reference tokens, and the renderer resolves tokens to CSS custom properties.

### 4.1 Token namespaces

```
color.surface.{default|elevated|warm|inverted}
color.text.{primary|secondary|caption|accent|inverse}
color.border.{subtle|default|strong}
color.accent.{default|tint|shade}

space.{xs|sm|md|lg|xl|section}

type.scale.{caption|body|lead|h3|h2|h1|display}
type.weight.{body|heading}
type.leading.{tight|default|loose}
type.family.{serif|sans|mono}

elevation.{flat|raised|floating}
radius.{sm|md|lg|xl|pill}
```

### 4.2 Theme preset values

#### `warm-editorial`

Inspired by Kami's parchment aesthetic. Warm surfaces, a single accent color, serif typography.

| Token | Value | CSS |
|-------|-------|-----|
| `color.surface.default` | `#f5f4ed` | `--t-surface-default` |
| `color.surface.elevated` | `#faf9f5` | `--t-surface-elevated` |
| `color.surface.warm` | `#e8e6dc` | `--t-surface-warm` |
| `color.surface.inverted` | `#141413` | `--t-surface-inverted` |
| `color.text.primary` | `#141413` | `--t-text-primary` |
| `color.text.secondary` | `#3d3d3a` | `--t-text-secondary` |
| `color.text.caption` | `#6b6a64` | `--t-text-caption` |
| `color.text.accent` | `#1B365D` | `--t-text-accent` |
| `color.text.inverse` | `#faf9f5` | `--t-text-inverse` |
| `color.border.subtle` | `#e5e3d8` | `--t-border-subtle` |
| `color.border.default` | `#e8e6dc` | `--t-border-default` |
| `color.border.strong` | `#504e49` | `--t-border-strong` |
| `color.accent.default` | `#1B365D` | `--t-accent-default` |
| `color.accent.tint` | `#EEF2F7` | `--t-accent-tint` |
| `color.accent.shade` | `#0E1B2F` | `--t-accent-shade` |
| `space.xs` | `4px` | `--t-space-xs` |
| `space.sm` | `8px` | `--t-space-sm` |
| `space.md` | `16px` | `--t-space-md` |
| `space.lg` | `24px` | `--t-space-lg` |
| `space.xl` | `40px` | `--t-space-xl` |
| `space.section` | `80px` | `--t-space-section` |
| `type.scale.caption` | `12px` | `--t-scale-caption` |
| `type.scale.body` | `16px` | `--t-scale-body` |
| `type.scale.lead` | `20px` | `--t-scale-lead` |
| `type.scale.h3` | `24px` | `--t-scale-h3` |
| `type.scale.h2` | `32px` | `--t-scale-h2` |
| `type.scale.h1` | `48px` | `--t-scale-h1` |
| `type.scale.display` | `64px` | `--t-scale-display` |
| `type.weight.body` | `400` | `--t-weight-body` |
| `type.weight.heading` | `500` | `--t-weight-heading` |
| `type.leading.tight` | `1.2` | `--t-leading-tight` |
| `type.leading.default` | `1.5` | `--t-leading-default` |
| `type.leading.loose` | `1.7` | `--t-leading-loose` |
| `type.family.serif` | `Charter, Georgia, 'Palatino Linotype', 'Times New Roman', serif` | `--t-family-serif` |
| `type.family.sans` | `'Inter', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif` | `--t-family-sans` |
| `type.family.mono` | `'JetBrains Mono', 'SF Mono', 'Fira Code', Consolas, monospace` | `--t-family-mono` |
| `elevation.flat` | `none` | `--t-elevation-flat` |
| `elevation.raised` | `0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)` | `--t-elevation-raised` |
| `elevation.floating` | `0 4px 24px rgba(0,0,0,0.06)` | `--t-elevation-floating` |
| `radius.sm` | `4px` | `--t-radius-sm` |
| `radius.md` | `8px` | `--t-radius-md` |
| `radius.lg` | `16px` | `--t-radius-lg` |
| `radius.xl` | `24px` | `--t-radius-xl` |
| `radius.pill` | `999px` | `--t-radius-pill` |

#### `cool-technical`

Clean, sharp, modern. Blue-gray surfaces, tighter spacing, sans-serif default.

| Token | Value |
|-------|-------|
| `color.surface.default` | `#f8f9fa` |
| `color.surface.elevated` | `#ffffff` |
| `color.surface.warm` | `#e9ecef` |
| `color.surface.inverted` | `#1a1a2e` |
| `color.text.primary` | `#212529` |
| `color.text.secondary` | `#495057` |
| `color.text.caption` | `#868e96` |
| `color.text.accent` | `#2563eb` |
| `color.text.inverse` | `#f8f9fa` |
| `color.border.subtle` | `#e9ecef` |
| `color.border.default` | `#dee2e6` |
| `color.border.strong` | `#495057` |
| `color.accent.default` | `#2563eb` |
| `color.accent.tint` | `#eff6ff` |
| `color.accent.shade` | `#1e40af` |
| `space.xs` | `4px` |
| `space.sm` | `8px` |
| `space.md` | `16px` |
| `space.lg` | `24px` |
| `space.xl` | `40px` |
| `space.section` | `72px` |
| `type.scale.caption` | `12px` |
| `type.scale.body` | `15px` |
| `type.scale.lead` | `18px` |
| `type.scale.h3` | `22px` |
| `type.scale.h2` | `30px` |
| `type.scale.h1` | `44px` |
| `type.scale.display` | `60px` |
| `type.weight.body` | `400` |
| `type.weight.heading` | `600` |
| `type.leading.tight` | `1.15` |
| `type.leading.default` | `1.5` |
| `type.leading.loose` | `1.65` |
| `type.family.serif` | `'Source Serif 4', Georgia, serif` |
| `type.family.sans` | `'Inter', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif` |
| `type.family.mono` | `'JetBrains Mono', 'SF Mono', 'Fira Code', Consolas, monospace` |
| `elevation.flat` | `none` |
| `elevation.raised` | `0 1px 2px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)` |
| `elevation.floating` | `0 8px 30px rgba(0,0,0,0.08)` |
| `radius.sm` | `4px` |
| `radius.md` | `6px` |
| `radius.lg` | `12px` |
| `radius.xl` | `20px` |
| `radius.pill` | `999px` |

#### `neutral-minimal`

Maximum restraint. Near-monochrome, generous whitespace, content-first.

| Token | Value |
|-------|-------|
| `color.surface.default` | `#ffffff` |
| `color.surface.elevated` | `#ffffff` |
| `color.surface.warm` | `#f5f5f5` |
| `color.surface.inverted` | `#111111` |
| `color.text.primary` | `#111111` |
| `color.text.secondary` | `#555555` |
| `color.text.caption` | `#888888` |
| `color.text.accent` | `#111111` |
| `color.text.inverse` | `#ffffff` |
| `color.border.subtle` | `#eeeeee` |
| `color.border.default` | `#dddddd` |
| `color.border.strong` | `#333333` |
| `color.accent.default` | `#111111` |
| `color.accent.tint` | `#f5f5f5` |
| `color.accent.shade` | `#000000` |
| `space.xs` | `4px` |
| `space.sm` | `8px` |
| `space.md` | `20px` |
| `space.lg` | `32px` |
| `space.xl` | `48px` |
| `space.section` | `96px` |
| `type.scale.caption` | `11px` |
| `type.scale.body` | `16px` |
| `type.scale.lead` | `20px` |
| `type.scale.h3` | `22px` |
| `type.scale.h2` | `32px` |
| `type.scale.h1` | `48px` |
| `type.scale.display` | `72px` |
| `type.weight.body` | `400` |
| `type.weight.heading` | `400` |
| `type.leading.tight` | `1.1` |
| `type.leading.default` | `1.55` |
| `type.leading.loose` | `1.7` |
| `type.family.serif` | `'EB Garamond', Garamond, 'Times New Roman', serif` |
| `type.family.sans` | `'Inter', 'Helvetica Neue', Arial, sans-serif` |
| `type.family.mono` | `'IBM Plex Mono', 'SF Mono', Consolas, monospace` |
| `elevation.flat` | `none` |
| `elevation.raised` | `0 1px 4px rgba(0,0,0,0.04)` |
| `elevation.floating` | `0 4px 20px rgba(0,0,0,0.06)` |
| `radius.sm` | `2px` |
| `radius.md` | `4px` |
| `radius.lg` | `8px` |
| `radius.xl` | `16px` |
| `radius.pill` | `999px` |

#### `dark-dramatic`

Deep backgrounds, high contrast, theatrical lighting via accent colors.

| Token | Value |
|-------|-------|
| `color.surface.default` | `#0a0a0a` |
| `color.surface.elevated` | `#141414` |
| `color.surface.warm` | `#1e1e1e` |
| `color.surface.inverted` | `#f5f5f5` |
| `color.text.primary` | `#f0f0f0` |
| `color.text.secondary` | `#a0a0a0` |
| `color.text.caption` | `#6b6b6b` |
| `color.text.accent` | `#ff6b35` |
| `color.text.inverse` | `#0a0a0a` |
| `color.border.subtle` | `#1e1e1e` |
| `color.border.default` | `#2a2a2a` |
| `color.border.strong` | `#555555` |
| `color.accent.default` | `#ff6b35` |
| `color.accent.tint` | `#1a1008` |
| `color.accent.shade` | `#cc4e1a` |
| `space.xs` | `4px` |
| `space.sm` | `8px` |
| `space.md` | `16px` |
| `space.lg` | `28px` |
| `space.xl` | `48px` |
| `space.section` | `88px` |
| `type.scale.caption` | `12px` |
| `type.scale.body` | `16px` |
| `type.scale.lead` | `20px` |
| `type.scale.h3` | `24px` |
| `type.scale.h2` | `36px` |
| `type.scale.h1` | `52px` |
| `type.scale.display` | `72px` |
| `type.weight.body` | `400` |
| `type.weight.heading` | `600` |
| `type.leading.tight` | `1.1` |
| `type.leading.default` | `1.5` |
| `type.leading.loose` | `1.65` |
| `type.family.serif` | `'Playfair Display', Georgia, serif` |
| `type.family.sans` | `'Inter', 'SF Pro Display', -apple-system, sans-serif` |
| `type.family.mono` | `'JetBrains Mono', 'Fira Code', monospace` |
| `elevation.flat` | `none` |
| `elevation.raised` | `0 2px 8px rgba(0,0,0,0.3)` |
| `elevation.floating` | `0 8px 40px rgba(0,0,0,0.4)` |
| `radius.sm` | `4px` |
| `radius.md` | `8px` |
| `radius.lg` | `16px` |
| `radius.xl` | `24px` |
| `radius.pill` | `999px` |

### 4.3 Override resolution algorithm

Token resolution follows a strict three-level precedence chain:

```
resolved_value = user_override ?? theme_value ?? default_value
```

1. **User overrides** -- specified in frontmatter `tokens:` map or inline `theme: name + key=value` syntax. Highest priority.
2. **Theme preset** -- the named theme's token table.
3. **Default values** -- the `warm-editorial` theme serves as the default fallback for any token not defined by the active theme.

Resolution is performed once at compile time (AST to component tree). The resolver produces a flat `Record<string, string>` mapping every CSS custom property name to its resolved value.

```typescript
interface ResolvedTokens {
  /** Flat map from CSS custom property name to value. */
  values: Record<string, string>;
  /** Tokens that were overridden by the user. */
  overrides: string[];
  /** Theme that was used as the base. */
  theme: string;
}

function resolveTokens(
  themeName: string,
  overrides: Record<string, string | number>
): ResolvedTokens;
```

The resolver validates that all override keys are valid token paths. Unknown keys produce a compile error, not a silent ignore.

### 4.4 CSS custom property naming

Token paths map to CSS custom properties with the prefix `--t-` and dots replaced by hyphens:

```
color.surface.default  →  --t-surface-default
color.text.primary     →  --t-text-primary
space.lg               →  --t-space-lg
type.scale.h1          →  --t-scale-h1
type.leading.default   →  --t-leading-default
type.family.serif      →  --t-family-serif
```

The `color.` prefix is dropped from the CSS name to reduce verbosity. All other namespace prefixes are similarly shortened: `space.` becomes `space-`, `type.scale.` becomes `scale-`, etc.

---

## 5. Component Library -- Full Primitive Catalog

Each built-in block type maps to a component function that receives resolved tokens, properties, and children and returns an HTML string.

### 5.1 `hero`

The primary above-the-fold section. High visual impact, large typography.

**Required props:** `headline`

**Optional props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `eyebrow` | string | none | Small label above headline |
| `headline` | string | *required* | Primary heading (rendered as `<h1>`) |
| `body` | string | none | Supporting paragraph |
| `cta` | array | `[]` | Call-to-action buttons |
| `figure` | reference | none | Hero image |
| `left` | block | none | Left sub-block (for split layout) |
| `right` | block | none | Right sub-block (for split layout) |

**Valid modifiers:** `split(ratio)`, `pad(size)`, `bg(token)`, `centered`, `inverted`, `bleed`

**Generated HTML:**

```html
<section class="tela-hero tela-hero--split-60-40" style="padding: var(--t-space-xl) var(--t-space-section);">
  <div class="tela-hero__inner" style="display: grid; grid-template-columns: 60fr 40fr; gap: var(--t-space-xl); max-width: 1200px; margin: 0 auto; align-items: center;">
    <div class="tela-hero__left">
      <p class="tela-eyebrow" style="font-size: var(--t-scale-caption); font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; color: var(--t-text-caption); margin-bottom: var(--t-space-sm);">v2.0 &middot; Now in beta</p>
      <h1 class="tela-headline" style="font-family: var(--t-family-serif); font-size: var(--t-scale-display); font-weight: var(--t-weight-heading); line-height: var(--t-leading-tight); color: var(--t-text-primary); margin: 0 0 var(--t-space-md) 0;">Make something<br>worth reading</h1>
      <p class="tela-body" style="font-size: var(--t-scale-lead); line-height: var(--t-leading-default); color: var(--t-text-secondary); margin: 0 0 var(--t-space-lg) 0; max-width: 520px;">Tela composes HTML pages from layout primitives.</p>
      <div class="tela-cta-group" style="display: flex; gap: var(--t-space-sm); flex-wrap: wrap;">
        <a class="tela-btn tela-btn--primary" href="#" style="display: inline-flex; align-items: center; padding: var(--t-space-sm) var(--t-space-lg); background: var(--t-accent-default); color: var(--t-text-inverse); font-size: var(--t-scale-body); font-weight: 500; border-radius: var(--t-radius-md); text-decoration: none;">Get started</a>
        <a class="tela-btn tela-btn--ghost" href="#" style="display: inline-flex; align-items: center; padding: var(--t-space-sm) var(--t-space-lg); background: transparent; color: var(--t-text-primary); font-size: var(--t-scale-body); font-weight: 500; border: 1px solid var(--t-border-default); border-radius: var(--t-radius-md); text-decoration: none;">See examples</a>
      </div>
    </div>
    <div class="tela-hero__right">
      <img src="hero.png" alt="" class="tela-figure" style="width: 100%; height: auto; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--t-radius-lg); box-shadow: var(--t-elevation-floating);">
    </div>
  </div>
</section>
```

**Design notes:**
- The `split` modifier creates a CSS Grid with `fr` units derived from the ratio. `split(60/40)` becomes `60fr 40fr`.
- Without `split`, the hero stacks vertically with the headline group centered.
- `display` scale is used for the headline by default. If the headline exceeds 60 characters, the renderer downgrades to `h1` scale to prevent text overflow.
- Hero sections should occupy at minimum 70vh visual height. The `pad` modifier on the section achieves this through generous vertical padding rather than explicit `min-height`, which avoids awkward stretching on short content.

### 5.2 `feature`

A single feature card. Typically used inside a `grid` or `stack`.

**Required props:** `title`

**Optional props:**
| Prop | Type | Default |
|------|------|---------|
| `icon` | string | none |
| `title` | string | *required* |
| `body` | string | none |
| `figure` | reference | none |
| `link` | string | none |

**Valid modifiers:** `accent`, `muted`, `pad(size)`, `rounded`, `shadow(size)`, `bg(token)`

**Generated HTML:**

```html
<div class="tela-feature" style="padding: var(--t-space-lg); background: var(--t-surface-elevated); border-radius: var(--t-radius-md); box-shadow: var(--t-elevation-raised);">
  <div class="tela-feature__icon" style="font-size: 24px; color: var(--t-accent-default); margin-bottom: var(--t-space-sm);">&#9670;</div>
  <h3 class="tela-feature__title" style="font-family: var(--t-family-serif); font-size: var(--t-scale-h3); font-weight: var(--t-weight-heading); line-height: var(--t-leading-tight); color: var(--t-text-primary); margin: 0 0 var(--t-space-xs) 0;">Composable</h3>
  <p class="tela-feature__body" style="font-size: var(--t-scale-body); line-height: var(--t-leading-default); color: var(--t-text-secondary); margin: 0;">30+ primitives. Combine freely.</p>
</div>
```

**Design notes:**
- Feature cards should maintain equal height when placed in a grid. The grid container handles this with `align-items: stretch`.
- Icons should be subtle -- a single character or small SVG, tinted with the accent color. Never larger than 32px.
- Body text in features should be 1-2 sentences maximum. The checker warns when feature body text exceeds 120 characters.

### 5.3 `grid`

A CSS Grid container for arranging children in columns.

**Required props:** none (children are required)

**Optional props:**
| Prop | Type | Default |
|------|------|---------|
| (children) | Block[] | *required* |

**Valid modifiers:** `grid(n)` (column count, 1-6), `gap(size)`, `pad(size)`, `bg(token)`, `bleed`

The `grid` modifier argument is required: `grid(3)` produces a 3-column grid.

**Generated HTML:**

```html
<div class="tela-grid tela-grid--3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--t-space-lg); padding: var(--t-space-section) var(--t-space-xl); max-width: 1200px; margin: 0 auto;">
  <!-- child blocks rendered here -->
</div>
```

**Design notes:**
- Grids of 4+ columns collapse to 2 columns below 768px viewport width and 1 column below 480px. This is handled via a `@media` block emitted per grid instance.
- `grid(1)` is valid and produces a single-column stack with the grid's gap applied -- useful for consistent spacing in a list of cards.

### 5.4 `prose`

Long-form text content with proper typographic treatment.

**Required props:** `body` (or inline text children)

**Optional props:**
| Prop | Type | Default |
|------|------|---------|
| `body` | string/multiline | *required* |
| `title` | string | none |
| `lead` | string | none |

**Valid modifiers:** `pad(size)`, `centered`, `bg(token)`, `muted`

**Generated HTML:**

```html
<section class="tela-prose" style="padding: var(--t-space-section) var(--t-space-xl); max-width: 720px; margin: 0 auto;">
  <h2 class="tela-prose__title" style="font-family: var(--t-family-serif); font-size: var(--t-scale-h2); font-weight: var(--t-weight-heading); line-height: var(--t-leading-tight); color: var(--t-text-primary); margin: 0 0 var(--t-space-md) 0;">Section Title</h2>
  <p class="tela-prose__lead" style="font-size: var(--t-scale-lead); line-height: var(--t-leading-default); color: var(--t-text-secondary); margin: 0 0 var(--t-space-lg) 0;">Lead paragraph text.</p>
  <div class="tela-prose__body" style="font-size: var(--t-scale-body); line-height: var(--t-leading-loose); color: var(--t-text-primary);">
    <p>Body text content here. Paragraphs separated by blank lines in the multiline value become separate &lt;p&gt; elements.</p>
  </div>
</section>
```

**Design notes:**
- Prose sections are always constrained to 720px max-width for optimal reading measure (45-75 characters per line at 16px body text).
- The `loose` line-height is used for body text to maximize readability.
- Paragraph spacing within prose is `space.md` (margin-bottom on `<p>` elements).

### 5.5 `quote`

A blockquote with optional attribution.

**Required props:** `text`

**Optional props:**
| Prop | Type | Default |
|------|------|---------|
| `text` | string/multiline | *required* |
| `cite` | string | none |
| `role` | string | none |

**Valid modifiers:** `accent`, `centered`, `pad(size)`, `bg(token)`

**Generated HTML:**

```html
<blockquote class="tela-quote" style="padding: var(--t-space-lg) 0 var(--t-space-lg) var(--t-space-lg); border-left: 3px solid var(--t-accent-default); margin: 0; max-width: 720px;">
  <p class="tela-quote__text" style="font-family: var(--t-family-serif); font-size: var(--t-scale-lead); font-style: normal; line-height: var(--t-leading-default); color: var(--t-text-primary); margin: 0 0 var(--t-space-sm) 0;">"Design is not just what it looks like. Design is how it works."</p>
  <footer class="tela-quote__cite" style="font-size: var(--t-scale-caption); color: var(--t-text-caption);">
    <span class="tela-quote__author">Steve Jobs</span><span class="tela-quote__role">, Apple</span>
  </footer>
</blockquote>
```

**Design notes:**
- No italic. Following Kami's principle: italic is visually noisy and harms readability, especially for serif fonts. Quotes are distinguished by the left border and scale change.
- The border-left width is fixed at 3px (not token-controlled) because it is a decorative element, not a spacing element.

### 5.6 `testimonial`

A specialized quote with avatar and structured attribution. Designed for social proof sections.

**Required props:** `text`, `name`

**Optional props:**
| Prop | Type | Default |
|------|------|---------|
| `text` | string/multiline | *required* |
| `name` | string | *required* |
| `role` | string | none |
| `company` | string | none |
| `avatar` | reference | none |

**Valid modifiers:** `pad(size)`, `rounded`, `shadow(size)`, `bg(token)`

**Generated HTML:**

```html
<div class="tela-testimonial" style="padding: var(--t-space-lg); background: var(--t-surface-elevated); border-radius: var(--t-radius-md);">
  <p class="tela-testimonial__text" style="font-size: var(--t-scale-body); line-height: var(--t-leading-default); color: var(--t-text-primary); margin: 0 0 var(--t-space-md) 0;">"Tela changed how we build landing pages."</p>
  <div class="tela-testimonial__author" style="display: flex; align-items: center; gap: var(--t-space-sm);">
    <img src="avatar.jpg" alt="Jane Doe" class="tela-testimonial__avatar" style="width: 40px; height: 40px; border-radius: var(--t-radius-pill); object-fit: cover;">
    <div>
      <div class="tela-testimonial__name" style="font-size: var(--t-scale-body); font-weight: 500; color: var(--t-text-primary);">Jane Doe</div>
      <div class="tela-testimonial__role" style="font-size: var(--t-scale-caption); color: var(--t-text-caption);">CTO, Acme Corp</div>
    </div>
  </div>
</div>
```

**Design notes:**
- Avatar is always circular (pill radius). If no avatar is provided, the avatar element is omitted entirely -- no placeholder initials or generic icon.
- Testimonials are best in grids of 2-3. A single testimonial should be wrapped in a `centered` modifier to avoid stretching across the full viewport.

### 5.7 `cta`

A call-to-action section -- a focused prompt for user action.

**Required props:** `headline`

**Optional props:**
| Prop | Type | Default |
|------|------|---------|
| `headline` | string | *required* |
| `body` | string | none |
| `actions` | array | `[]` |

**Valid modifiers:** `centered`, `pad(size)`, `bg(token)`, `inverted`, `accent`

**Generated HTML:**

```html
<section class="tela-cta" style="padding: var(--t-space-section) var(--t-space-xl); background: var(--t-accent-default); text-align: center;">
  <div class="tela-cta__inner" style="max-width: 640px; margin: 0 auto;">
    <h2 class="tela-cta__headline" style="font-family: var(--t-family-serif); font-size: var(--t-scale-h1); font-weight: var(--t-weight-heading); line-height: var(--t-leading-tight); color: var(--t-text-inverse); margin: 0 0 var(--t-space-sm) 0;">Ready to get started?</h2>
    <p class="tela-cta__body" style="font-size: var(--t-scale-lead); line-height: var(--t-leading-default); color: var(--t-text-inverse); opacity: 0.85; margin: 0 0 var(--t-space-lg) 0;">Join thousands of teams building better pages.</p>
    <div class="tela-cta__actions" style="display: flex; gap: var(--t-space-sm); justify-content: center; flex-wrap: wrap;">
      <a class="tela-btn tela-btn--primary tela-btn--inverted" href="#" style="padding: var(--t-space-sm) var(--t-space-xl); background: var(--t-surface-default); color: var(--t-accent-default); font-size: var(--t-scale-body); font-weight: 500; border-radius: var(--t-radius-md); text-decoration: none;">Get started free</a>
    </div>
  </div>
</section>
```

**Design notes:**
- CTA sections with `inverted` or `accent` background flip button colors: the primary button becomes surface-colored on accent background. This inversion is automatic -- the component detects whether its background is dark and flips accordingly.
- CTA sections should be near the bottom of the page but not the absolute last element (that is the footer). The checker warns if CTA is the last section.

### 5.8 `figure`

An image or media element with optional caption.

**Required props:** `src`

**Optional props:**
| Prop | Type | Default |
|------|------|---------|
| `src` | reference | *required* |
| `alt` | string | `""` |
| `caption` | string | none |

**Valid modifiers:** `aspect(w/h)`, `rounded`, `shadow(size)`, `bleed`, `float`, `centered`

**Generated HTML:**

```html
<figure class="tela-figure" style="margin: 0; padding: var(--t-space-lg) 0; max-width: 100%;">
  <img src="screenshot.png" alt="Dashboard screenshot" style="width: 100%; height: auto; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--t-radius-lg); box-shadow: var(--t-elevation-floating);">
  <figcaption class="tela-figure__caption" style="font-size: var(--t-scale-caption); color: var(--t-text-caption); margin-top: var(--t-space-sm); text-align: center;">Dashboard overview showing key metrics.</figcaption>
</figure>
```

**Design notes:**
- The `bleed` modifier removes the max-width constraint and adds negative horizontal margins, allowing the image to extend beyond the content column. Only valid in `article` and `docs` modes.
- The `float` modifier applies `float: right; width: 50%; margin-left: var(--t-space-lg);` for inline figures within prose sections.
- `aspect` is enforced via CSS `aspect-ratio` and `object-fit: cover`. The image is never distorted.

### 5.9 `gallery`

A grid of images, optionally with captions.

**Required props:** (children array of figures)

**Optional props:**
| Prop | Type | Default |
|------|------|---------|
| `columns` | number | `3` |
| (children) | figure[] | *required* |

**Valid modifiers:** `grid(n)`, `gap(size)`, `pad(size)`, `masonry(n)`

**Generated HTML:**

```html
<div class="tela-gallery tela-gallery--3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--t-space-md); padding: var(--t-space-lg) 0;">
  <figure class="tela-gallery__item" style="margin: 0;">
    <img src="photo-1.jpg" alt="Photo 1" style="width: 100%; height: auto; aspect-ratio: 1/1; object-fit: cover; border-radius: var(--t-radius-sm);">
  </figure>
  <figure class="tela-gallery__item" style="margin: 0;">
    <img src="photo-2.jpg" alt="Photo 2" style="width: 100%; height: auto; aspect-ratio: 1/1; object-fit: cover; border-radius: var(--t-radius-sm);">
  </figure>
  <figure class="tela-gallery__item" style="margin: 0;">
    <img src="photo-3.jpg" alt="Photo 3" style="width: 100%; height: auto; aspect-ratio: 1/1; object-fit: cover; border-radius: var(--t-radius-sm);">
  </figure>
</div>
```

**Design notes:**
- Gallery items default to `aspect-ratio: 1/1` (square) unless individual items specify their own aspect ratio.
- The `masonry` modifier uses CSS `column-count` instead of Grid to achieve masonry layout. Items with varying heights flow naturally. This is a pragmatic choice -- CSS masonry grid is not widely supported yet.

### 5.10 `aside`

A secondary content block -- tips, warnings, notes.

**Required props:** `body`

**Optional props:**
| Prop | Type | Default |
|------|------|---------|
| `body` | string/multiline | *required* |
| `title` | string | none |
| `kind` | `note` / `tip` / `warning` / `danger` | `note` |

**Valid modifiers:** `pad(size)`, `bg(token)`, `rounded`

**Generated HTML:**

```html
<aside class="tela-aside tela-aside--tip" style="padding: var(--t-space-md) var(--t-space-lg); background: var(--t-accent-tint); border-left: 3px solid var(--t-accent-default); border-radius: 0 var(--t-radius-sm) var(--t-radius-sm) 0; margin: var(--t-space-lg) 0;">
  <p class="tela-aside__title" style="font-size: var(--t-scale-caption); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--t-accent-default); margin: 0 0 var(--t-space-xs) 0;">Tip</p>
  <p class="tela-aside__body" style="font-size: var(--t-scale-body); line-height: var(--t-leading-default); color: var(--t-text-primary); margin: 0;">Use the checker after every render to catch spacing issues early.</p>
</aside>
```

**Design notes:**
- `kind` controls the accent color of the left border and title. For `warning` and `danger`, a warm color is used: `warning` gets `#c87a2f` (amber), `danger` gets `#c0392b` (red). These are hardcoded per-kind overrides, not token-driven, because they carry semantic meaning that should not vary by theme.

### 5.11 `divider`

A horizontal rule or visual separator between sections.

**Required props:** none

**Optional props:**
| Prop | Type | Default |
|------|------|---------|
| `label` | string | none |

**Valid modifiers:** `muted`, `accent`

**Generated HTML (plain):**

```html
<hr class="tela-divider" style="border: none; border-top: 1px solid var(--t-border-default); margin: var(--t-space-section) auto; max-width: 1200px;">
```

**Generated HTML (with label):**

```html
<div class="tela-divider tela-divider--labeled" style="display: flex; align-items: center; gap: var(--t-space-md); margin: var(--t-space-section) auto; max-width: 1200px;">
  <span style="flex: 1; height: 1px; background: var(--t-border-default);"></span>
  <span style="font-size: var(--t-scale-caption); color: var(--t-text-caption); text-transform: uppercase; letter-spacing: 0.1em;">Section</span>
  <span style="flex: 1; height: 1px; background: var(--t-border-default);"></span>
</div>
```

### 5.12 `footer`

Page footer with optional columns of links and a copyright line.

**Required props:** none

**Optional props:**
| Prop | Type | Default |
|------|------|---------|
| `copyright` | string | none |
| `columns` | array of `{title, links[]}` | `[]` |
| `social` | array of `{icon, url}` | `[]` |

**Valid modifiers:** `pad(size)`, `bg(token)`, `inverted`

**Generated HTML:**

```html
<footer class="tela-footer" style="padding: var(--t-space-section) var(--t-space-xl) var(--t-space-xl); background: var(--t-surface-inverted); color: var(--t-text-inverse);">
  <div class="tela-footer__inner" style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--t-space-xl);">
    <div class="tela-footer__col">
      <h4 style="font-size: var(--t-scale-caption); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--t-text-inverse); opacity: 0.6; margin: 0 0 var(--t-space-sm) 0;">Product</h4>
      <ul style="list-style: none; margin: 0; padding: 0;">
        <li style="margin-bottom: var(--t-space-xs);"><a href="#" style="font-size: var(--t-scale-body); color: var(--t-text-inverse); opacity: 0.75; text-decoration: none;">Features</a></li>
        <li style="margin-bottom: var(--t-space-xs);"><a href="#" style="font-size: var(--t-scale-body); color: var(--t-text-inverse); opacity: 0.75; text-decoration: none;">Pricing</a></li>
      </ul>
    </div>
    <!-- additional columns -->
  </div>
  <div class="tela-footer__bottom" style="max-width: 1200px; margin: var(--t-space-xl) auto 0; padding-top: var(--t-space-lg); border-top: 1px solid rgba(255,255,255,0.1); font-size: var(--t-scale-caption); color: var(--t-text-inverse); opacity: 0.5;">
    &copy; 2026 Acme Inc. All rights reserved.
  </div>
</footer>
```

**Design notes:**
- Footer columns are auto-sized: 1 column = full width, 2-4 columns = equal grid, 5+ columns = 4-column grid with wrapping.
- Footer always uses inverted colors by default. Applying `bg(surface.default)` overrides this for a light footer.

### 5.13 `nav`

Top navigation bar.

**Required props:** `brand`

**Optional props:**
| Prop | Type | Default |
|------|------|---------|
| `brand` | string | *required* |
| `logo` | reference | none |
| `links` | array of `{label, url}` | `[]` |
| `cta` | string/object | none |

**Valid modifiers:** `pad(size)`, `bg(token)`, `inverted`, `sticky`

**Generated HTML:**

```html
<nav class="tela-nav" style="padding: var(--t-space-md) var(--t-space-xl); background: var(--t-surface-default); border-bottom: 1px solid var(--t-border-subtle); position: sticky; top: 0; z-index: 100;">
  <div class="tela-nav__inner" style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between;">
    <div class="tela-nav__brand" style="font-family: var(--t-family-serif); font-size: var(--t-scale-lead); font-weight: var(--t-weight-heading); color: var(--t-text-primary); text-decoration: none;">Tela</div>
    <div class="tela-nav__links" style="display: flex; align-items: center; gap: var(--t-space-lg);">
      <a href="#features" style="font-size: var(--t-scale-body); color: var(--t-text-secondary); text-decoration: none;">Features</a>
      <a href="#pricing" style="font-size: var(--t-scale-body); color: var(--t-text-secondary); text-decoration: none;">Pricing</a>
      <a href="#docs" style="font-size: var(--t-scale-body); color: var(--t-text-secondary); text-decoration: none;">Docs</a>
      <a class="tela-btn tela-btn--primary" href="#" style="padding: var(--t-space-xs) var(--t-space-md); background: var(--t-accent-default); color: var(--t-text-inverse); font-size: var(--t-scale-body); font-weight: 500; border-radius: var(--t-radius-md); text-decoration: none;">Get started</a>
    </div>
  </div>
</nav>
```

**Design notes:**
- `sticky` modifier adds `position: sticky; top: 0; z-index: 100`. This is the default behavior and should be used on all nav sections unless the page is a simple single-screen layout.
- Nav sections must be the first section in a document. The checker warns if nav appears anywhere other than position 0.

---

## 6. Renderer Architecture

### 6.1 Pipeline overview

```
.tela source
    ↓ parse()
TelaDocument (AST)
    ↓ compile()
ComponentTree (validated, refs resolved, tokens resolved)
    ↓ render()
HTML string + CSS string
    ↓ write()
output.html (single file)
```

### 6.2 Component resolution pipeline

1. **Parse** -- `src/parser/index.ts` converts `.tela` text into a `TelaDocument` AST. Pure syntax -- no validation of block types or modifier names.

2. **Compile** -- `src/compiler/index.ts` walks the AST and:
   - Validates all `blockType` values against the component registry.
   - Validates all modifier names and argument types against each component's modifier schema.
   - Resolves references (`./path`) to absolute paths.
   - Resolves tokens (theme + overrides) into a flat `ResolvedTokens` map.
   - Produces a `ComponentTree` -- a validated, fully-resolved intermediate representation.

3. **Render** -- `src/renderer/index.ts` walks the `ComponentTree` and calls each component's render function. Each component returns an HTML fragment. The renderer wraps all fragments in the document shell.

```typescript
interface ComponentTree {
  frontmatter: Frontmatter;
  tokens: ResolvedTokens;
  sections: CompiledSection[];
}

interface CompiledSection {
  id: string;
  component: ComponentDefinition;
  props: Record<string, ResolvedValue>;
  children: CompiledSection[];
  modifiers: ResolvedModifier[];
}

interface ComponentDefinition {
  name: string;
  render: (ctx: RenderContext) => string;
  schema: ComponentSchema;       // prop types, required fields, valid modifiers
}
```

### 6.3 Token injection strategy

Tokens are injected as CSS custom properties in a single `:root` block at the top of the `<style>` element. Components reference tokens via `var(--t-...)` in their inline styles.

This is a deliberate design choice: inline styles on each element for layout, CSS custom properties for theme values. The rationale:

- **Inline styles for layout** because each component instance may have different padding, grid columns, and gap values based on its modifiers. Generating class-based CSS for every modifier combination would produce more code than inline styles.
- **CSS custom properties for theme** because theme values are shared across all components. Defining them once in `:root` and referencing via `var()` produces minimal CSS and makes theme overrides trivial.

### 6.4 Incremental rendering

The renderer tracks which sections have changed since the last render and only re-renders those sections. The document shell (DOCTYPE, `<head>`, `:root` styles, font loading) is always emitted, but section HTML is cached per section ID.

```typescript
interface RenderCache {
  /** Section ID → rendered HTML fragment. */
  sections: Map<string, string>;
  /** Hash of the resolved tokens. Used to invalidate all sections on theme change. */
  tokenHash: string;
}
```

Cache invalidation rules:
- If `tokenHash` changes (theme or override changed), all sections are invalidated.
- If a section's AST has changed (detected by deep comparison of the compiled section), that section is invalidated.
- If a section is added or removed, only the affected sections are re-rendered; other sections retain their cached HTML.
- Reordering sections does not invalidate any section -- only the assembly order changes.

### 6.5 Output contract

The rendered HTML file is a single, self-contained HTML document:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page Title</title>
  <meta name="description" content="...">
  <!-- Font loading -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet">
  <style>
    /* Reset */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    /* Tokens */
    :root {
      --t-surface-default: #f5f4ed;
      --t-surface-elevated: #faf9f5;
      /* ... all resolved tokens ... */
    }
    
    /* Base typography */
    body {
      font-family: var(--t-family-sans);
      font-size: var(--t-scale-body);
      line-height: var(--t-leading-default);
      color: var(--t-text-primary);
      background: var(--t-surface-default);
      -webkit-font-smoothing: antialiased;
    }
    
    /* Responsive breakpoints for grids */
    @media (max-width: 768px) { /* tablet overrides */ }
    @media (max-width: 480px) { /* mobile overrides */ }
  </style>
</head>
<body>
  <!-- Section 0: nav -->
  <nav class="tela-nav" ...>...</nav>
  
  <!-- Section 1: hero -->
  <section class="tela-hero" ...>...</section>
  
  <!-- Section 2: features -->
  <div class="tela-grid" ...>...</div>
  
  <!-- ... -->
</body>
</html>
```

Each section is wrapped in an HTML comment with its section ID for debuggability. The rendered HTML is formatted (indented) for readability -- this is a tool for LLMs and developers, not a production minifier.

### 6.6 Font loading strategy

Fonts are loaded from Google Fonts via `<link>` tags in the `<head>`. The renderer maintains a font registry that maps `type.family.*` token values to Google Fonts URLs.

```typescript
const GOOGLE_FONTS: Record<string, string> = {
  'Charter': '',  // system font, no load needed
  'Inter': 'Inter:wght@400;500;600',
  'Source Serif 4': 'Source+Serif+4:wght@400;500;600',
  'EB Garamond': 'EB+Garamond:wght@400;500',
  'Playfair Display': 'Playfair+Display:wght@400;600',
  'IBM Plex Mono': 'IBM+Plex+Mono:wght@400',
  'JetBrains Mono': 'JetBrains+Mono:wght@400',
};
```

System fonts (Charter, Georgia, etc.) produce no `<link>` tag. Web fonts produce a single consolidated Google Fonts URL with all required weights.

The `<link>` tags use `rel="preconnect"` for the Google Fonts origins and `display=swap` in the font URL to prevent FOIT (flash of invisible text).

---

## 7. MCP Server Design

### 7.1 DocumentStore

The `DocumentStore` class is the central state manager. It holds all open documents, their history, and pending fix patches.

```typescript
class DocumentStore {
  private documents: Map<string, Document>;
  private nextId: number;

  /** Create an empty document with optional theme/mode/lang. */
  createDocument(opts?: {
    theme?: string;
    mode?: 'landing' | 'article' | 'docs';
    lang?: string;
  }): string;  // returns doc_id

  /** Open a .tela file from disk. */
  openDocument(path: string): string;  // returns doc_id

  /** Save a document to disk. */
  saveDocument(docId: string, path?: string): string;  // returns saved path

  /** List all open documents. */
  listDocuments(): DocumentSummary[];

  /** Get a document by ID. */
  getDocument(docId: string): Document;

  /** Add a section to a document. */
  addSection(docId: string, telaFragment: string, position?: number): string;  // returns section_id

  /** Update a section's content. */
  updateSection(docId: string, sectionId: string, telaFragment: string): void;

  /** Remove a section. */
  removeSection(docId: string, sectionId: string): void;

  /** Reorder sections. */
  reorderSections(docId: string, sectionIds: string[]): void;

  /** Change the theme (and optional token overrides). */
  setTheme(docId: string, themeSpec: string): void;

  /** Get a section's current tela notation with annotations. */
  getSection(docId: string, sectionId: string): AnnotatedFragment;

  /** Update a specific block property by path. */
  updateBlock(docId: string, path: string, props: Record<string, unknown>): void;

  /** Render the document to HTML. */
  render(docId: string): RenderResult;

  /** Run the checker on the rendered HTML. */
  check(docId: string): CheckReport;

  /** Apply a checker fix by ID. */
  applyFix(docId: string, fixId: string): void;

  /** Undo the last mutation. */
  undo(docId: string): void;

  /** Persist all open sessions to disk. */
  persistSessions(): void;

  /** Restore sessions from disk. */
  restoreSessions(): void;
}
```

### 7.2 Document and Section types

```typescript
interface Document {
  id: string;
  ast: TelaDocument;
  compiled: ComponentTree | null;    // null if not yet compiled
  rendered: string | null;           // null if not yet rendered
  renderCache: RenderCache;
  history: Snapshot[];               // undo stack
  pendingFixes: Map<string, FixPatch>;  // fix_id → patch
  filePath: string | null;           // null if not yet saved
  dirty: boolean;                    // true if modified since last save
  createdAt: number;
  modifiedAt: number;
}

interface Snapshot {
  ast: TelaDocument;                 // deep clone of the AST at snapshot time
  timestamp: number;
  description: string;               // human-readable mutation description
}

interface DocumentSummary {
  id: string;
  mode: string;
  theme: string;
  sectionCount: number;
  dirty: boolean;
  filePath: string | null;
}

interface AnnotatedFragment {
  tela: string;                      // the section's tela notation
  sectionId: string;
  blockType: string;
  modifiers: string[];
  propertyPaths: string[];           // all addressable paths for update_block
}

interface RenderResult {
  htmlPath: string;                  // path to the written HTML file
  screenshotPath: string | null;     // path to screenshot, null if Puppeteer unavailable
  sectionIds: string[];
}
```

### 7.3 Fix patch mechanism

When the checker produces findings, each finding with a fixable suggestion generates a `FixPatch`. The patch is stored in the document's `pendingFixes` map keyed by a unique `fix_id`.

```typescript
interface FixPatch {
  fixId: string;                     // e.g. "spacing-rhythm.001"
  ruleId: string;
  sectionId: string;
  description: string;               // human-readable description of the fix
  apply: (ast: TelaDocument) => TelaDocument;  // pure function that applies the fix
}
```

The `apply` function is a pure transformation: it takes the current AST and returns a new AST with the fix applied. It does not mutate the input. When `apply_fix` is called:

1. A snapshot is pushed to the history stack.
2. The patch's `apply` function is called with the current AST.
3. The document's AST is replaced with the result.
4. The compiled tree and render cache are invalidated for the affected section.
5. The fix is removed from `pendingFixes`.

Fix patches are invalidated whenever the affected section is modified through any other mutation (update_section, update_block, remove_section). The rationale: the fix was generated against a specific AST state, and any edit may make it inapplicable or incorrect.

### 7.4 Session persistence

Sessions are persisted to `~/.tela/sessions/` as JSON files:

```
~/.tela/sessions/
  session-{doc_id}.json
```

Each session file contains:

```json
{
  "id": "doc-001",
  "filePath": "/Users/me/project/landing.tela",
  "telaSource": "---\ntheme: warm-editorial\n...",
  "history": [
    {
      "telaSource": "...",
      "timestamp": 1716672000000,
      "description": "add_section: hero"
    }
  ],
  "createdAt": 1716672000000,
  "modifiedAt": 1716672000000
}
```

Sessions are saved automatically after every mutation. On server startup, all session files are loaded and documents are re-parsed from the stored tela source. The `pendingFixes` map is not persisted -- fixes are regenerated on the next `check()` call. The render cache is not persisted -- it is rebuilt on the next `render()` call.

### 7.5 MCP tool definitions

All 15 tools exposed by the MCP server, with their JSON Schema parameter definitions and return types.

#### `create_document`

Creates a new empty document.

```typescript
// Parameters
interface CreateDocumentParams {
  theme?: string;      // default: "warm-editorial"
  mode?: string;       // default: "landing"
  lang?: string;       // default: "en"
}

// JSON Schema
{
  "name": "create_document",
  "description": "Create a new empty Tela document with optional theme, mode, and language.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "theme": { "type": "string", "description": "Theme preset name", "default": "warm-editorial" },
      "mode": { "type": "string", "enum": ["landing", "article", "docs"], "default": "landing" },
      "lang": { "type": "string", "description": "BCP 47 language tag", "default": "en" }
    }
  }
}

// Return
interface CreateDocumentResult {
  doc_id: string;
  theme: string;
  mode: string;
}
```

#### `open_document`

Opens a `.tela` file from disk.

```typescript
{
  "name": "open_document",
  "description": "Open an existing .tela file and return a document ID for editing.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Absolute path to the .tela file" }
    },
    "required": ["path"]
  }
}

// Return
interface OpenDocumentResult {
  doc_id: string;
  theme: string;
  mode: string;
  section_count: number;
  section_ids: string[];
}
```

#### `save_document`

Saves a document to disk.

```typescript
{
  "name": "save_document",
  "description": "Save a document to disk as a .tela file. If no path is given, saves to the original path (if opened from disk).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" },
      "path": { "type": "string", "description": "Absolute path. Optional if document was opened from disk." }
    },
    "required": ["doc_id"]
  }
}

// Return
interface SaveDocumentResult {
  saved_path: string;
}
```

#### `list_documents`

Lists all open documents.

```typescript
{
  "name": "list_documents",
  "description": "List all currently open documents with summary information.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}

// Return
interface ListDocumentsResult {
  documents: DocumentSummary[];
}
```

#### `undo`

Undoes the last mutation on a document.

```typescript
{
  "name": "undo",
  "description": "Undo the last mutation on a document, restoring the previous state.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" }
    },
    "required": ["doc_id"]
  }
}

// Return
interface UndoResult {
  restored_description: string;      // what was undone
  section_count: number;
}
```

#### `add_section`

Adds a new section to the document.

```typescript
{
  "name": "add_section",
  "description": "Add a new section to the document by providing a tela fragment (the block declaration and its contents, without --- separators).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" },
      "tela_fragment": { "type": "string", "description": "Tela notation for the section content" },
      "position": { "type": "integer", "description": "0-indexed insertion position. Appends to end if omitted." }
    },
    "required": ["doc_id", "tela_fragment"]
  }
}

// Return
interface AddSectionResult {
  section_id: string;
  position: number;
  total_sections: number;
}
```

#### `update_section`

Replaces an entire section's content.

```typescript
{
  "name": "update_section",
  "description": "Replace the contents of an existing section with new tela notation.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" },
      "section_id": { "type": "string" },
      "tela_fragment": { "type": "string" }
    },
    "required": ["doc_id", "section_id", "tela_fragment"]
  }
}

// Return
interface UpdateSectionResult {
  section_id: string;
  block_type: string;
}
```

#### `remove_section`

Removes a section from the document.

```typescript
{
  "name": "remove_section",
  "description": "Remove a section from the document.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" },
      "section_id": { "type": "string" }
    },
    "required": ["doc_id", "section_id"]
  }
}

// Return
interface RemoveSectionResult {
  removed_section_id: string;
  remaining_sections: number;
}
```

#### `reorder_sections`

Reorders sections within a document.

```typescript
{
  "name": "reorder_sections",
  "description": "Reorder sections by providing the complete list of section IDs in the desired order.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" },
      "section_ids": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Complete list of section IDs in desired order"
      }
    },
    "required": ["doc_id", "section_ids"]
  }
}

// Return
interface ReorderSectionsResult {
  section_ids: string[];
}
```

#### `set_theme`

Changes the document theme.

```typescript
{
  "name": "set_theme",
  "description": "Change the document's theme. Supports theme name or theme + token overrides (e.g. 'warm-editorial + color.accent.default=#C84B31').",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" },
      "theme_spec": { "type": "string", "description": "Theme name, optionally with + override syntax" }
    },
    "required": ["doc_id", "theme_spec"]
  }
}

// Return
interface SetThemeResult {
  theme: string;
  overrides: string[];              // list of overridden token paths
}
```

#### `get_section`

Gets a section's tela notation with annotations.

```typescript
{
  "name": "get_section",
  "description": "Get a section's current tela notation with structural annotations (block type, modifier list, addressable property paths).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" },
      "section_id": { "type": "string" }
    },
    "required": ["doc_id", "section_id"]
  }
}

// Return: AnnotatedFragment (see Section 7.2)
```

#### `update_block`

Updates a specific property by path.

```typescript
{
  "name": "update_block",
  "description": "Update a specific block property by dot-path (e.g. 'hero.left.cta[0].label'). For fine-grained edits without rewriting the entire section.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" },
      "path": { "type": "string", "description": "Dot-separated path to the property, e.g. 'hero.left.headline'" },
      "props": { "type": "object", "description": "Key-value pairs to set at the target path" }
    },
    "required": ["doc_id", "path", "props"]
  }
}

// Return
interface UpdateBlockResult {
  path: string;
  updated_keys: string[];
}
```

#### `render`

Renders the document to HTML (and optionally takes a screenshot).

```typescript
{
  "name": "render",
  "description": "Render the document to a standalone HTML file. Optionally captures a screenshot if Puppeteer is available.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" }
    },
    "required": ["doc_id"]
  }
}

// Return: RenderResult (see Section 7.2)
```

#### `check`

Runs the checker on the document.

```typescript
{
  "name": "check",
  "description": "Run aesthetic and structural checks on the rendered document. Returns a scored report with findings and auto-fixable suggestions.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" }
    },
    "required": ["doc_id"]
  }
}

// Return: CheckReport (see Section 8)
```

#### `apply_fix`

Applies a checker-suggested fix.

```typescript
{
  "name": "apply_fix",
  "description": "Apply an auto-fix suggested by the checker. The fix_id comes from a previous check() result.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" },
      "fix_id": { "type": "string" }
    },
    "required": ["doc_id", "fix_id"]
  }
}

// Return
interface ApplyFixResult {
  fix_id: string;
  description: string;
  section_id: string;
}
```

#### Discovery tools

Three read-only tools for LLM exploration:

```typescript
// list_components
{
  "name": "list_components",
  "description": "List all built-in block types with their required/optional props, valid modifiers, and example tela notation.",
  "inputSchema": { "type": "object", "properties": {} }
}

// list_themes
{
  "name": "list_themes",
  "description": "List all available theme presets with their token values.",
  "inputSchema": { "type": "object", "properties": {} }
}

// list_modifiers
{
  "name": "list_modifiers",
  "description": "List all available modifiers with their valid arguments and which block types accept them.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

### 7.6 Error handling

All MCP tools return structured errors:

```typescript
interface TelaError {
  code: string;                // machine-readable error code
  message: string;             // human-readable description
  details?: {
    location?: SourceLocation;
    suggestions?: string[];    // possible fixes
  };
}
```

Error codes:

| Code | Meaning |
|------|---------|
| `DOCUMENT_NOT_FOUND` | doc_id does not exist |
| `SECTION_NOT_FOUND` | section_id does not exist in document |
| `PARSE_ERROR` | tela_fragment has syntax errors |
| `COMPILE_ERROR` | invalid block type, modifier, or prop type |
| `INVALID_THEME` | theme name not recognized |
| `INVALID_TOKEN` | token override key not recognized |
| `INVALID_PATH` | block path does not resolve |
| `FIX_NOT_FOUND` | fix_id not found or expired |
| `FIX_STALE` | fix_id exists but section was modified since check |
| `NO_UNDO` | history stack is empty |
| `IO_ERROR` | file read/write failure |

Parse errors include `location` (line/column) and `suggestions` (e.g., "Did you mean `hero` instead of `hro`?"). The parser uses Levenshtein distance against the component registry to suggest corrections for unknown block types.

---

## 8. Checker Architecture

### 8.1 Rule interface

```typescript
interface CheckRule {
  /** Unique rule ID, e.g. "spacing-rhythm". */
  id: string;
  
  /** Human-readable rule name. */
  name: string;
  
  /** What this rule checks. */
  description: string;
  
  /** Run the check and return findings. */
  check(input: CheckInput): CheckFinding[];
}

interface CheckInput {
  /** The compiled component tree. */
  tree: ComponentTree;
  
  /** The rendered HTML string. */
  html: string;
  
  /** Parsed HTML DOM (cheerio instance). */
  dom: CheerioAPI;
  
  /** Resolved tokens for the document. */
  tokens: ResolvedTokens;
  
  /** Section-level metrics computed by the layout analyzer. */
  metrics: SectionMetrics[];
}

interface SectionMetrics {
  sectionId: string;
  /** Computed bounding box (if screenshot available). */
  bounds?: { x: number; y: number; width: number; height: number };
  /** Number of text elements. */
  textElementCount: number;
  /** All font sizes used (px). */
  fontSizes: number[];
  /** All colors used (hex). */
  colors: string[];
  /** All spacing values used (px). */
  spacings: number[];
  /** Grid column count (if grid). */
  gridColumns?: number;
  /** Heading levels present. */
  headingLevels: number[];
}

interface CheckFinding {
  id: string;                       // unique finding ID, e.g. "spacing-rhythm.001"
  severity: 'error' | 'warning' | 'info';
  rule: string;                     // rule ID
  location: string;                 // AST path, e.g. "section[1].grid"
  finding: string;                  // human-readable description
  fix?: string;                     // human-readable fix suggestion
  fixPatch?: (ast: TelaDocument) => TelaDocument;  // auto-apply function
}
```

### 8.2 How rules receive input

Before running rules, the checker builds the `CheckInput` object:

1. The `ComponentTree` is taken from the document's compiled state.
2. The rendered HTML is parsed with `cheerio` to build a DOM.
3. The `css-tree` library parses all `<style>` blocks and inline styles to extract computed values.
4. Per-section metrics are computed by traversing the DOM and extracting font sizes, colors, spacings, heading levels, and grid structures.
5. If a screenshot is available (Puppeteer), bounding boxes are extracted from the rendered page via `page.evaluate()`.

### 8.3 Fix patch generation

Each rule that produces fixable findings generates a `fixPatch` function alongside the finding. The function is a closure that captures the specific AST path and the corrective value.

Example: the `spacing-rhythm` rule detects that a grid's `gap(sm)` conflicts with the theme's base unit. It generates:

```typescript
const fixPatch = (ast: TelaDocument): TelaDocument => {
  const section = ast.sections[1];
  const gapMod = section.block.modifiers.find(m => m.name === 'gap');
  if (gapMod) {
    gapMod.args = ['lg'];  // correct to base unit
  }
  return ast;
};
```

The finding's `id` (e.g., `spacing-rhythm.001`) is used as the `fix_id` in the document's `pendingFixes` map. The counter is per-check-run, resetting each time `check()` is called.

### 8.4 Full rule specifications

#### Rule 1: `unfilled-slots`

**What it measures:** Scans the component tree for required props that have no value.

**Threshold:** Any missing required prop is an error.

**Severity:** `error`

**Finding example:** `"hero.headline is required but missing."`

**Fix:** Cannot auto-fix -- the LLM must provide content. Fix text: `"Add a headline property to the hero block."`

#### Rule 2: `heading-order`

**What it measures:** Checks that heading levels are sequential and do not skip levels. Scans all heading elements (`<h1>` through `<h6>`) in document order.

**Threshold:**
- Skipping a level (e.g., `<h1>` followed by `<h3>`) is a warning.
- Multiple `<h1>` elements is a warning.
- `<h1>` not in the first section is an info.

**Severity:** `warning` for skips, `warning` for multiple h1, `info` for h1 position.

**Finding example:** `"Heading jumps from h1 to h3 in section[2].prose. Screen readers expect sequential levels."`

**Fix:** Auto-fixable. The patch changes the block's heading level by adjusting the component's rendered heading tag. Fix text: `"Change prose title to h2 to maintain heading sequence."`

#### Rule 3: `alt-text`

**What it measures:** Checks all `<img>` elements for non-empty `alt` attributes.

**Threshold:** Any image without `alt` or with `alt=""` is a warning. Decorative images (figures without captions) are allowed to have empty alt text but get an info-level note.

**Severity:** `warning` for content images, `info` for decorative images.

**Finding example:** `"Image in section[0].hero.right has no alt text. Add an alt property describing the image."`

**Fix:** Cannot auto-fix (requires human description). Fix text: `"Add an alt property: figure: ./hero.png | alt('Product dashboard screenshot')"`

#### Rule 4: `line-length`

**What it measures:** Estimates characters per line for body text elements. Uses the element's computed width and font size to calculate approximate characters per line: `cpl = width / (fontSize * 0.5)`.

**Threshold:**
- CPL > 85: warning (too wide, hard to read).
- CPL < 35: warning (too narrow, too many line breaks).

**Severity:** `warning`

**Finding example:** `"Prose body in section[3] has ~95 characters per line. Optimal reading measure is 45-75 characters. Add max-width constraint or use a narrower layout."`

**Fix:** Auto-fixable for prose sections. The patch adds a `centered` modifier or adjusts the parent container's max-width. Fix text: `"Add centered modifier to constrain line length."`

#### Rule 5: `type-scale`

**What it measures:** Checks that all font sizes used in the document belong to the theme's type scale. Extracts all `font-size` values from the rendered HTML and compares against the resolved `type.scale.*` tokens.

**Threshold:** Any font size that does not match a token value (within 1px tolerance) is a warning.

**Severity:** `warning`

**Finding example:** `"Font size 18px in section[2].feature.title does not match any type scale token. Nearest: lead (20px) or body (16px)."`

**Fix:** Auto-fixable. The patch adjusts the component to use the nearest type scale token. Fix text: `"Use lead scale (20px) instead of custom 18px."`

#### Rule 6: `text-contrast`

**What it measures:** Computes WCAG 2.1 contrast ratio between text color and background color for all text elements. Uses `chroma-js` for accurate color math.

**Threshold:**
- Body text (< 24px): contrast ratio < 4.5:1 is an error, < 7:1 is a warning.
- Large text (>= 24px or bold >= 18.66px): contrast ratio < 3:1 is an error, < 4.5:1 is a warning.

**Severity:** `error` for failing WCAG AA, `warning` for failing WCAG AAA.

**Finding example:** `"Caption text in section[4].footer has contrast ratio 3.2:1 against background. WCAG AA requires 4.5:1 for text this size."`

**Fix:** Auto-fixable. The patch adjusts the text color token or background token to meet the contrast threshold. Fix text: `"Change text color to color.text.secondary for 5.8:1 contrast."`

#### Rule 7: `spacing-rhythm`

**What it measures:** Checks that all spacing values (padding, margin, gap) used in the document are multiples of the theme's base spacing unit. The base unit is `space.xs` (4px). All spacing values should be multiples of this base.

**Threshold:**
- Values that are not multiples of `space.xs` are warnings.
- Adjacent sections with inconsistent padding (one uses `md`, another uses a custom value) are warnings.

**Severity:** `warning`

**Finding example:** `"gap(16px) in section[1].grid conflicts with base unit (24px at lg scale). Creates visual dissonance between this grid and adjacent sections using lg spacing."`

**Fix:** Auto-fixable. The patch changes the modifier argument to the nearest token value. Fix text: `"Change gap modifier to lg (24px)."`

#### Rule 8: `whitespace-balance`

**What it measures:** Analyzes the vertical distribution of whitespace across the page. Detects sections that are disproportionately sparse or dense compared to their neighbors.

**Threshold:**
- A section whose padding is more than 2x the average section padding triggers a warning.
- A section whose padding is less than 0.5x the average triggers a warning.
- Requires at least 3 sections to compute meaningful statistics.

**Severity:** `warning`

**Finding example:** `"Section[3] (aside) has 160px vertical padding while adjacent sections average 80px. Consider reducing to section-level spacing."`

**Fix:** Auto-fixable. The patch adjusts the section's padding modifier. Fix text: `"Change pad modifier to section (80px)."`

#### Rule 9: `focal-points`

**What it measures:** Counts the number of high-emphasis elements (display/h1 headings, primary CTAs, large images) per viewport-height equivalent. Too many focal points dilute attention.

**Threshold:**
- More than 2 focal points per estimated viewport-height (~800px) is a warning.
- A page with no focal points (no h1, no CTA) is a warning.

**Severity:** `warning`

**Finding example:** `"3 display-scale headings within 800px vertical span (sections 0-2). Readers cannot prioritize. Consider downscaling section[1] headline to h2."`

**Fix:** Auto-fixable when the fix is downscaling a heading. The patch changes the block type or heading scale. Fix text: `"Downscale section[1] headline from display to h1."`

#### Rule 10: `cta-placement`

**What it measures:** Checks that CTA sections (blocks with `role(primary)` buttons) are placed effectively:
- At least one CTA should be in the top 2 sections (above the fold).
- CTA should not be the absolute last section (footer should follow).
- No more than 3 CTA sections in a single document.

**Threshold:**
- No CTA in top 2 sections: warning.
- CTA as last section: warning.
- More than 3 CTAs: warning.

**Severity:** `warning`

**Finding example:** `"No call-to-action in the first two sections. Users who don't scroll will miss the conversion prompt."`

**Fix:** Cannot auto-fix (requires content decisions). Fix text: `"Add a CTA button to the hero section, or insert a CTA section after the first feature block."`

#### Rule 11: `grid-consistency`

**What it measures:** Within a grid, checks that all children have consistent structure: same set of property keys, similar content lengths, and matching visual density.

**Threshold:**
- Children with different property key sets (one has `icon` and `title`, another has only `body`): warning.
- Children with body text length varying by more than 3x: warning.

**Severity:** `warning`

**Finding example:** `"Grid children in section[2] have inconsistent structure: items 0-1 have icon+title+body, item 2 has only title+body. Missing icon creates visual imbalance."`

**Fix:** Cannot auto-fix for missing content. Fix text: `"Add an icon property to the third grid item to match the structure of items 0-1."` Auto-fixable when the issue is content length imbalance: the fix is an info-level note suggesting the LLM trim or expand text.

### 8.5 Scoring algorithm

The score is computed on a 0-100 scale:

```
score = 100 - error_penalty - warning_penalty - info_penalty
```

Penalty values:

| Severity | Penalty per finding | Max total penalty |
|----------|-------------------|-------------------|
| `error` | 15 | 60 |
| `warning` | 5 | 35 |
| `info` | 1 | 5 |

The score is clamped to `[0, 100]`. Each severity has a cap to prevent a flood of low-severity findings from cratering the score.

Score interpretation:

| Range | Label |
|-------|-------|
| 90-100 | Excellent -- production ready |
| 75-89 | Good -- minor issues |
| 50-74 | Fair -- significant issues to address |
| 0-49 | Poor -- fundamental problems |

The checker always produces a `summary` string: a one-sentence human-readable description of the most impactful finding. This is what the LLM reads first to decide whether to iterate.

---

## 9. Layout Extractor

The extractor converts existing HTML pages into `.tela` notation approximations. It is lossy by design -- the goal is a useful starting point, not a perfect round-trip.

### 9.1 DOM traversal strategy

1. **Parse** the input HTML with `htmlparser2` / `cheerio`.
2. **Strip** `<head>`, `<script>`, `<noscript>`, `<svg>` (retained as references), `<iframe>`.
3. **Identify section boundaries.** Walk the `<body>` children. Any element that is a semantic landmark (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`) or a `<div>` with full-width styling (no horizontal constraints or `width: 100%`) is treated as a section boundary.
4. **Recursively analyze** each section's DOM subtree to identify block types, properties, and modifiers.

### 9.2 Layout pattern recognition

The extractor uses heuristic rules to detect layout patterns from computed CSS:

**Grid detection:**
- `display: grid` with `grid-template-columns: repeat(N, ...)` maps to `grid(N)`.
- `display: grid` with explicit column definitions (e.g., `1fr 1fr 1fr`) maps to `grid(N)` where N is the column count.
- `display: flex` with `flex-wrap: wrap` and children of equal `flex-basis` maps to `grid(N)` where N = floor(container-width / child-flex-basis).

**Split detection:**
- `display: grid` with two-column template (e.g., `3fr 2fr`) maps to `split(60/40)`.
- `display: flex` with exactly two children where widths sum to ~100% maps to `split(w1/w2)`.
- Ratios are rounded to the nearest 10 (50/50, 60/40, 70/30, 40/60, 30/70).

**Stack detection (default):**
- `display: flex; flex-direction: column` or `display: block` with stacked children maps to implicit stack (no modifier needed -- stack is the default layout).

**Prose detection:**
- A section whose children are predominantly `<p>`, `<h2>`-`<h6>`, `<blockquote>`, `<ul>`, `<ol>` elements with a `max-width` constraint between 600-800px is classified as `prose`.

### 9.3 Token extraction

**Color clustering:**
1. Extract all color values from inline styles and `<style>` blocks.
2. Cluster colors by perceptual similarity (CIE deltaE < 5).
3. Map each cluster to the nearest token in all 4 theme presets.
4. Select the theme whose token map covers the most extracted colors with the lowest total deltaE.
5. Colors that do not match any token within deltaE 15 are reported as custom overrides.

**Type scale detection:**
1. Extract all `font-size` values.
2. Sort and deduplicate.
3. Map to the nearest type scale tokens.
4. If the scale matches a theme's type scale within 2px tolerance, use that theme.
5. Custom sizes that do not map become token overrides.

**Spacing detection:**
1. Extract all `padding`, `margin`, and `gap` values.
2. Find the GCD of all values (rounded to nearest 4px).
3. Map each value to the nearest `space.*` token where GCD matches `space.xs`.

### 9.4 Confidence scoring

Each extracted section receives a confidence score from 0.0 to 1.0:

| Condition | Score modifier |
|-----------|---------------|
| Semantic HTML element (section, article, nav) | +0.2 |
| Layout pattern matched (grid/split) | +0.2 |
| All text elements map to type scale | +0.15 |
| All colors map to theme tokens | +0.15 |
| All spacings map to space tokens | +0.1 |
| Contains known block type pattern (hero, footer) | +0.1 |
| Has complex nested layout (3+ depth levels) | -0.15 |
| Contains inline SVG or canvas | -0.1 |
| Has JavaScript-dependent layout | -0.2 |

Scores are clamped to [0.0, 1.0]. Sections with confidence below 0.3 are emitted with a comment: `# LOW CONFIDENCE: manual review required`.

### 9.5 Output format

```yaml
---
theme: warm-editorial
# Extracted from: https://example.com/landing
# Overall confidence: 0.72
# Extraction date: 2026-05-25
tokens:
  color.accent.default: "#e63946"
---

# confidence: 0.85
nav | sticky:
  brand: "Acme Corp"
  logo: ./extracted/logo.png
  links:
    - label: Features | url(#features)
    - label: Pricing  | url(#pricing)
    - label: Docs     | url(#docs)

---

# confidence: 0.78
hero | split(60/40) pad(xl):
  left:
    eyebrow: "New in v3.0"
    headline: Build faster, ship sooner
    body: The modern way to create landing pages.
    cta:
      - label: Get started | role(primary)
  right:
    figure: ./extracted/hero-image.png | aspect(16/9) rounded

---

# confidence: 0.45
# LOW CONFIDENCE: complex nested layout, manual review required
features | grid(3) gap(lg):
  - icon: "?"
    title: Feature One
    body: Description extracted from paragraph text.
```

Images are downloaded to `./extracted/` relative to the output `.tela` file. Icon values that cannot be determined are set to `"?"` with an inline comment.

---

## 10. Implementation Roadmap

### Phase 0: AST + Parser

**Deliverables:**
- `src/ast/types.ts` -- all AST node type definitions (Section 3)
- `src/parser/tokenizer.ts` -- line-by-line tokenizer (frontmatter detection, section separators, block headers, indented bodies)
- `src/parser/parser.ts` -- recursive descent parser producing `TelaDocument`
- `src/parser/errors.ts` -- parse error types with source location

**Tests (write first):**
- Parse minimal document (frontmatter + one section)
- Parse all block header syntaxes (with/without modifiers, with/without args)
- Parse inline values, multiline values, references, arrays
- Parse modifier chains on values
- Error cases: bad indentation, unknown escape, unclosed quotes
- Round-trip: parse then serialize back to `.tela` and verify equivalence

**Dependencies:** None (this is the foundation)

**Complexity:** M

### Phase 1: Tokens

**Deliverables:**
- `src/tokens/schema.ts` -- token namespace definitions and validation
- `src/tokens/themes.ts` -- all 4 theme preset objects
- `src/tokens/resolver.ts` -- `resolveTokens()` function with override merging
- `themes/*.json` -- theme preset files (also usable standalone)

**Tests:**
- Resolve each theme and verify all token namespaces are populated
- Override a single token and verify precedence
- Override with inline `+` syntax
- Reject unknown token paths
- Verify CSS custom property name generation

**Dependencies:** Phase 0 (needs Frontmatter type)

**Complexity:** S

### Phase 2: Renderer

**Deliverables:**
- `src/compiler/index.ts` -- AST validation and compilation to ComponentTree
- `src/renderer/index.ts` -- ComponentTree to HTML string
- `src/renderer/shell.ts` -- HTML document shell (head, style, body wrapper)
- `src/renderer/cache.ts` -- incremental render cache
- `src/renderer/fonts.ts` -- Google Fonts URL generation

**Tests:**
- Render a single-section document and verify valid HTML output
- Render with each theme and verify `:root` CSS variables
- Incremental render: change one section, verify only that section's HTML changes
- Theme change invalidates all sections
- Font loading: verify correct Google Fonts URLs per theme

**Dependencies:** Phase 0 + Phase 1

**Complexity:** L

### Phase 3: Primitives

**Deliverables:**
- `src/primitives/registry.ts` -- component registry with schemas
- `src/primitives/hero.ts` through `src/primitives/nav.ts` -- all 13 component render functions
- `src/primitives/modifiers.ts` -- modifier resolution (token-based CSS generation)
- `src/primitives/button.ts` -- shared button/CTA element renderer

**Tests:**
- Each component: render with required props only, verify HTML structure
- Each component: render with all optional props, verify HTML includes them
- Each component: apply each valid modifier, verify CSS changes
- Invalid modifier on a component produces compile error
- Grid responsive breakpoints: verify media query generation

**Dependencies:** Phase 2

**Complexity:** L

### Phase 4: MCP Server

**Deliverables:**
- `src/mcp/store.ts` -- DocumentStore class
- `src/mcp/server.ts` -- MCP server registration of all 15 tools
- `src/mcp/session.ts` -- session persistence (read/write JSON to `~/.tela/sessions/`)
- `src/mcp/errors.ts` -- structured error types

**Tests:**
- Full lifecycle: create -> add_section -> render -> save -> open -> verify
- Undo: mutate -> undo -> verify restored state
- update_block: set a property by path, verify AST change
- Session persistence: save session, create new store, restore, verify document state
- Error cases: invalid doc_id, invalid section_id, parse error in fragment

**Dependencies:** Phase 0-3

**Complexity:** L

### Phase 5: Checker

**Deliverables:**
- `src/checker/index.ts` -- checker runner, score computation
- `src/checker/rules/*.ts` -- one file per rule (11 rules)
- `src/checker/metrics.ts` -- section metrics extractor
- `src/checker/fixes.ts` -- fix patch generation utilities
- `references/checker_thresholds.json` -- all threshold values

**Tests:**
- Each rule: construct a failing input, verify finding is produced
- Each rule: construct a passing input, verify no finding
- Each fixable rule: apply the generated fix, re-check, verify finding is gone
- Score computation: verify penalty math with known finding sets
- Contrast rule: test with known color pairs against WCAG tables

**Dependencies:** Phase 0-3 (needs parsed DOM and component tree)

**Complexity:** L

### Phase 6: Screenshot

**Deliverables:**
- `src/renderer/screenshot.ts` -- Puppeteer-based screenshot capture
- Graceful degradation: if Puppeteer is not installed, `render()` returns `screenshotPath: null`

**Tests:**
- With Puppeteer: render and capture, verify PNG file exists and has correct dimensions
- Without Puppeteer: verify graceful null return, no crash
- Screenshot dimensions match the document's mode (landing = 1440px wide, article = 1024px)

**Dependencies:** Phase 2

**Complexity:** S

### Phase 7: Extractor

**Deliverables:**
- `src/extractor/index.ts` -- main extraction pipeline
- `src/extractor/layout.ts` -- layout pattern recognition
- `src/extractor/tokens.ts` -- color clustering and token mapping
- `src/extractor/confidence.ts` -- confidence scoring
- `src/extractor/download.ts` -- image downloading to `./extracted/`

**Tests:**
- Extract a known Kami-generated HTML page, verify block types detected
- Grid detection: feed HTML with CSS Grid, verify `grid(N)` modifier
- Split detection: feed HTML with two-column flex, verify `split(X/Y)`
- Token extraction: feed HTML with known Kami colors, verify `warm-editorial` theme selected
- Confidence: verify score decreases with complex nested layouts

**Dependencies:** Phase 0 + Phase 1 (needs parser and tokens for output and comparison)

**Complexity:** L

### Phase 8: Apply Fix Integration

**Deliverables:**
- `src/mcp/apply_fix.ts` -- `apply_fix` tool implementation
- Integration of checker fix patches with DocumentStore mutation + undo

**Tests:**
- Full loop: render -> check -> apply_fix -> render -> check -> verify score improved
- Fix invalidation: apply_fix after manual edit to same section, verify FIX_STALE error
- Undo after apply_fix: verify original state restored

**Dependencies:** Phase 4 + Phase 5

**Complexity:** S

### Dependency graph

```
Phase 0 (AST + Parser)
  ├─> Phase 1 (Tokens)
  │     └─> Phase 2 (Renderer)
  │           ├─> Phase 3 (Primitives)
  │           │     └─> Phase 4 (MCP Server)
  │           │           └─> Phase 8 (Apply Fix)
  │           └─> Phase 6 (Screenshot)
  ├─> Phase 5 (Checker) [needs Phase 0-3]
  └─> Phase 7 (Extractor) [needs Phase 0 + Phase 1]
```

### Complexity summary

| Phase | Complexity | Estimated effort |
|-------|-----------|-----------------|
| 0 | M | Parser with full grammar support |
| 1 | S | Token tables and resolver |
| 2 | L | Full HTML renderer with caching |
| 3 | L | 13 component implementations |
| 4 | L | MCP server with full state management |
| 5 | L | 11 checker rules with fix generation |
| 6 | S | Puppeteer wrapper |
| 7 | L | HTML analysis and extraction heuristics |
| 8 | S | Fix integration plumbing |
