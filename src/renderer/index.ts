/**
 * Tela renderer: ComponentTree → HTML+CSS string.
 *
 * Features:
 * - Section-granular incremental rendering via RenderCache
 * - Token injection as CSS custom properties in :root
 * - Single self-contained HTML output
 */

import type { TelaDocument, Block } from '../ast/types.js';
import { resolveTokens } from '../tokens/resolver.js';
import { renderTokensCSS, hashTokens } from '../tokens/resolver.js';
import type {
  ComponentTree,
  CompiledSection,
  RenderContext,
  RenderCache,
  RenderResult,
  ComponentDefinition,
} from './types.js';
import { makeEmptyCache } from './types.js';
import { generateFontLinks } from './fonts.js';
import { esc } from './helpers.js';
import { COMPONENT_REGISTRY } from '../primitives/index.js';

export { makeEmptyCache };
export type { ComponentTree, RenderCache, RenderResult, CompiledSection };

// ─── Compiler step ────────────────────────────────────────────────────────────

/**
 * Compile a TelaDocument AST into a ComponentTree.
 * Resolves tokens and validates block types.
 */
export function compile(doc: TelaDocument): ComponentTree {
  const tokens = resolveTokens(doc.frontmatter.theme, doc.frontmatter.tokenOverrides);

  const sections: CompiledSection[] = doc.sections.map((s) => ({
    id: s.id,
    block: s.block,
    modifiers: s.block.modifiers,
  }));

  return {
    frontmatter: doc.frontmatter,
    tokens,
    sections,
  };
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Render a ComponentTree to an HTML string.
 * Uses the provided cache for incremental rendering.
 */
export function render(
  tree: ComponentTree,
  cache: RenderCache = makeEmptyCache()
): RenderResult {
  const tokenHash = hashTokens(tree.tokens);
  const themeChanged = tokenHash !== cache.tokenHash;
  if (themeChanged) {
    cache.sections.clear();
    cache.tokenHash = tokenHash;
  }

  const renderedSections: string[] = [];
  const sectionHtmlParts: string[] = [];

  for (const section of tree.sections) {
    let html: string;
    const cached = cache.sections.get(section.id);

    if (cached && !themeChanged) {
      html = cached;
    } else {
      html = renderSection(section, tree);
      cache.sections.set(section.id, html);
      renderedSections.push(section.id);
    }

    sectionHtmlParts.push(`  <!-- Section: ${section.id} -->\n${html}`);
  }

  const tokensCSS = renderTokensCSS(tree.tokens);
  const fontLinks = generateFontLinks(tree.tokens.values);
  const { frontmatter } = tree;

  const html = buildDocument({
    title: frontmatter.title ?? 'Untitled',
    description: frontmatter.description,
    lang: frontmatter.lang,
    tokensCSS,
    fontLinks,
    mode: frontmatter.mode,
    bodyContent: sectionHtmlParts.join('\n\n'),
  });

  return { html, renderedSections };
}

function renderSection(section: CompiledSection, tree: ComponentTree): string {
  const ctx: RenderContext = {
    tokens: tree.tokens,
    section,
    mode: tree.frontmatter.mode,
  };
  return renderBlock(section.block, ctx);
}

/**
 * Render a single block to HTML. Dispatches to the component registry.
 */
export function renderBlock(block: Block, ctx: RenderContext): string {
  const component: ComponentDefinition | undefined = COMPONENT_REGISTRY[block.blockType];
  if (component) {
    // Pass a context that scopes to this block
    const blockCtx: RenderContext = {
      ...ctx,
      section: {
        ...ctx.section,
        block,
        modifiers: block.modifiers,
      },
    };
    return component.render(blockCtx);
  }
  // Unknown block type — render as a generic div with a comment
  return `<div class="tela-unknown tela-block--${esc(block.blockType)}" data-block-type="${esc(block.blockType)}"><!-- Unknown block type: ${esc(block.blockType)} --></div>`;
}

// ─── Document shell ───────────────────────────────────────────────────────────

interface DocumentShellOptions {
  title: string;
  description?: string;
  lang: string;
  tokensCSS: string;
  fontLinks: string;
  mode: 'landing' | 'article' | 'docs';
  bodyContent: string;
}

function buildDocument(opts: DocumentShellOptions): string {
  const { title, description, lang, tokensCSS, fontLinks, mode, bodyContent } = opts;

  const metaDesc = description
    ? `\n  <meta name="description" content="${esc(description)}">`
    : '';

  const modeBodyStyle = mode === 'article'
    ? 'max-width: 720px; margin: 0 auto;'
    : mode === 'docs'
    ? 'display: flex; align-items: flex-start;'
    : '';

  const bodyStyleAttr = modeBodyStyle ? ` style="${modeBodyStyle}"` : '';

  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>${metaDesc}
  ${fontLinks}
  <style>
    /* Reset */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* Tokens */
    ${tokensCSS}

    /* Base */
    body {
      font-family: var(--t-family-sans);
      font-size: var(--t-scale-body);
      line-height: var(--t-leading-default);
      color: var(--t-text-primary);
      background: var(--t-surface-default);
      -webkit-font-smoothing: antialiased;
    }

    /* Responsive grid overrides */
    @media (max-width: 768px) {
      .tela-grid--4, .tela-grid--5, .tela-grid--6 {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      .tela-hero__inner[style*="grid-template-columns"] {
        grid-template-columns: 1fr !important;
      }
    }
    @media (max-width: 480px) {
      .tela-grid--2, .tela-grid--3, .tela-grid--4, .tela-grid--5, .tela-grid--6 {
        grid-template-columns: 1fr !important;
      }
    }
  </style>
</head>
<body${bodyStyleAttr}>
${bodyContent}
</body>
</html>`;
}
