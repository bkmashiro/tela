/**
 * toggle primitive — a styled checkbox toggle switch.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, hasMod, spaceToken,
} from '../renderer/helpers.js';

export function renderToggle(ctx: RenderContext): string {
  const { section } = ctx;
  const { block } = section;
  const { modifiers } = block;
  const sectionId = section.id;

  const padSize = getModArg(modifiers, 'pad', 'section');
  const label = getModArg(modifiers, 'label', '');
  const isCentered = hasMod(modifiers, 'centered');
  const bgToken = getModArg(modifiers, 'bg', '');
  const bgStyle = bgToken
    ? `var(--t-${bgToken.replace(/\./g, '-')})`
    : T.surfaceDefault;

  const sectionStyle = style({
    'padding': `${spaceToken(padSize)} ${T.spaceXl}`,
    'background': bgStyle,
  });

  const wrapperStyle = style({
    'display': 'flex',
    'align-items': 'center',
    'gap': T.spaceMd,
    ...(isCentered ? { 'justify-content': 'center' } : {}),
  });

  const labelStyle = style({
    'display': 'flex',
    'align-items': 'center',
    'gap': T.spaceSm,
    'cursor': 'pointer',
    'user-select': 'none',
  });

  const inputStyle = style({
    'position': 'absolute',
    'opacity': '0',
    'width': '0',
    'height': '0',
  });

  const textStyle = style({
    'font-size': T.scaleBody,
    'color': T.textPrimary,
  });

  return `<section class="tela-toggle-section" style="${sectionStyle}">
  <div id="tela-toggle-${esc(sectionId)}" style="${wrapperStyle}">
    <label style="${labelStyle}">
      <input type="checkbox" id="tela-toggle-input-${esc(sectionId)}" style="${inputStyle}">
      <span class="tela-toggle__track"></span>
      ${label ? `<span style="${textStyle}">${esc(label)}</span>` : ''}
    </label>
  </div>
</section>
<style>
  #tela-toggle-${esc(sectionId)} .tela-toggle__track { width: 42px; height: 24px; background: ${T.borderDefault}; border-radius: 12px; position: relative; transition: background 0.2s; display: inline-block; }
  #tela-toggle-${esc(sectionId)} .tela-toggle__track::after { content: ''; position: absolute; width: 18px; height: 18px; background: white; border-radius: 50%; top: 3px; left: 3px; transition: transform 0.2s; }
  #tela-toggle-input-${esc(sectionId)}:checked + .tela-toggle__track { background: ${T.accentDefault}; }
  #tela-toggle-input-${esc(sectionId)}:checked + .tela-toggle__track::after { transform: translateX(18px); }
</style>
<script>
(function(){
  var input = document.getElementById('tela-toggle-input-${esc(sectionId)}');
  if (!input) return;
  input.addEventListener('change', function() {
    document.body.setAttribute('data-theme', this.checked ? 'dark' : '');
  });
})();
</script>`;
}
