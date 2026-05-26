/**
 * steps primitive — ordered process steps or dated timeline.
 * Use `dated` modifier for timeline mode (shows date labels).
 */

import type { RenderContext } from '../renderer/types.js';
import { T, esc, style, getModArg, resolveString, getArrayItems, spaceToken } from '../renderer/helpers.js';

export function renderSteps(ctx: RenderContext): string {
  const { section } = ctx;
  const { block } = section;
  const { properties, modifiers } = block;

  const padSize = getModArg(modifiers, 'pad', 'section');
  const bgToken = getModArg(modifiers, 'bg', '');
  const bgStyle = bgToken ? `var(--t-${bgToken.replace(/\./g, '-')})` : T.surfaceDefault;
  const dated = modifiers.some(m => m.name === 'dated');

  const sectionStyle = style({
    'padding': `${spaceToken(padSize)} ${T.spaceXl}`,
    'background': bgStyle,
  });

  const title = resolveString(properties['title']);
  const titleStyle = style({
    'font-family': T.familySerif,
    'font-size': T.scaleH3,
    'font-weight': T.weightHeading,
    'color': T.textPrimary,
    'margin': `0 0 ${T.spaceLg} 0`,
  });

  const itemsVal = properties['items'] ?? properties['steps'];
  const items = getArrayItems(itemsVal);

  const containerStyle = style({
    'max-width': '720px',
    'margin': '0 auto',
    'display': 'flex',
    'flex-direction': 'column',
    'gap': T.spaceLg,
  });

  let html = `<section class="tela-steps" style="${sectionStyle}">\n`;
  html += `  <div style="${containerStyle}">\n`;

  if (title) {
    html += `    <h3 style="${titleStyle}">${esc(title)}</h3>\n`;
  }

  items.forEach((item, i) => {
    if (item.type !== 'blockValue') return;
    const stepTitle = resolveString(item.properties['title']);
    const stepBody = resolveString(item.properties['body']);
    const dateLabel = resolveString(item.properties['date']);
    const stepNum = String(i + 1);

    const rowStyle = style({
      'display': 'flex',
      'gap': T.spaceMd,
      'align-items': 'flex-start',
    });

    // Left column: number badge or date label
    const badgeStyle = style({
      'flex-shrink': '0',
      'width': dated ? 'auto' : '28px',
      'min-width': dated ? '80px' : '28px',
      'height': dated ? 'auto' : '28px',
      'border-radius': dated ? T.radiusSm : T.radiusPill,
      'background': dated ? 'transparent' : T.accentDefault,
      'color': dated ? T.textSecondary : '#ffffff',
      'font-size': T.scaleCaption,
      'font-weight': T.weightEmphasis,
      'display': 'flex',
      'align-items': 'center',
      'justify-content': dated ? 'flex-start' : 'center',
      'padding-top': dated ? '2px' : '0',
      'font-family': T.familySans,
      'text-transform': dated ? 'uppercase' : 'none',
      'letter-spacing': dated ? '0.04em' : 'normal',
      'white-space': 'nowrap',
    });

    const contentStyle = style({
      'flex': '1',
      'padding-bottom': T.spaceMd,
      'border-bottom': i < items.length - 1 ? `1px solid ${T.borderSubtle}` : 'none',
    });

    const stepTitleStyle = style({
      'font-family': T.familySans,
      'font-size': T.scaleH3,
      'font-weight': T.weightHeading,
      'color': T.textPrimary,
      'margin': `0 0 ${T.spaceSm} 0`,
      'line-height': T.leadingTight,
    });

    const stepBodyStyle = style({
      'font-family': T.familySans,
      'font-size': T.scaleBody,
      'color': T.textSecondary,
      'margin': '0',
      'line-height': T.leadingDefault,
    });

    html += `    <div style="${rowStyle}">\n`;
    html += `      <div style="${badgeStyle}">${esc(dated ? (dateLabel || stepNum) : stepNum)}</div>\n`;
    html += `      <div style="${contentStyle}">\n`;
    if (stepTitle) html += `        <h4 style="${stepTitleStyle}">${esc(stepTitle)}</h4>\n`;
    if (stepBody) html += `        <p style="${stepBodyStyle}">${esc(stepBody)}</p>\n`;
    html += `      </div>\n    </div>\n`;
  });

  html += `  </div>\n</section>`;
  return html;
}
