/**
 * divider primitive component.
 */

import type { RenderContext } from '../renderer/types.js';
import { T, esc, style, hasMod, resolveString } from '../renderer/helpers.js';

export function renderDivider(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { properties, modifiers } = block;

  const label = resolveString(properties['label']);
  const isMuted = hasMod(modifiers, 'muted');
  const isAccent = hasMod(modifiers, 'accent');

  const lineColor = isAccent ? T.accentDefault : isMuted ? T.borderSubtle : T.borderDefault;

  if (!label) {
    return `<hr class="tela-divider" style="${style({
      'border': 'none',
      'border-top': `1px solid ${lineColor}`,
      'margin': `${T.spaceSection} auto`,
      'max-width': '1200px',
    })}">`;
  }

  const labelColor = isMuted ? T.textCaption : isAccent ? T.accentDefault : T.textCaption;

  return `<div class="tela-divider tela-divider--labeled" style="${style({
    'display': 'flex',
    'align-items': 'center',
    'gap': T.spaceMd,
    'margin': `${T.spaceSection} auto`,
    'max-width': '1200px',
  })}">
  <span style="flex: 1; height: 1px; background: ${lineColor};"></span>
  <span style="${style({
    'font-size': T.scaleCaption,
    'color': labelColor,
    'text-transform': 'uppercase',
    'letter-spacing': '0.1em',
  })}">${esc(label)}</span>
  <span style="flex: 1; height: 1px; background: ${lineColor};"></span>
</div>`;
}
