/**
 * nav primitive component.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, hasMod, spaceToken, resolveString,
  getArrayItems, getBlockValueProps
} from '../renderer/helpers.js';

export function renderNav(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { properties, modifiers } = block;

  const brand = resolveString(properties['brand']);
  const logo = resolveString(properties['logo'] ?? properties['logoSrc'] ?? { type: 'string', value: '', source: { line: 0, column: 0 } });
  const linksVal = properties['links'];
  const ctaVal = properties['cta'];

  const isSticky = hasMod(modifiers, 'sticky') || true; // sticky by default per spec
  const isInverted = hasMod(modifiers, 'inverted');
  const padSize = getModArg(modifiers, 'pad', 'md');
  const bgToken = getModArg(modifiers, 'bg', '');

  const bgColor = bgToken
    ? `var(--t-${bgToken.replace(/\./g, '-')})`
    : isInverted
    ? T.surfaceInverted
    : T.surfaceDefault;
  const textColor = isInverted ? T.textInverse : T.textSecondary;
  const brandColor = isInverted ? T.textInverse : T.textPrimary;

  const navStyle = style({
    'padding': `${spaceToken(padSize)} ${T.spaceXl}`,
    'background': bgColor,
    'border-bottom': `1px solid ${T.borderSubtle}`,
    ...(isSticky ? { 'position': 'sticky', 'top': '0', 'z-index': '100' } : {}),
  });

  const innerStyle = style({
    'max-width': '1200px',
    'margin': '0 auto',
    'display': 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
  });

  let html = `<nav class="tela-nav" style="${navStyle}">\n`;
  html += `  <div class="tela-nav__inner" style="${innerStyle}">\n`;

  // Brand
  html += `    <div class="tela-nav__brand" style="${style({
    'font-family': T.familySerif,
    'font-size': T.scaleLead,
    'font-weight': T.weightHeading,
    'color': brandColor,
    'text-decoration': 'none',
    'display': 'flex',
    'align-items': 'center',
    'gap': T.spaceSm,
  })}">${esc(brand)}</div>\n`;

  // Links + CTA
  html += `    <div class="tela-nav__links" style="${style({
    'display': 'flex',
    'align-items': 'center',
    'gap': T.spaceLg,
  })}">\n`;

  if (linksVal) {
    const links = getArrayItems(linksVal);
    for (const link of links) {
      const linkProps = getBlockValueProps(link);
      const label = resolveString(linkProps['label'] ?? linkProps['text']);
      const url = resolveString(linkProps['url'] ?? linkProps['href']);
      html += `      <a href="${esc(url || '#')}" style="${style({
        'font-size': T.scaleBody,
        'color': textColor,
        'text-decoration': 'none',
      })}">${esc(label)}</a>\n`;
    }
  }

  if (ctaVal) {
    const ctaLabel = typeof ctaVal === 'object' && ctaVal.type === 'blockValue'
      ? resolveString(ctaVal.properties['label'])
      : resolveString(ctaVal);
    const ctaHref = typeof ctaVal === 'object' && ctaVal.type === 'blockValue'
      ? resolveString(ctaVal.properties['href'] ?? ctaVal.properties['url'] ?? { type: 'string', value: '#', source: { line: 0, column: 0 } })
      : '#';

    html += `      <a class="tela-btn tela-btn--primary" href="${esc(ctaHref)}" style="${style({
      'padding': `${T.spaceXs} ${T.spaceMd}`,
      'background': T.accentDefault,
      'color': T.textInverse,
      'font-size': T.scaleBody,
      'font-weight': '500',
      'border-radius': T.radiusMd,
      'text-decoration': 'none',
    })}">${esc(ctaLabel)}</a>\n`;
  }

  html += `    </div>\n  </div>\n</nav>`;
  return html;
}
