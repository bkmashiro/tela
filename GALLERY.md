# Tela Gallery

Visual reference for all themes and primitives.

---

## Themes

Seven built-in themes. Same primitives, entirely different visual character.

| warm-editorial | cool-technical | neutral-minimal |
|:-:|:-:|:-:|
| ![warm-editorial](docs/assets/theme-warm-editorial.png) | ![cool-technical](docs/assets/theme-cool-technical.png) | ![neutral-minimal](docs/assets/theme-neutral-minimal.png) |
| Parchment · serif · ink-blue | White · slate · monospace | Gray scale · maximum whitespace |

| dark-dramatic | report | pitch | academic |
|:-:|:-:|:-:|:-:|
| ![dark-dramatic](docs/assets/theme-dark-dramatic.png) | ![report](docs/assets/theme-report.png) | ![pitch](docs/assets/theme-pitch.png) | ![academic](docs/assets/theme-academic.png) |
| Deep bg · orange · high contrast | IBM Plex · navy · tight | Space Grotesk · violet · bold | Garamond · muted blue · scholarly |

---

## Semantic primitives

### hero

Split layout (`hero | split(60/40) pad(xl):`) — headline, body, CTA on left; image on right.

![hero split](docs/assets/primitive-hero.png)

---

### features

Feature grid (`features | grid(3) gap(lg) pad(xl):`) — icon, title, body per card.

![features grid](docs/assets/primitive-features.png)

---

### quote + testimonial + cta

Pull quote, customer testimonial, and call-to-action band.

![quote testimonial cta](docs/assets/primitive-quote.png)

---

## Interactive primitives

### tabs + accordion + toggle

Zero dependencies — tabs use JS focus management, accordion uses `<details>`, modal uses `<dialog>`.

![tabs accordion toggle](docs/assets/primitive-interactive.png)

---

### chart

Chart.js inlined — bar, line, pie, doughnut. Renders correctly in Puppeteer (animation disabled).

![charts](docs/assets/primitive-chart.png)

---

## Data & structure primitives

### comparison

Side-by-side plan comparison (`comparison | pad(xl):`). `highlight: N` elevates the recommended column with accent styling.

![comparison](docs/assets/primitive-comparison.png)

---

### table + steps

Data table with striping and row highlight. Numbered steps and dated timeline.

![table and steps](docs/assets/primitive-data.png)

---

## Layout primitives

### docspage

Two-column sticky sidebar layout (`docspage | pad(lg):`).

![docspage layout](docs/assets/primitive-layout.png)

---

## Theme × layout examples

Same content, different themes — showing how themes do the design work.

| article (warm-editorial) | dashboard (dark-dramatic) | docs (cool-technical) |
|:-:|:-:|:-:|
| ![article](docs/assets/theme-article-warm-editorial.png) | ![dashboard](docs/assets/theme-dashboard-dark-dramatic.png) | ![docs](docs/assets/theme-docs-cool-technical.png) |

---

## Usage

```bash
# MCP server (recommended)
node dist/mcp/server.js

# CLI
node dist/tela-call.js create_document '{"theme":"warm-editorial","mode":"landing"}'
node dist/tela-call.js add_section '{"doc_id":"doc-001","tela_fragment":"hero | pad(xl):\n  headline: Hello"}'
node dist/tela-call.js render '{"doc_id":"doc-001","out_dir":"/tmp/out"}'
```

See [README.md](README.md) for the full primitive and tool reference.
