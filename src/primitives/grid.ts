/**
 * grid and features primitives.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, getModNum, hasMod, spaceToken,
  getArrayItems, resolveString, getBlockValueProps
} from '../renderer/helpers.js';
import { renderBlock } from '../renderer/index.js';
import type { Value, Block } from '../ast/types.js';

export function renderGrid(ctx: RenderContext): string {
  const { section, tokens, mode } = ctx;
  const { block } = section;
  const { properties, modifiers, children } = block;

  const cols = getModNum(modifiers, 'grid', 3);
  const gapSize = getModArg(modifiers, 'gap', 'lg');
  const padSize = getModArg(modifiers, 'pad', 'section');
  const isBleed = hasMod(modifiers, 'bleed');

  const gridStyle = style({
    'display': 'grid',
    'grid-template-columns': `repeat(${cols}, 1fr)`,
    'gap': spaceToken(gapSize),
    'padding': `${spaceToken(padSize)} ${T.spaceXl}`,
    'max-width': isBleed ? 'none' : '1200px',
    'margin': isBleed ? '0' : '0 auto',
  });

  // Gather child items — from children array or from array properties
  const items = gatherGridItems(block, ctx);

  let html = `<div class="tela-grid tela-grid--${cols}" style="${gridStyle}">\n`;
  for (const item of items) {
    html += `  ${item}\n`;
  }
  html += `</div>`;
  return html;
}

export function renderFeatures(ctx: RenderContext): string {
  // features is essentially a grid of feature blocks
  return renderGrid(ctx);
}

function gatherGridItems(block: Block, ctx: RenderContext): string[] {
  const items: string[] = [];

  // Children from the block's children array (ArrayValues)
  for (const child of block.children) {
    if (child.type === 'array') {
      for (const item of child.items) {
        items.push(renderValueAsGridItem(item, ctx));
      }
    }
  }

  return items;
}

function renderValueAsGridItem(val: Value, ctx: RenderContext): string {
  if (val.type === 'blockValue') {
    // Determine what kind of block this is — default to 'feature'
    const props = val.properties;
    const title = props['title'];
    const body = props['body'];
    const icon = props['icon'];

    // Build a synthetic feature block
    const featureBlock: Block = {
      type: 'block',
      blockType: 'feature',
      modifiers: [{ type: 'modifier', name: 'rounded', args: [], source: { line: 0, column: 0 } }],
      properties: props,
      children: [],
      source: { line: 0, column: 0 },
    };

    return renderBlock(featureBlock, ctx);
  }

  return `<div class="tela-grid__item">${resolveString(val)}</div>`;
}
