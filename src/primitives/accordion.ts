/**
 * accordion primitive — collapsible FAQ/content sections using <details>/<summary>.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, hasMod, spaceToken, resolveString, getArrayItems,
} from '../renderer/helpers.js';
import type { Value } from '../ast/types.js';

export function renderAccordion(ctx: RenderContext): string {
  const { section } = ctx;
  const { block } = section;
  const { properties, modifiers, children } = block;
  const sectionId = section.id;

  const padSize = getModArg(modifiers, 'pad', 'section');
  const bgToken = getModArg(modifiers, 'bg', '');
  const bgStyle = bgToken
    ? `var(--t-${bgToken.replace(/\./g, '-')})`
    : T.surfaceDefault;

  const sectionStyle = style({
    'padding': `${spaceToken(padSize)} ${T.spaceXl}`,
    'background': bgStyle,
  });

  // Gather items from properties['items'] or direct children
  const rawItems: Value[] = [];
  const propItems = getArrayItems(properties['items'] ?? properties['faq']);
  if (propItems.length > 0) {
    rawItems.push(...propItems);
  } else {
    for (const child of children) {
      if (child.type === 'array') rawItems.push(...child.items);
    }
  }

  const items: Array<{ question: string; answer: string }> = rawItems.map((item) => {
    if (item.type === 'blockValue') {
      return {
        question: resolveString(item.properties['question']) || '',
        answer: resolveString(item.properties['answer']),
      };
    }
    return { question: resolveString(item), answer: '' };
  });

  if (items.length === 0) {
    return `<section class="tela-accordion" style="${sectionStyle}"></section>`;
  }

  const summaryStyle = style({
    'padding': `${T.spaceMd} 0`,
    'cursor': 'pointer',
    'font-weight': '500',
    'font-size': T.scaleBody,
    'color': T.textPrimary,
    'display': 'flex',
    'justify-content': 'space-between',
    'align-items': 'center',
    'border-bottom': `1px solid ${T.borderDefault}`,
    'list-style': 'none',
  });

  const answerStyle = style({
    'padding': `${T.spaceMd} 0`,
    'color': T.textSecondary,
    'font-size': T.scaleBody,
    'line-height': T.leadingDefault,
    'border-bottom': `1px solid ${T.borderDefault}`,
  });

  const spanStyle = style({
    'font-size': '1.2em',
    'color': T.textCaption,
  });

  let itemsHtml = '';
  for (const item of items) {
    itemsHtml += `    <details class="tela-accordion__item">
      <summary style="${summaryStyle}">
        ${esc(item.question)} <span style="${spanStyle}">+</span>
      </summary>
      <div style="${answerStyle}">
        ${esc(item.answer)}
      </div>
    </details>\n`;
  }

  return `<section class="tela-accordion" style="${sectionStyle}">
  <div id="tela-accordion-${esc(sectionId)}" style="max-width: 720px; margin: 0 auto;">
${itemsHtml}  </div>
</section>
<style>
  #tela-accordion-${esc(sectionId)} details[open] summary span { transform: rotate(45deg); display: inline-block; }
  #tela-accordion-${esc(sectionId)} summary::-webkit-details-marker { display: none; }
  #tela-accordion-${esc(sectionId)} summary::marker { display: none; }
</style>`;
}
