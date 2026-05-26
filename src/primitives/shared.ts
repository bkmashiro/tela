/**
 * Shared rendering utilities used across multiple primitives.
 */

import type { Value } from '../ast/types.js';
import { T, esc, style, resolveString, getBlockValueProps, getArrayItems } from '../renderer/helpers.js';

/**
 * Render a group of CTA buttons.
 * @param cta - The value containing button definitions (array of blockValues)
 * @param inverted - Whether to use inverted colors (light buttons on dark bg)
 */
export function renderCtaGroup(cta: Value, inverted: boolean = false): string {
  const items = getArrayItems(cta);
  if (items.length === 0) return '';

  let buttonsHtml = '';
  for (const item of items) {
    buttonsHtml += renderCtaButton(item, inverted);
  }

  return `<div class="tela-cta-group" style="${style({
    'display': 'flex',
    'gap': T.spaceSm,
    'flex-wrap': 'wrap',
    'align-items': 'center',
  })}">
${buttonsHtml}    </div>`;
}

function renderCtaButton(item: Value, inverted: boolean): string {
  let label = '';
  let role = 'primary';
  let href = '#';

  if (item.type === 'blockValue') {
    label = resolveString(item.properties['label']);
    const roleVal = item.properties['role'];
    if (roleVal) role = resolveString(roleVal);
    const hrefVal = item.properties['href'] ?? item.properties['url'];
    if (hrefVal) href = resolveString(hrefVal);
  } else if (item.type === 'modified') {
    label = resolveString(item.base);
    const roleMod = item.modifiers.find((m) => m.name === 'role');
    if (roleMod?.args[0]) role = String(roleMod.args[0]);
  } else {
    label = resolveString(item);
  }

  let btnStyle: Record<string, string>;
  if (role === 'primary') {
    btnStyle = {
      'display': 'inline-flex',
      'align-items': 'center',
      'padding': `${T.spaceSm} ${T.spaceLg}`,
      'background': inverted ? T.surfaceDefault : T.accentDefault,
      'color': inverted ? T.accentDefault : T.textInverse,
      'font-size': T.scaleBody,
      'font-weight': '500',
      'border-radius': T.radiusMd,
      'text-decoration': 'none',
      'border': 'none',
      'cursor': 'pointer',
    };
  } else if (role === 'ghost') {
    btnStyle = {
      'display': 'inline-flex',
      'align-items': 'center',
      'padding': `${T.spaceSm} ${T.spaceLg}`,
      'background': 'transparent',
      'color': inverted ? T.textInverse : T.textPrimary,
      'font-size': T.scaleBody,
      'font-weight': '500',
      'border': `1px solid ${inverted ? 'rgba(255,255,255,0.3)' : T.borderDefault}`,
      'border-radius': T.radiusMd,
      'text-decoration': 'none',
      'cursor': 'pointer',
    };
  } else if (role === 'danger') {
    btnStyle = {
      'display': 'inline-flex',
      'align-items': 'center',
      'padding': `${T.spaceSm} ${T.spaceLg}`,
      'background': '#c0392b',
      'color': '#ffffff',
      'font-size': T.scaleBody,
      'font-weight': '500',
      'border-radius': T.radiusMd,
      'text-decoration': 'none',
      'cursor': 'pointer',
    };
  } else {
    // default primary
    btnStyle = {
      'display': 'inline-flex',
      'align-items': 'center',
      'padding': `${T.spaceSm} ${T.spaceLg}`,
      'background': T.accentDefault,
      'color': T.textInverse,
      'font-size': T.scaleBody,
      'font-weight': '500',
      'border-radius': T.radiusMd,
      'text-decoration': 'none',
    };
  }

  return `      <a class="tela-btn tela-btn--${esc(role)}" href="${esc(href)}" style="${style(btnStyle)}">${esc(label)}</a>\n`;
}
