/**
 * Renderer types: ComponentTree, CompiledSection, RenderContext.
 */

import type { Frontmatter, Block, Modifier, Value } from '../ast/types.js';
import type { ResolvedTokens } from '../tokens/types.js';

export interface ComponentTree {
  frontmatter: Frontmatter;
  tokens: ResolvedTokens;
  sections: CompiledSection[];
}

export interface CompiledSection {
  id: string;
  block: Block;
  /** Resolved modifier list (same as block.modifiers but typed for convenience). */
  modifiers: Modifier[];
}

export interface RenderContext {
  tokens: ResolvedTokens;
  section: CompiledSection;
  mode: 'landing' | 'article' | 'docs';
  basePath?: string;    // for site-relative link resolution
  sitePages?: string[]; // available page slugs
}

export type ComponentRenderFn = (ctx: RenderContext) => string;

export interface ComponentDefinition {
  name: string;
  render: ComponentRenderFn;
  /** Known valid modifier names for this component. */
  validModifiers?: string[];
  /** Required property names. */
  requiredProps?: string[];
}

/** Incremental render cache. */
export interface RenderCache {
  /** Section ID → rendered HTML fragment. */
  sections: Map<string, string>;
  /** Hash of the resolved tokens. Invalidates all sections on theme change. */
  tokenHash: string;
}

export interface SectionLayout {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  position: string;  // 'static' | 'sticky' | 'fixed' | 'absolute' | 'relative'
  zIndex: string;    // e.g. '100' or 'auto'
}

export interface RenderResult {
  html: string;
  /** Paths of sections that were re-rendered (not from cache). */
  renderedSections: string[];
}

export function makeEmptyCache(): RenderCache {
  return { sections: new Map(), tokenHash: '' };
}
