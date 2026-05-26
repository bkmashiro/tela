/**
 * tabs primitive — interactive tabbed content sections.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, hasMod, spaceToken, resolveString, getArrayItems,
} from '../renderer/helpers.js';
import type { Value } from '../ast/types.js';

export function renderTabs(ctx: RenderContext): string {
  const { section } = ctx;
  const { block } = section;
  const { properties, modifiers, children } = block;
  const sectionId = section.id;

  const padSize = getModArg(modifiers, 'pad', 'section');
  const isInverted = hasMod(modifiers, 'inverted');
  const bgToken = getModArg(modifiers, 'bg', '');
  const bgStyle = bgToken
    ? `var(--t-${bgToken.replace(/\./g, '-')})`
    : (isInverted ? T.surfaceInverted : T.surfaceDefault);

  const sectionStyle = style({
    'padding': `${spaceToken(padSize)} ${T.spaceXl}`,
    'background': bgStyle,
  });

  // Gather tab items — from properties['items']/['tabs'] or from block.children
  const rawItems: Value[] = [];
  const propItems = getArrayItems(properties['items'] ?? properties['tabs']);
  if (propItems.length > 0) {
    rawItems.push(...propItems);
  } else {
    for (const child of children) {
      if (child.type === 'array') rawItems.push(...child.items);
    }
  }

  const items: Array<{ title: string; body: string }> = rawItems.map((item) => {
    if (item.type === 'blockValue') {
      return {
        title: resolveString(item.properties['title']) || 'Tab',
        body: resolveString(item.properties['body']),
      };
    }
    return { title: resolveString(item), body: '' };
  });

  if (items.length === 0) {
    return `<section class="tela-tabs" style="${sectionStyle}"></section>`;
  }

  const textColor = isInverted ? T.textInverse : T.textPrimary;

  // Build tab buttons
  let tabBarHtml = '';
  for (let i = 0; i < items.length; i++) {
    const isActive = i === 0;
    tabBarHtml += `      <button role="tab" aria-selected="${isActive ? 'true' : 'false'}" data-idx="${i}">${esc(items[i].title)}</button>\n`;
  }

  // Build tab panels
  let panelsHtml = '';
  for (let i = 0; i < items.length; i++) {
    const isActive = i === 0;
    const panelStyle = style({
      'color': textColor,
      'font-size': T.scaleBody,
      'line-height': T.leadingDefault,
      ...(isActive ? {} : { 'display': 'none' }),
    });
    panelsHtml += `    <div role="tabpanel" data-idx="${i}" style="${panelStyle}">${esc(items[i].body)}</div>\n`;
  }

  const barStyle = style({
    'display': 'flex',
    'gap': '0',
    'border-bottom': `1px solid ${T.borderDefault}`,
    'margin-bottom': T.spaceLg,
  });

  const innerStyle = style({
    'max-width': '900px',
    'margin': '0 auto',
  });

  return `<section id="tela-tabs-${esc(sectionId)}" class="tela-tabs" style="${sectionStyle}">
  <div class="tela-tabs__inner" style="${innerStyle}">
    <div class="tela-tabs__bar" role="tablist" style="${barStyle}">
${tabBarHtml}    </div>
${panelsHtml}  </div>
</section>
<style>
  #tela-tabs-${esc(sectionId)} [role="tab"] { background: none; border: none; padding: 8px 16px; cursor: pointer; font-size: inherit; color: ${T.textSecondary}; border-bottom: 2px solid transparent; margin-bottom: -1px; }
  #tela-tabs-${esc(sectionId)} [role="tab"][aria-selected="true"] { color: ${T.accentDefault}; border-bottom-color: ${T.accentDefault}; }
  #tela-tabs-${esc(sectionId)} [role="tab"]:hover { color: ${T.textPrimary}; }
</style>
<script>
(function(){
  var c = document.getElementById('tela-tabs-${esc(sectionId)}');
  if (!c) return;
  var tabs = c.querySelectorAll('[role="tab"]');
  var panels = c.querySelectorAll('[role="tabpanel"]');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var idx = this.getAttribute('data-idx');
      tabs.forEach(function(t) { t.setAttribute('aria-selected','false'); });
      panels.forEach(function(p) { p.style.display='none'; });
      this.setAttribute('aria-selected','true');
      c.querySelector('[role="tabpanel"][data-idx="'+idx+'"]').style.display='';
    });
  });
})();
</script>`;
}
