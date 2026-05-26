/**
 * footer primitive component.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, hasMod, spaceToken, resolveString,
  getArrayItems, getBlockValueProps
} from '../renderer/helpers.js';
import type { Value } from '../ast/types.js';

export function renderFooter(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { properties, modifiers } = block;

  const copyright = resolveString(properties['copyright']);
  const columnsVal = properties['columns'];
  const socialVal = properties['social'];

  const padSize = getModArg(modifiers, 'pad', 'section');
  const isInverted = !hasMod(modifiers, 'bg'); // Footer is inverted by default
  const bgToken = getModArg(modifiers, 'bg', '');

  const bgColor = bgToken
    ? `var(--t-${bgToken.replace(/\./g, '-')})`
    : T.surfaceInverted;
  const textColor = bgToken ? T.textPrimary : T.textInverse;

  const footerStyle = style({
    'padding': `${spaceToken(padSize)} ${T.spaceXl} ${T.spaceXl}`,
    'background': bgColor,
    'color': textColor,
  });

  const innerStyle = style({
    'max-width': '1200px',
    'margin': '0 auto',
  });

  let html = `<footer class="tela-footer" style="${footerStyle}">\n`;
  html += `  <div class="tela-footer__inner" style="${innerStyle}">\n`;

  // Columns
  if (columnsVal) {
    const columns = getArrayItems(columnsVal);
    const colCount = Math.min(columns.length, 4);
    const gridStyle = style({
      'display': 'grid',
      'grid-template-columns': colCount > 0 ? `repeat(${colCount}, 1fr)` : '1fr',
      'gap': T.spaceXl,
      'margin-bottom': T.spaceXl,
    });

    html += `    <div style="${gridStyle}">\n`;
    for (const col of columns) {
      html += renderFooterColumn(col, textColor);
    }
    html += `    </div>\n`;
  }

  // Social links
  if (socialVal) {
    const links = getArrayItems(socialVal);
    if (links.length > 0) {
      html += `    <div class="tela-footer__social" style="${style({
        'display': 'flex',
        'gap': T.spaceMd,
        'margin-bottom': T.spaceLg,
      })}">\n`;
      for (const link of links) {
        const props = getBlockValueProps(link);
        const icon = resolveString(props['icon']);
        const url = resolveString(props['url'] ?? props['href']);
        html += `      <a href="${esc(url)}" style="${style({
          'font-size': T.scaleLead,
          'color': textColor,
          'text-decoration': 'none',
          'opacity': '0.7',
        })}">${esc(icon)}</a>\n`;
      }
      html += `    </div>\n`;
    }
  }

  // Bottom bar with copyright
  if (copyright) {
    html += `    <div class="tela-footer__bottom" style="${style({
      'padding-top': T.spaceLg,
      'border-top': `1px solid rgba(255,255,255,0.1)`,
      'font-size': T.scaleCaption,
      'color': textColor,
      'opacity': '0.5',
    })}">${esc(copyright)}</div>\n`;
  }

  html += `  </div>\n</footer>`;
  return html;
}

function renderFooterColumn(col: Value, textColor: string): string {
  const props = getBlockValueProps(col);
  const title = resolveString(props['title']);
  const linksVal = props['links'];
  const links = linksVal ? getArrayItems(linksVal) : [];

  let html = `      <div class="tela-footer__col">\n`;

  if (title) {
    html += `        <h4 style="${style({
      'font-size': T.scaleCaption,
      'font-weight': '600',
      'text-transform': 'uppercase',
      'letter-spacing': '0.05em',
      'color': textColor,
      'opacity': '0.6',
      'margin': `0 0 ${T.spaceSm} 0`,
    })}">${esc(title)}</h4>\n`;
  }

  if (links.length > 0) {
    html += `        <ul style="list-style: none; margin: 0; padding: 0;">\n`;
    for (const link of links) {
      const linkProps = getBlockValueProps(link);
      const label = resolveString(linkProps['label'] ?? linkProps['text']);
      const url = resolveString(linkProps['url'] ?? linkProps['href']);
      html += `          <li style="margin-bottom: ${T.spaceXs};">`;
      html += `<a href="${esc(url || '#')}" style="${style({
        'font-size': T.scaleBody,
        'color': textColor,
        'opacity': '0.75',
        'text-decoration': 'none',
      })}">${esc(label)}</a></li>\n`;
    }
    html += `        </ul>\n`;
  }

  html += `      </div>\n`;
  return html;
}
