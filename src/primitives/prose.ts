/**
 * prose primitive component.
 */

import type { RenderContext } from '../renderer/types.js';
import { T, esc, style, getModArg, hasMod, spaceToken, resolveString } from '../renderer/helpers.js';

export function renderProse(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { properties, modifiers } = block;

  const title = resolveString(properties['title']);
  const lead = resolveString(properties['lead']);
  const bodyVal = properties['body'];

  const isCentered = hasMod(modifiers, 'centered');
  const isMuted = hasMod(modifiers, 'muted');
  const padSize = getModArg(modifiers, 'pad', 'section');

  const textAlign = isCentered ? 'center' : 'left';
  const textColor = isMuted ? T.textSecondary : T.textPrimary;

  const sectionStyle = style({
    'padding': `${spaceToken(padSize)} ${T.spaceXl}`,
    'max-width': '720px',
    'margin': '0 auto',
    'text-align': textAlign,
  });

  let html = `<section class="tela-prose" style="${sectionStyle}">\n`;

  if (title) {
    html += `  <h2 class="tela-prose__title" style="${style({
      'font-family': T.familySerif,
      'font-size': T.scaleH2,
      'font-weight': T.weightHeading,
      'line-height': T.leadingTight,
      'color': T.textPrimary,
      'margin': `0 0 ${T.spaceMd} 0`,
    })}">${esc(title)}</h2>\n`;
  }

  if (lead) {
    html += `  <p class="tela-prose__lead" style="${style({
      'font-size': T.scaleLead,
      'line-height': T.leadingDefault,
      'color': T.textSecondary,
      'margin': `0 0 ${T.spaceLg} 0`,
    })}">${esc(lead)}</p>\n`;
  }

  if (bodyVal) {
    const bodyText = resolveString(bodyVal);
    // Split into paragraphs
    const paragraphs = bodyText.split(/\n{2,}/);
    const paragraphHtml = paragraphs
      .map((p) => `    <p style="margin: 0 0 ${T.spaceMd} 0;">${esc(p.trim())}</p>`)
      .join('\n');

    html += `  <div class="tela-prose__body" style="${style({
      'font-size': T.scaleBody,
      'line-height': T.leadingLoose,
      'color': textColor,
    })}">\n${paragraphHtml}\n  </div>\n`;
  }

  html += `</section>`;
  return html;
}
