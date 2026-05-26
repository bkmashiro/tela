/**
 * quote and testimonial primitive components.
 */

import type { RenderContext } from '../renderer/types.js';
import { T, esc, style, getModArg, hasMod, spaceToken, resolveString, shadowToken } from '../renderer/helpers.js';

export function renderQuote(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { properties, modifiers } = block;

  const text = resolveString(properties['text']);
  const cite = resolveString(properties['cite']);
  const role = resolveString(properties['role']);

  const isAccent = hasMod(modifiers, 'accent');
  const isCentered = hasMod(modifiers, 'centered');
  const padSize = getModArg(modifiers, 'pad', 'lg');

  const borderColor = isAccent ? T.accentDefault : T.accentDefault;
  const textAlign = isCentered ? 'center' : 'left';
  const maxWidth = '720px';

  const quoteStyle = isCentered
    ? style({
        'padding': spaceToken(padSize),
        'margin': '0 auto',
        'max-width': maxWidth,
        'text-align': 'center',
      })
    : style({
        'padding': `${spaceToken(padSize)} 0 ${spaceToken(padSize)} ${spaceToken(padSize)}`,
        'border-left': `3px solid ${borderColor}`,
        'margin': '0',
        'max-width': maxWidth,
      });

  let html = `<blockquote class="tela-quote" style="${quoteStyle}">\n`;

  if (text) {
    html += `  <p class="tela-quote__text" style="${style({
      'font-family': T.familySerif,
      'font-size': T.scaleLead,
      'font-style': 'normal',
      'line-height': T.leadingDefault,
      'color': T.textPrimary,
      'margin': `0 0 ${T.spaceSm} 0`,
    })}">${esc(text)}</p>\n`;
  }

  if (cite || role) {
    html += `  <footer class="tela-quote__cite" style="${style({
      'font-size': T.scaleCaption,
      'color': T.textCaption,
    })}">\n`;
    if (cite) {
      html += `    <span class="tela-quote__author">${esc(cite)}</span>`;
    }
    if (role) {
      html += `<span class="tela-quote__role">, ${esc(role)}</span>`;
    }
    html += `\n  </footer>\n`;
  }

  html += `</blockquote>`;
  return html;
}

export function renderTestimonial(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { properties, modifiers } = block;

  const text = resolveString(properties['text']);
  const name = resolveString(properties['name']);
  const role = resolveString(properties['role']);
  const company = resolveString(properties['company']);
  const avatarVal = properties['avatar'];
  const avatar = avatarVal ? resolveString(avatarVal) : '';

  const isRounded = hasMod(modifiers, 'rounded');
  const padSize = getModArg(modifiers, 'pad', 'lg');
  const shadowArg = getModArg(modifiers, 'shadow', 'sm');
  const shadow = shadowArg ? shadowToken(shadowArg) : T.elevationRaised;

  const containerStyle = style({
    'padding': spaceToken(padSize),
    'background': T.surfaceElevated,
    'border-radius': isRounded ? T.radiusMd : '0',
    'box-shadow': shadow,
  });

  let html = `<div class="tela-testimonial" style="${containerStyle}">\n`;

  if (text) {
    html += `  <p class="tela-testimonial__text" style="${style({
      'font-size': T.scaleBody,
      'line-height': T.leadingDefault,
      'color': T.textPrimary,
      'margin': `0 0 ${T.spaceMd} 0`,
    })}">&ldquo;${esc(text)}&rdquo;</p>\n`;
  }

  html += `  <div class="tela-testimonial__author" style="${style({
    'display': 'flex',
    'align-items': 'center',
    'gap': T.spaceSm,
  })}">\n`;

  if (avatar) {
    html += `    <img src="${esc(avatar)}" alt="${esc(name)}" class="tela-testimonial__avatar" style="${style({
      'width': '40px',
      'height': '40px',
      'border-radius': T.radiusPill,
      'object-fit': 'cover',
      'flex-shrink': '0',
    })}">\n`;
  }

  html += `    <div>\n`;
  if (name) {
    html += `      <div class="tela-testimonial__name" style="${style({
      'font-size': T.scaleBody,
      'font-weight': '500',
      'color': T.textPrimary,
    })}">${esc(name)}</div>\n`;
  }
  if (role || company) {
    const attribution = [role, company].filter(Boolean).join(', ');
    html += `      <div class="tela-testimonial__role" style="${style({
      'font-size': T.scaleCaption,
      'color': T.textCaption,
    })}">${esc(attribution)}</div>\n`;
  }
  html += `    </div>\n  </div>\n`;

  html += `</div>`;
  return html;
}
