# Tela

**LLM-native HTML page composer.** Describe layout with composable primitives, render to production HTML, validate aesthetics, iterate.

| warm-editorial | cool-technical | dark-dramatic |
|:-:|:-:|:-:|
| ![warm-editorial](docs/assets/theme-warm-editorial.png) | ![cool-technical](docs/assets/theme-cool-technical.png) | ![dark-dramatic](docs/assets/theme-dark-dramatic.png) |

| article (warm-editorial) | dashboard + charts (dark-dramatic) | docs layout (cool-technical) |
|:-:|:-:|:-:|
| ![article](docs/assets/theme-article-warm-editorial.png) | ![dashboard](docs/assets/theme-dashboard-dark-dramatic.png) | ![docs](docs/assets/theme-docs-cool-technical.png) |

---

## Quickstart (CLI)

```bash
npm install && npm run build

# Create a document and add sections
node dist/tela-call.js create_document '{"theme":"warm-editorial","mode":"landing"}'
# → "doc-001"

node dist/tela-call.js add_section '{
  "doc_id": "doc-001",
  "tela_fragment": "hero | split(60/40) pad(xl):\n  left:\n    headline: Hello World\n    body: Welcome to Tela.\n    cta:\n      - label: Get started | role(primary)\n  right:\n    figure: https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800 | aspect(4/3) rounded shadow(lg)"
}'

node dist/tela-call.js render '{"doc_id":"doc-001","out_dir":"/tmp/tela"}'
# → {html_path, screenshot_path, section_ids, layout}

node dist/tela-call.js describe '{"doc_id":"doc-001"}'
# → compact text manifest: sections, fold positions, overlaps

node dist/tela-call.js check '{"doc_id":"doc-001"}'
# → {score, summary, checks[]}

node dist/tela-call.js apply_fix '{"doc_id":"doc-001","fix_id":"spacing-rhythm.001"}'
```

---

## .tela notation

`---` separates sections. `type | mod1 mod2(arg):` declares a block. Indentation = child structure.

````
---
theme: warm-editorial
mode: landing
title: My Page
---

nav | sticky:
  logo: Brand
  links:
    - label: Features | href(#features)
    - label: Docs     | href(/docs)
    - label: GitHub   | href(https://github.com/bkmashiro/tela) role(ghost)

---

hero | split(60/40) pad(xl):
  left:
    eyebrow: "v1.0 · Now in beta"
    headline: |
      Make something
      worth reading
    body: Tela composes pages from layout primitives.
    cta:
      - label: Get started  | role(primary)
      - label: See examples | role(ghost)
  right:
    figure: ./hero.png | aspect(4/3) rounded shadow(lg)

---

features | grid(3) gap(lg) pad(xl):
  - icon: ◆ | accent
    title: Composable
    body: 30+ primitives. Combine freely.
  - icon: ◇ | accent
    title: Verifiable
    body: Checks read like design feedback.
  - icon: ◉ | accent
    title: Interactive
    body: Tabs, accordions, modals — zero dependencies.

---

tabs | pad(lg):
  items:
    - title: Overview
      body: Tela renders layout intent to production HTML. No CSS. No templates.
    - title: API
      body: 26 MCP tools. create_document, add_section, render, check — callable from any MCP client.
    - title: Themes
      body: warm-editorial, cool-technical, neutral-minimal, dark-dramatic.

---

accordion | pad(md):
  items:
    - question: Is Tela free?
      answer: Yes, MIT licensed.
    - question: Does it require a framework?
      answer: No. Pure HTML + CSS + minimal vanilla JS. Zero runtime dependencies.

---

cta | centered pad(xl):
  headline: Ready to build?
  body: Start composing.
  cta:
    - label: Get early access | role(primary)
````

---

## Primitives

### Semantic sections

| Primitive | Description |
|-----------|-------------|
| `hero` | Page header — headline, body, CTA. Supports `split(60/40)` layout |
| `features` | Grid of feature cards with icon, title, body |
| `quote` | Pull quote or blockquote |
| `testimonial` | Customer quote with attribution |
| `prose` | Single-column reading view |
| `figure` | Image with aspect ratio, shadow, rounding |
| `gallery` | Multi-image grid |
| `cta` | Call-to-action band |
| `aside` | Callout / info box |
| `divider` | Horizontal rule |
| `nav` | Navigation bar — sticky, responsive |
| `footer` | Page footer with links |

### Interactive (zero dependencies)

| Primitive | Description |
|-----------|-------------|
| `tabs` | Tabbed content, ARIA-compliant |
| `accordion` | Collapsible FAQ using `<details>`/`<summary>` |
| `modal` | Dialog overlay via native `<dialog>` |
| `toggle` | Styled checkbox toggle |
| `chart` | Chart.js — bar, line, pie, doughnut — inlined for offline/headless use |

### Layout containers

| Primitive | Description |
|-----------|-------------|
| `stack` | Vertical flex flow |
| `split` | Horizontal split with configurable ratio |
| `grid(n)` | n-column CSS grid |
| `centered` | Horizontally centered container |
| `docspage` | Two-column sticky-sidebar docs layout |

### chart example

```
chart | type(bar) pad(lg):
  title: Monthly Revenue ($k)
  labels: Jan, Feb, Mar, Apr, May, Jun
  datasets:
    - label: 2024
      data: 42, 58, 71, 65, 89, 95
      color: secondary
    - label: 2025
      data: 55, 70, 88, 94, 112, 130
      color: accent
```

`type`: bar | line | pie | doughnut

### docspage example

```
docspage | pad(lg):
  sidebar:
    title: Documentation
    links:
      - label: Getting Started | href(/docs/start)
      - label: API Reference   | href(/docs/api)
  content:
    - prose:
        body: Main content here.
```

---

## Modifiers

| Modifier | Values |
|----------|--------|
| `pad` | xs sm md lg xl section |
| `gap` | xs sm md lg xl |
| `bg` | surface.default · elevated · inverted · warm |
| `shadow` | sm md lg |
| `aspect` | 1/1 · 4/3 · 16/9 · 3/2 |
| `split` | 50/50 · 60/40 · 40/60 · 70/30 |
| `grid` | 2 · 3 · 4 |
| `role` | primary · ghost · danger |
| `rounded` `sticky` `bleed` `accent` `muted` `inverted` `centered` | boolean flags |

---

## Themes

| Theme | Character |
|-------|-----------|
| `warm-editorial` | Parchment background · ink-blue accent · serif headlines |
| `cool-technical` | White · slate accent · monospace emphasis |
| `neutral-minimal` | Gray scale only · maximum whitespace |
| `dark-dramatic` | Deep background · high contrast · bright orange accent |

**Override:** `theme: warm-editorial + color.accent.default=#C84B31`

---

## Safe unicode icons

Confirmed cross-platform without an icon library — use for `icon:`:

`◆ ◇ ◉ ◊ ✓ ★ ☆ ● ○ ▲ △ ▶ → ⊕ ⊗`

**Avoid:** ◈ ✦ ✧ ✔ ⬡ ⬟ — tofu in headless Linux environments.

---

## Design tokens

```
color.surface.default / elevated / warm / inverted
color.text.primary / secondary / caption / accent
color.border.subtle / default / strong
color.accent.default / tint / shade

space.xs=4 / sm=8 / md=16 / lg=24 / xl=40 / section=80

type.scale.caption=12 / body=16 / lead=20 / h3=24 / h2=32 / h1=48 / display=64
type.leading.tight=1.2 / default=1.5 / loose=1.7

elevation.flat / raised / floating
radius.sm=4 / md=8 / lg=16 / xl=24 / pill=999
```

---

## All CLI tools

```bash
# Document lifecycle
node dist/tela-call.js create_document   '{"theme":"warm-editorial","mode":"landing","lang":"en"}'
node dist/tela-call.js open_document     '{"path":"./page.tela"}'
node dist/tela-call.js save_document     '{"doc_id":"doc-001","path":"./page.tela"}'
node dist/tela-call.js list_documents    '{}'
node dist/tela-call.js undo              '{"doc_id":"doc-001"}'

# Section editing
node dist/tela-call.js add_section       '{"doc_id":"doc-001","tela_fragment":"hero | pad(xl):\n  headline: Hi"}'
node dist/tela-call.js update_section    '{"doc_id":"doc-001","section_id":"section-1","tela_fragment":"..."}'
node dist/tela-call.js remove_section    '{"doc_id":"doc-001","section_id":"section-1"}'
node dist/tela-call.js reorder_sections  '{"doc_id":"doc-001","section_ids":["section-2","section-0","section-1"]}'
node dist/tela-call.js get_section       '{"doc_id":"doc-001","section_id":"section-1"}'
node dist/tela-call.js set_theme         '{"doc_id":"doc-001","theme_spec":"dark-dramatic"}'
node dist/tela-call.js update_block      '{"doc_id":"doc-001","path":"section-1.headline","props":{"headline":"New Title"}}'

# Render + feedback
node dist/tela-call.js render            '{"doc_id":"doc-001","out_dir":"/tmp/tela"}'
node dist/tela-call.js describe          '{"doc_id":"doc-001"}'
node dist/tela-call.js check             '{"doc_id":"doc-001"}'
node dist/tela-call.js apply_fix         '{"doc_id":"doc-001","fix_id":"spacing-rhythm.001"}'

# Discovery
node dist/tela-call.js list_components   '{}'
node dist/tela-call.js list_themes       '{}'
node dist/tela-call.js list_modifiers    '{}'
node dist/tela-call.js extract_html      '{"html":"<html>...</html>"}'

# Multi-page sites
node dist/tela-call.js create_site       '{"name":"My Site","theme":"warm-editorial"}'
node dist/tela-call.js add_page          '{"site_id":"site-001","slug":"index","doc_id":"doc-001"}'
node dist/tela-call.js remove_page       '{"site_id":"site-001","slug":"index"}'
node dist/tela-call.js render_site       '{"site_id":"site-001","out_dir":"./dist"}'
node dist/tela-call.js list_pages        '{"site_id":"site-001"}'
node dist/tela-call.js list_sites        '{}'
```

---

## describe manifest

`describe` returns a compact text manifest — semantic layout description without needing a screenshot:

```
doc: "Analytics Dashboard"  theme: dark-dramatic  mode: landing  lang: en
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
§1 nav  [sticky inverted]  strip  above-fold  [sticky]
   logo: "Analytics"

§2 hero  [centered pad(lg) inverted]  full  above-fold
   headline: "Q2 2025 Dashboard"
   body: "Key metrics and trends for the quarter."

§3 chart/bar  [pad(lg)]  large  straddles-fold(top 43% visible)
   title: "Monthly Revenue ($k)"
   labels: "Jan, Feb, Mar, Apr, May, Jun"

§4 chart/line  [pad(lg)]  large  below-fold
   title: "User Growth"

§5 features  [grid(3) gap(lg) pad(lg)]  medium  below-fold

viewport: 1440×900  |  page-height: ≈1750px
overlap: §1(sticky) covers §2–§5 — top 48px of each
```

**Size buckets:** `strip`(<80px) · `compact`(80–250px) · `medium`(250–450px) · `large`(450–700px) · `full`(>700px)  
**Fold labels:** `above-fold` · `straddles-fold(top N% visible)` · `below-fold`

Layout data is populated automatically after `render` when Puppeteer is available; degrades to AST-only manifest otherwise.

---

## Multi-page sites

```bash
node dist/tela-call.js create_site '{"name":"My Site","theme":"warm-editorial"}'   # → "site-001"
node dist/tela-call.js add_page '{"site_id":"site-001","slug":"index","doc_id":"doc-001"}'
node dist/tela-call.js add_page '{"site_id":"site-001","slug":"docs","doc_id":"doc-002"}'
node dist/tela-call.js render_site '{"site_id":"site-001","out_dir":"./dist"}'
```

Output:
```
dist/
  index.html
  docs/index.html
```

`href(/docs)` links resolve automatically relative to each page's location.

---

## MCP server

```bash
node dist/mcp/server.js
```

Connect any MCP client (Claude Desktop, Cursor, Zed). 26 tools — full session state, undo history.

---

## Checker

```json
{
  "score": 74,
  "summary": "Hero hierarchy clear; rhythm and focal-point issues in features",
  "checks": [
    {
      "id": "spacing-rhythm.001",
      "severity": "warning",
      "rule": "spacing-rhythm",
      "location": "section[1].grid",
      "finding": "gap(16px) conflicts with base unit (24px). Creates visual dissonance.",
      "fix": "Change gap modifier to lg or xl"
    }
  ]
}
```

**11 rules:** `unfilled-slots` · `heading-order` · `alt-text` · `line-length` · `type-scale` · `text-contrast` · `spacing-rhythm` · `whitespace-balance` · `focal-points` · `cta-placement` · `grid-consistency`

---

## Architecture

```
src/
  ast/          TypeScript AST type definitions
  parser/       .tela notation → AST
  tokens/       token resolution + 4 theme presets
  renderer/     AST → HTML+CSS (incremental, section-granular)
                describe.ts — semantic layout manifest for LLM feedback
  primitives/   30+ built-in components
  checker/      CheckReport engine (11 rules)
  extractor/    existing HTML → .tela approximation
  mcp/          DocumentStore + SiteStore + MCP server (26 tools)
  cli/          tela render / check / extract
```

---

## Status

| Phase | Package | Status |
|-------|---------|--------|
| 0 | `ast` — typed AST definitions | ✅ |
| 1 | `tokens` — token system, 4 themes | ✅ |
| 2 | `parser` — .tela → AST | ✅ |
| 3 | `renderer` — AST → HTML+CSS, incremental | ✅ |
| 4 | `primitives` — 30+ components | ✅ |
| 4 | `mcp` — 26 tools, DocumentStore, SiteStore, undo | ✅ |
| 4 | `interactive` — tabs, accordion, modal, toggle, chart | ✅ |
| 4 | `describe` — semantic layout manifest | ✅ |
| 5 | `checker` — 11 rules, fix patches | ✅ |
| 6 | Screenshot + layout measurement — Puppeteer integration | ✅ |
| 7 | `extractor` — HTML → .tela | ✅ |

**110 tests passing. Zero TypeScript errors.**

---

MIT
