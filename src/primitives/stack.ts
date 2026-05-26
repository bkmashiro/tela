/**
 * stack, split, centered generic layout containers.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, getModNum, hasMod, spaceToken, resolveString
} from '../renderer/helpers.js';
import { renderBlock } from '../renderer/index.js';
import type { Block } from '../ast/types.js';

export function renderStack(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { modifiers, children } = block;

  const gapSize = getModArg(modifiers, 'gap', 'md');
  const padSize = getModArg(modifiers, 'pad', '');
  const isBleed = hasMod(modifiers, 'bleed');

  const stackStyle = style({
    'display': 'flex',
    'flex-direction': 'column',
    'gap': spaceToken(gapSize),
    ...(padSize ? { 'padding': spaceToken(padSize) } : {}),
    'max-width': isBleed ? 'none' : '1200px',
    'margin': isBleed ? '0' : '0 auto',
  });

  let html = `<div class="tela-stack" style="${stackStyle}">\n`;
  for (const child of children) {
    if (child.type === 'block') {
      html += `  ${renderBlock(child, ctx)}\n`;
    }
  }
  html += `</div>`;
  return html;
}

export function renderSplit(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { modifiers, children, properties } = block;

  const splitMod = modifiers.find((m) => m.name === 'split');
  const leftFr = splitMod?.args[0] ?? 50;
  const rightFr = splitMod?.args[1] ?? 50;
  const gapSize = getModArg(modifiers, 'gap', 'xl');
  const padSize = getModArg(modifiers, 'pad', '');

  const splitStyle = style({
    'display': 'grid',
    'grid-template-columns': `${leftFr}fr ${rightFr}fr`,
    'gap': spaceToken(gapSize),
    ...(padSize ? { 'padding': `${spaceToken(padSize)} ${T.spaceXl}` } : {}),
    'max-width': '1200px',
    'margin': '0 auto',
    'align-items': 'center',
  });

  // Get left/right sub-blocks from properties
  const leftProps = properties['left'];
  const rightProps = properties['right'];

  let html = `<div class="tela-split" style="${splitStyle}">\n`;

  if (leftProps?.type === 'blockValue') {
    const leftBlock: Block = {
      type: 'block',
      blockType: 'stack',
      modifiers: [],
      properties: leftProps.properties,
      children: leftProps.children,
      source: leftProps.source,
    };
    html += `  <div class="tela-split__left">${renderBlock(leftBlock, ctx)}</div>\n`;
  } else if (children.length >= 1) {
    html += `  <div class="tela-split__left">${renderBlock(children[0] as Block, ctx)}</div>\n`;
  }

  if (rightProps?.type === 'blockValue') {
    const rightBlock: Block = {
      type: 'block',
      blockType: 'stack',
      modifiers: [],
      properties: rightProps.properties,
      children: rightProps.children,
      source: rightProps.source,
    };
    html += `  <div class="tela-split__right">${renderBlock(rightBlock, ctx)}</div>\n`;
  } else if (children.length >= 2) {
    html += `  <div class="tela-split__right">${renderBlock(children[1] as Block, ctx)}</div>\n`;
  }

  html += `</div>`;
  return html;
}

export function renderCentered(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { modifiers, children, properties } = block;

  const padSize = getModArg(modifiers, 'pad', 'section');
  const maxWidth = '720px';

  const centeredStyle = style({
    'max-width': maxWidth,
    'margin': '0 auto',
    'padding': `${spaceToken(padSize)} ${T.spaceXl}`,
    'text-align': 'center',
  });

  let html = `<div class="tela-centered" style="${centeredStyle}">\n`;
  for (const child of children) {
    if (child.type === 'block') {
      html += `  ${renderBlock(child, ctx)}\n`;
    }
  }
  html += `</div>`;
  return html;
}
