/**
 * modal primitive — dialog overlay triggered by a button.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, hasMod, spaceToken, resolveString, getArrayItems,
} from '../renderer/helpers.js';

export function renderModal(ctx: RenderContext): string {
  const { section } = ctx;
  const { block } = section;
  const { properties, modifiers } = block;
  const sectionId = section.id;

  const padSize = getModArg(modifiers, 'pad', 'section');
  const triggerLabel = getModArg(modifiers, 'trigger', 'Open');
  const bgToken = getModArg(modifiers, 'bg', '');
  const bgStyle = bgToken
    ? `var(--t-${bgToken.replace(/\./g, '-')})`
    : T.surfaceDefault;

  const sectionStyle = style({
    'padding': `${spaceToken(padSize)} ${T.spaceXl}`,
    'background': bgStyle,
  });

  const headline = resolveString(properties['headline']);
  const body = resolveString(properties['body']);
  const ctaVal = properties['cta'];

  // Build trigger button style (primary)
  const triggerBtnStyle = style({
    'display': 'inline-flex',
    'align-items': 'center',
    'padding': `${T.spaceSm} ${T.spaceLg}`,
    'background': T.accentDefault,
    'color': T.textInverse,
    'font-size': T.scaleBody,
    'font-weight': '500',
    'border-radius': T.radiusMd,
    'border': 'none',
    'cursor': 'pointer',
  });

  const closeBtnStyle = style({
    'position': 'absolute',
    'top': '12px',
    'right': '16px',
    'background': 'none',
    'border': 'none',
    'font-size': '1.5rem',
    'cursor': 'pointer',
    'color': T.textCaption,
    'line-height': '1',
  });

  const headlineStyle = style({
    'font-size': T.scaleH2,
    'font-weight': T.weightHeading,
    'color': T.textPrimary,
    'margin-bottom': T.spaceMd,
  });

  const bodyStyle = style({
    'font-size': T.scaleBody,
    'color': T.textSecondary,
    'line-height': T.leadingDefault,
    'margin-bottom': T.spaceLg,
  });

  const dialogStyle = style({
    'border': 'none',
    'border-radius': T.radiusLg,
    'padding': T.spaceXl,
    'max-width': '540px',
    'width': '90%',
    'box-shadow': '0 20px 60px rgba(0,0,0,0.3)',
    'position': 'relative',
  });

  // Build CTA buttons inside the dialog
  let ctaHtml = '';
  if (ctaVal) {
    const items = getArrayItems(ctaVal);
    const ctaGroupStyle = style({
      'display': 'flex',
      'gap': T.spaceSm,
      'flex-wrap': 'wrap',
    });
    let buttonsHtml = '';
    for (const item of items) {
      let label = '';
      let role = 'primary';
      if (item.type === 'blockValue') {
        label = resolveString(item.properties['label']);
        if (item.properties['role']) role = resolveString(item.properties['role']);
      } else if (item.type === 'modified') {
        label = resolveString(item.base);
        const roleMod = item.modifiers.find((m) => m.name === 'role');
        if (roleMod?.args[0]) role = String(roleMod.args[0]);
      } else {
        label = resolveString(item);
      }

      let btnStyle: Record<string, string>;
      if (role === 'ghost') {
        btnStyle = {
          'display': 'inline-flex',
          'align-items': 'center',
          'padding': `${T.spaceSm} ${T.spaceLg}`,
          'background': 'transparent',
          'color': T.textPrimary,
          'font-size': T.scaleBody,
          'font-weight': '500',
          'border': `1px solid ${T.borderDefault}`,
          'border-radius': T.radiusMd,
          'cursor': 'pointer',
        };
      } else {
        btnStyle = {
          'display': 'inline-flex',
          'align-items': 'center',
          'padding': `${T.spaceSm} ${T.spaceLg}`,
          'background': T.accentDefault,
          'color': T.textInverse,
          'font-size': T.scaleBody,
          'font-weight': '500',
          'border-radius': T.radiusMd,
          'border': 'none',
          'cursor': 'pointer',
        };
      }
      buttonsHtml += `      <button class="tela-btn tela-btn--${esc(role)}" style="${style(btnStyle)}">${esc(label)}</button>\n`;
    }
    if (buttonsHtml) {
      ctaHtml = `    <div style="${ctaGroupStyle}">\n${buttonsHtml}    </div>\n`;
    }
  }

  return `<section class="tela-modal" style="${sectionStyle}">
  <div style="text-align: center;">
    <button onclick="document.getElementById('tela-dialog-${esc(sectionId)}').showModal()" style="${triggerBtnStyle}">${esc(triggerLabel)}</button>
  </div>
  <dialog id="tela-dialog-${esc(sectionId)}" style="${dialogStyle}">
    <button onclick="this.closest('dialog').close()" style="${closeBtnStyle}">&times;</button>
    ${headline ? `<h2 style="${headlineStyle}">${esc(headline)}</h2>` : ''}
    ${body ? `<p style="${bodyStyle}">${esc(body)}</p>` : ''}
${ctaHtml}  </dialog>
</section>
<style>
  #tela-dialog-${esc(sectionId)}::backdrop { background: rgba(0,0,0,0.5); }
</style>
<script>
(function(){
  var d = document.getElementById('tela-dialog-${esc(sectionId)}');
  if (d) d.addEventListener('click', function(e){ if(e.target===d) d.close(); });
})();
</script>`;
}
