/**
 * feature primitive component.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, hasMod, getModArg, spaceToken, shadowToken, radiusToken,
  resolveString
} from '../renderer/helpers.js';

export function renderFeature(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { properties, modifiers } = block;

  const icon = resolveString(properties['icon']);
  const title = resolveString(properties['title']);
  const body = resolveString(properties['body']);
  const link = resolveString(properties['link']);

  const isAccent = hasMod(modifiers, 'accent');
  const isMuted = hasMod(modifiers, 'muted');
  const isRounded = hasMod(modifiers, 'rounded');
  const padSize = getModArg(modifiers, 'pad', 'lg');
  const shadowArg = getModArg(modifiers, 'shadow', '');
  const shadow = shadowArg ? shadowToken(shadowArg) : T.elevationRaised;
  const radius = isRounded ? T.radiusMd : '0';

  const bgColor = isMuted ? T.surfaceWarm : T.surfaceElevated;
  const titleColor = isAccent ? T.accentDefault : T.textPrimary;

  const containerStyle = style({
    'padding': spaceToken(padSize),
    'background': bgColor,
    'border-radius': radius,
    'box-shadow': shadow,
    'display': 'flex',
    'flex-direction': 'column',
    'height': '100%',
  });

  let html = `<div class="tela-feature" style="${containerStyle}">\n`;

  if (icon) {
    html += `  <div class="tela-feature__icon" style="${style({
      'font-size': '24px',
      'color': T.accentDefault,
      'margin-bottom': T.spaceSm,
    })}">${esc(icon)}</div>\n`;
  }

  if (title) {
    html += `  <h3 class="tela-feature__title" style="${style({
      'font-family': T.familySerif,
      'font-size': T.scaleH3,
      'font-weight': T.weightHeading,
      'line-height': T.leadingTight,
      'color': titleColor,
      'margin': `0 0 ${T.spaceXs} 0`,
    })}">${esc(title)}</h3>\n`;
  }

  if (body) {
    html += `  <p class="tela-feature__body" style="${style({
      'font-size': T.scaleBody,
      'line-height': T.leadingDefault,
      'color': T.textSecondary,
      'margin': '0',
      'flex': '1',
    })}">${esc(body)}</p>\n`;
  }

  if (link) {
    html += `  <a class="tela-feature__link" href="${esc(link)}" style="${style({
      'font-size': T.scaleBody,
      'color': T.accentDefault,
      'text-decoration': 'none',
      'margin-top': T.spaceSm,
      'font-weight': '500',
    })}">Learn more →</a>\n`;
  }

  html += `</div>`;
  return html;
}
