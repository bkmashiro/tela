# Tela

**LLM-native HTML page composer — layout primitives, aesthetic validation, MCP server.**

LLMs describe pages using composable primitives. Tela renders them, checks them aesthetically, and feeds back structured guidance so the LLM can iterate.

```
create_document() → add_section() × N → render() → check() → update_section() → render()
```

---

## How it works

Instead of writing HTML or CSS, an LLM declares intent using Tela's notation — typed sections with modifier chains. Tela handles the translation to production HTML, validates the result against aesthetic rules, and returns machine-readable feedback the LLM can act on immediately.

````
---
theme: warm-editorial
mode: landing
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

features | grid(3) gap(lg):
  - icon: ◆ | accent
    title: Composable
    body: 30+ primitives. Combine freely.
  - icon: ◈ | accent
    title: Verifiable
    body: Checks read like design feedback.
  - icon: ◉ | accent
    title: Bidirectional
    body: Import any HTML into Tela.

---

quote | centered bg(surface.warm) pad(xl):
  text: The best design gets out of the way.
  attribution: — Someone wise
````

**Syntax rules:**
- `---` separates sections (and wraps frontmatter)
- `type | mod1 mod2(arg):` declares a block with a modifier chain
- `|` separates type from modifiers; `mod(arg)` = with argument, `mod` = boolean flag
- Indentation expresses child structure (YAML semantics)
- `#` for comments

---

## Layout Primitives

**Composition** — how children are arranged:

| Primitive | Description |
|-----------|-------------|
| `stack` | Vertical flow (default) |
| `split(ratio)` | Horizontal split, e.g. `split(60/40)` |
| `grid(n)` | n-column grid |
| `masonry(n)` | Waterfall layout |
| `prose` | Single-column reading view |
| `centered` | Horizontally centered container |

**Semantic section types** (map to `<section>` with role):

`hero` · `feature` · `quote` · `testimonial` · `prose` · `figure` · `gallery` · `cta` · `aside` · `divider` · `footer` · `nav`

**Modifiers** (chain after `|`):

`pad(xs|sm|md|lg|xl|section)` · `gap(xs|sm|md|lg|xl)` · `bg(token)` · `rounded` · `shadow(sm|md|lg)` · `bleed` · `aspect(w/h)` · `accent` · `muted` · `inverted` · `role(primary|ghost|danger)`

---

## Design Token System

All visual decisions flow through a semantic token tree — no raw CSS values in notation:

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

**Four built-in themes:**

| Theme | Character |
|-------|-----------|
| `warm-editorial` | Parchment background, ink-blue accent, single serif — editorial calm |
| `cool-technical` | White, slate accent, monospace emphasis — developer clarity |
| `neutral-minimal` | Gray scale only, maximum whitespace — pure restraint |
| `dark-dramatic` | Deep background, high contrast, bright accent — bold impact |

**Override syntax:**
```yaml
theme: warm-editorial + color.accent.default=#C84B31
```

---

## MCP Server

Tela runs as an MCP server. Connect any MCP client and use 15 tools to create, edit, render, and check documents in a stateful session with full undo history.

**Document lifecycle:**
```
create_document(theme?, mode?, lang?)   → doc_id
open_document(path)                     → doc_id
save_document(doc_id, path?)            → saved_path
list_documents()                        → [{id, mode, section_count}]
undo(doc_id)                            → restored snapshot
```

**Section editing** (primary unit of mutation):
```
add_section(doc_id, tela_fragment, position?)
update_section(doc_id, section_id, tela_fragment)
remove_section(doc_id, section_id)
reorder_sections(doc_id, section_ids[])
set_theme(doc_id, theme_spec)
```

**Fine-grained block editing:**
```
get_section(doc_id, section_id)           → annotated tela fragment
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
list_components()             → block registry + example tela
list_themes()                 → theme presets
list_modifiers()              → modifier vocabulary + valid values
```

---

## Checker

Feedback reads like design guidance, not lint output. Every finding includes a concrete fix the LLM (or `apply_fix`) can act on immediately.

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
    },
    {
      "id": "focal-points.001",
      "severity": "warning",
      "rule": "focal-points",
      "location": "section[0].hero",
      "finding": "3 elements compete for primary attention: headline, figure, dual-CTA.",
      "fix": "Remove ghost CTA from hero; place in a dedicated section below"
    }
  ]
}
```

**11 check rules:** `unfilled-slots` · `heading-order` · `alt-text` · `line-length` · `type-scale` · `text-contrast` · `spacing-rhythm` · `whitespace-balance` · `focal-points` · `cta-placement` · `grid-consistency`

---

## Typical LLM Workflow

```
list_components()          # discover available primitives
create_document(theme="warm-editorial", mode="landing")
add_section(doc, "hero | split(60/40) pad(xl): ...")
add_section(doc, "features | grid(3) gap(lg): ...")
add_section(doc, "cta | centered pad(xl): ...")
render(doc)                # → {html_path, screenshot_path}
check(doc)                 # → CheckReport
apply_fix(doc, "spacing-rhythm.001")
render(doc)                # → updated screenshot
save_document(doc, "./landing.tela")
```

---

## Architecture

```
src/
  ast/          # TypeScript AST type definitions
  parser/       # .tela notation → AST
  tokens/       # token resolution + 4 theme presets
  renderer/     # AST → HTML+CSS (section-granular, incremental)
  primitives/   # built-in block library (13 components)
  checker/      # CheckReport engine (11 rules)
  extractor/    # existing HTML → .tela approximation
  mcp/          # DocumentStore + MCP server (15 tools)
  cli/          # tela render / check / extract
```

---

## Status

| Phase | Package | Status |
|-------|---------|--------|
| 0 | `ast` — typed AST definitions | ✅ complete |
| 1 | `tokens` — token system, 4 theme presets | ✅ complete |
| 2 | `parser` — .tela → AST | ✅ complete |
| 3 | `renderer` — AST → HTML+CSS, incremental | ✅ complete |
| 4 | `primitives` — 13 built-in components | ✅ complete |
| 4 | `mcp` — DocumentStore, 15 tools, history/undo | ✅ complete |
| 5 | `checker` — CheckReport, 11 rules, fix patches | 🔜 next |
| 6 | Screenshot — Puppeteer integration | 🔜 next |
| 7 | `extractor` — HTML → .tela | 🔜 next |
| 8 | `apply_fix` — auto-patch from fix_id | 🔜 next |

**59 tests passing. Zero TypeScript errors.**

---

## License

MIT
