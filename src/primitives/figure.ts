/**
 * figure and gallery primitive components.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, hasMod, spaceToken, shadowToken, resolveString,
  getArrayItems, getBlockValueProps
} from '../renderer/helpers.js';
import type { Value } from '../ast/types.js';

export function renderFigure(ctx: RenderContext): string {
  const { block, mode } = ctx.section.block.blockType === 'figure'
    ? { block: ctx.section.block, mode: ctx.mode }
    : { block: ctx.section.block, mode: ctx.mode };

  const { properties, modifiers } = ctx.section.block;

  const srcVal = properties['src'] ?? properties['figure'];
  const src = srcVal ? resolveString(srcVal.type === 'modified' ? srcVal.base : srcVal) : '';
  const alt = resolveString(properties['alt']);
  const caption = resolveString(properties['caption']);

  const isRounded = hasMod(modifiers, 'rounded');
  const isBleed = hasMod(modifiers, 'bleed');
  const isFloat = hasMod(modifiers, 'float');
  const isCentered = hasMod(modifiers, 'centered');

  const aspectMod = modifiers.find((m) => m.name === 'aspect');
  const aspect = aspectMod ? `${aspectMod.args[0]}/${aspectMod.args[1]}` : 'auto';

  const shadowArg = getModArg(modifiers, 'shadow', '');
  const shadow = shadowArg ? shadowToken(shadowArg) : 'none';

  const figureStyle = style({
    'margin': '0',
    'padding': `${T.spaceLg} 0`,
    'max-width': isBleed ? 'none' : '100%',
    ...(isFloat ? { 'float': 'right', 'width': '50%', 'margin-left': T.spaceLg } : {}),
    ...(isCentered ? { 'text-align': 'center' } : {}),
  });

  const imgStyle = style({
    'width': '100%',
    'height': 'auto',
    'aspect-ratio': aspect,
    'object-fit': 'cover',
    'border-radius': isRounded ? T.radiusLg : '0',
    'box-shadow': shadow,
    'display': 'block',
  });

  let html = `<figure class="tela-figure" style="${figureStyle}">\n`;
  if (src) {
    html += `  <img src="${esc(src)}" alt="${esc(alt)}" style="${imgStyle}">\n`;
  }
  if (caption) {
    html += `  <figcaption class="tela-figure__caption" style="${style({
      'font-size': T.scaleCaption,
      'color': T.textCaption,
      'margin-top': T.spaceSm,
      'text-align': 'center',
    })}">${esc(caption)}</figcaption>\n`;
  }
  html += `</figure>`;
  return html;
}

export function renderGallery(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { properties, modifiers, children } = block;

  const isMasonry = hasMod(modifiers, 'masonry');
  const cols = modifiers.find((m) => m.name === 'grid')?.args[0] ?? 3;
  const gapSize = getModArg(modifiers, 'gap', 'md');
  const padSize = getModArg(modifiers, 'pad', 'lg');

  const containerStyle = isMasonry
    ? style({
        'column-count': String(cols),
        'column-gap': spaceToken(gapSize),
        'padding': `${spaceToken(padSize)} 0`,
      })
    : style({
        'display': 'grid',
        'grid-template-columns': `repeat(${cols}, 1fr)`,
        'gap': spaceToken(gapSize),
        'padding': `${spaceToken(padSize)} 0`,
      });

  let html = `<div class="tela-gallery tela-gallery--${cols}" style="${containerStyle}">\n`;

  for (const child of children) {
    if (child.type === 'array') {
      for (const item of child.items) {
        html += renderGalleryItem(item);
      }
    }
  }

  html += `</div>`;
  return html;
}

function renderGalleryItem(val: Value): string {
  let src = '';
  let alt = '';
  let caption = '';
  let aspect = '1/1';

  if (val.type === 'blockValue') {
    const props = val.properties;
    const srcVal = props['src'] ?? props['figure'];
    if (srcVal) src = resolveString(srcVal.type === 'modified' ? srcVal.base : srcVal);
    if (props['alt']) alt = resolveString(props['alt']);
    if (props['caption']) caption = resolveString(props['caption']);
    const aspectVal = props['aspect'];
    if (aspectVal) {
      const av = resolveString(aspectVal);
      if (av.includes('/')) aspect = av;
    }
  } else if (val.type === 'reference') {
    src = val.path;
  } else if (val.type === 'modified') {
    src = resolveString(val.base);
    const aspectMod = val.modifiers.find((m) => m.name === 'aspect');
    if (aspectMod) aspect = `${aspectMod.args[0]}/${aspectMod.args[1]}`;
  }

  const imgStyle = style({
    'width': '100%',
    'height': 'auto',
    'aspect-ratio': aspect,
    'object-fit': 'cover',
    'border-radius': T.radiusSm,
    'display': 'block',
  });

  let html = `  <figure class="tela-gallery__item" style="margin: 0;">\n`;
  if (src) {
    html += `    <img src="${esc(src)}" alt="${esc(alt)}" style="${imgStyle}">\n`;
  }
  if (caption) {
    html += `    <figcaption style="font-size: var(--t-scale-caption); color: var(--t-text-caption); margin-top: 4px; text-align: center;">${esc(caption)}</figcaption>\n`;
  }
  html += `  </figure>\n`;
  return html;
}
