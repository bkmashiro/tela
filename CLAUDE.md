# Tela

**LLM-native HTML page composer — layout primitives, aesthetic validation, MCP server.**

LLMs describe pages with composable primitives. Tela renders them, checks them, and feeds back structured aesthetic guidance.

```
create_document() → add_section() × N → render() → check() → update_section() → render()
```

→ [Detailed Design](./DESIGN.md)

---

## Project Structure

```
src/
  parser/       # .tela notation → AST
  ast/          # typed AST node definitions
  compiler/     # AST → ComponentTree (validate, resolve refs)
  renderer/     # ComponentTree → HTML + CSS (section-granular, incremental)
  tokens/       # design token system + theme presets
  checker/      # HTML → CheckReport (aesthetic + structural rules)
  extractor/    # existing HTML → .tela approximation
  primitives/   # built-in block library (hero, feature, grid, prose, ...)
  mcp/          # MCP server, DocumentStore, session state
  cli/          # tela render / check / extract CLI

themes/         # theme preset JSON files
examples/       # sample .tela documents
references/     # checker thresholds, token registry JSON
```

---

## Tela Notation (.tela)

```yaml
---
theme: warm-editorial
mode: landing
lang: en
---

hero | split(60/40) pad(xl):
  left:
    eyebrow: "v2.0 · Now in beta"
    headline: |
      Make something
      worth reading
    body: Tela composes HTML pages from layout primitives.
    cta:
      - label: Get started   | role(primary)
      - label: See examples  | role(ghost)
  right:
    figure: ./hero.png | aspect(4/3) rounded shadow(lg)

---

features | grid(3) gap(lg):
  - icon: ◆ | accent
    title: Composable
    body: 30+ primitives. Combine freely.
```

**Syntax rules:**
- `---` separates sections (also used for frontmatter)
- `type | mod1 mod2(arg):` defines a Block with modifier chain
- `|` separates type from modifiers; `mod(arg)` = with arg, `mod` = boolean
- Indentation = child structure (YAML semantics)
- Frontmatter in top `---` block

---

## Layout Primitives

**Composition (how children arrange):**
`stack` · `split(ratio)` · `grid(n)` · `masonry(n)` · `prose` · `centered`

**Modifiers (`|` chain):**
`pad(xs|sm|md|lg|xl|section)` · `gap(xs|sm|md|lg|xl)` · `bg(token)` · `rounded` ·
`shadow(sm|md|lg)` · `bleed` · `aspect(w/h)` · `float` · `accent` · `muted` · `inverted` ·
`role(primary|ghost|danger)`

**Semantic section types:**
`hero` · `feature` · `quote` · `testimonial` · `prose` · `figure` · `gallery` ·
`cta` · `aside` · `divider` · `footer` · `nav`

---

## Token System

```
color.surface.default / elevated / warm / inverted
color.text.primary / secondary / caption / accent / inverse
color.border.subtle / default / strong
color.accent.default / tint / shade

space.xs=4 / sm=8 / md=16 / lg=24 / xl=40 / section=80

type.scale.caption=12 / body=16 / lead=20 / h3=24 / h2=32 / h1=48 / display=64
type.weight.body=400 / heading=500
type.leading.tight=1.2 / default=1.5 / loose=1.7

elevation.flat / raised / floating
radius.sm=4 / md=8 / lg=16 / xl=24 / pill=999
```

**Theme presets:** `warm-editorial` · `cool-technical` · `neutral-minimal` · `dark-dramatic`

**Override syntax:** `theme: warm-editorial + color.accent=#C84B31`

---

## MCP Tool Surface

**Document lifecycle:**
```
create_document(theme?, mode?, lang?)   → doc_id
open_document(path)                    → doc_id
save_document(doc_id, path?)           → saved_path
list_documents()                       → [{id, mode, section_count}]
undo(doc_id)                           → restored snapshot
```

**Section editing (primary unit of mutation):**
```
add_section(doc_id, tela_fragment, position?)
update_section(doc_id, section_id, tela_fragment)
remove_section(doc_id, section_id)
reorder_sections(doc_id, [section_id, ...])
set_theme(doc_id, theme_spec)
```

**Fine-grained block editing:**
```
get_section(doc_id, section_id)           → annotated tela_fragment
update_block(doc_id, path, props)         # path: "hero.left.cta[0].label"
```

**Render + check loop:**
```
render(doc_id)                → {html_path, screenshot_path}
check(doc_id)                 → CheckReport JSON
apply_fix(doc_id, fix_id)     → auto-apply checker suggestion
```

**Discovery:**
```
list_components()             → Block registry + example tela
list_themes()                 → theme presets
list_modifiers()              → modifier vocabulary + valid values
```

---

## Checker Output Format

```json
{
  "score": 74,
  "summary": "Hero hierarchy clear; rhythm issues in features section",
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

**Check rules:** `unfilled-slots` · `heading-order` · `alt-text` · `line-length` ·
`type-scale` · `text-contrast` · `spacing-rhythm` · `whitespace-balance` ·
`focal-points` · `cta-placement` · `grid-consistency`

---

## Tech Stack

- **TypeScript / Node.js** (ESM, strict mode)
- MCP: `@modelcontextprotocol/sdk`
- HTML parsing: `htmlparser2` + `cheerio`
- CSS analysis: `css-tree`
- Color: `chroma-js` (WCAG contrast)
- Screenshot: Puppeteer (optional, graceful degradation)
- Test: Jest

---

## Implementation Phases

| Phase | Package | Content |
|-------|---------|---------|
| 0 | `ast` + `parser` | .tela → typed AST, section-granular |
| 1 | `tokens` | token resolution, 4 theme presets, override syntax |
| 2 | `renderer` | AST → HTML+CSS, incremental by section |
| 3 | `primitives` | hero/feature/grid/prose/quote/cta/footer |
| 4 | `mcp` | DocumentStore, history, MCP server |
| 5 | `checker` | CheckReport, 11 rules, fix patch mechanism |
| 6 | screenshot | Puppeteer integration |
| 7 | `extractor` | HTML → .tela approximation |
| 8 | `apply_fix` | auto-patch from fix_id |
