/**
 * aside primitive component.
 */

import type { RenderContext } from '../renderer/types.js';
import { T, esc, style, getModArg, hasMod, spaceToken, resolveString } from '../renderer/helpers.js';

const KIND_COLORS: Record<string, { border: string; title: string; bg: string }> = {
  note: { border: T.accentDefault, title: T.accentDefault, bg: T.accentTint },
  tip: { border: T.accentDefault, title: T.accentDefault, bg: T.accentTint },
  warning: { border: '#c87a2f', title: '#c87a2f', bg: '#fff8f0' },
  danger: { border: '#c0392b', title: '#c0392b', bg: '#fff5f5' },
};

export function renderAside(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { properties, modifiers } = block;

  const title = resolveString(properties['title']);
  const body = resolveString(properties['body']);
  const kind = resolveString(properties['kind']) || 'note';

  const padSize = getModArg(modifiers, 'pad', 'md');
  const isRounded = hasMod(modifiers, 'rounded');

  const colors = KIND_COLORS[kind] ?? KIND_COLORS['note'];
  const bgToken = getModArg(modifiers, 'bg', '');
  const bgColor = bgToken ? `var(--t-${bgToken.replace(/\./g, '-')})` : colors.bg;

  const asideStyle = style({
    'padding': `${T.spaceMd} ${spaceToken(padSize)}`,
    'background': bgColor,
    'border-left': `3px solid ${colors.border}`,
    'border-radius': isRounded ? `0 ${T.radiusSm} ${T.radiusSm} 0` : '0',
    'margin': `${T.spaceLg} 0`,
  });

  const kindLabel = title || (kind.charAt(0).toUpperCase() + kind.slice(1));

  let html = `<aside class="tela-aside tela-aside--${esc(kind)}" style="${asideStyle}">\n`;

  html += `  <p class="tela-aside__title" style="${style({
    'font-size': T.scaleCaption,
    'font-weight': '600',
    'text-transform': 'uppercase',
    'letter-spacing': '0.05em',
    'color': colors.title,
    'margin': `0 0 ${T.spaceXs} 0`,
  })}">${esc(kindLabel)}</p>\n`;

  if (body) {
    html += `  <p class="tela-aside__body" style="${style({
      'font-size': T.scaleBody,
      'line-height': T.leadingDefault,
      'color': T.textPrimary,
      'margin': '0',
    })}">${esc(body)}</p>\n`;
  }

  html += `</aside>`;
  return html;
}
