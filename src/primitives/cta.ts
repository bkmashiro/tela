/**
 * cta primitive component.
 */

import type { RenderContext } from '../renderer/types.js';
import { T, esc, style, getModArg, hasMod, spaceToken, resolveString, getArrayItems } from '../renderer/helpers.js';
import { renderCtaGroup } from './shared.js';

export function renderCta(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { properties, modifiers } = block;

  const headline = resolveString(properties['headline']);
  const body = resolveString(properties['body']);
  const actions = properties['actions'] ?? properties['cta'];

  const isCentered = hasMod(modifiers, 'centered') || true; // CTA is always centered by design
  const isInverted = hasMod(modifiers, 'inverted');
  const isAccent = hasMod(modifiers, 'accent');
  const padSize = getModArg(modifiers, 'pad', 'section');

  // Background and text colors
  let bgColor: string;
  let headlineColor: string;
  let bodyColor: string;

  if (isAccent || (!isInverted && !hasMod(modifiers, 'bg'))) {
    // Default CTA: accent background
    bgColor = T.accentDefault;
    headlineColor = T.textInverse;
    bodyColor = T.textInverse;
  } else if (isInverted) {
    bgColor = T.surfaceInverted;
    headlineColor = T.textInverse;
    bodyColor = T.textInverse;
  } else {
    const bgToken = getModArg(modifiers, 'bg', '');
    bgColor = bgToken ? `var(--t-${bgToken.replace(/\./g, '-')})` : T.accentDefault;
    headlineColor = T.textInverse;
    bodyColor = T.textInverse;
  }

  const sectionStyle = style({
    'padding': `${spaceToken(padSize)} ${T.spaceXl}`,
    'background': bgColor,
    'text-align': 'center',
  });

  const innerStyle = style({
    'max-width': '640px',
    'margin': '0 auto',
  });

  let html = `<section class="tela-cta" style="${sectionStyle}">\n`;
  html += `  <div class="tela-cta__inner" style="${innerStyle}">\n`;

  if (headline) {
    html += `    <h2 class="tela-cta__headline" style="${style({
      'font-family': T.familySerif,
      'font-size': T.scaleH1,
      'font-weight': T.weightHeading,
      'line-height': T.leadingTight,
      'color': headlineColor,
      'margin': `0 0 ${T.spaceSm} 0`,
    })}">${esc(headline)}</h2>\n`;
  }

  if (body) {
    html += `    <p class="tela-cta__body" style="${style({
      'font-size': T.scaleLead,
      'line-height': T.leadingDefault,
      'color': bodyColor,
      'opacity': '0.85',
      'margin': `0 0 ${T.spaceLg} 0`,
    })}">${esc(body)}</p>\n`;
  }

  if (actions) {
    const ctaGroupStyle = style({
      'display': 'flex',
      'gap': T.spaceSm,
      'justify-content': 'center',
      'flex-wrap': 'wrap',
    });
    html += `    <div class="tela-cta__actions" style="${ctaGroupStyle}">\n`;
    const items = getArrayItems(actions);
    for (const item of items) {
      // Render as inverted button (light button on dark background)
      let label = '';
      let role = 'primary';
      let href = '#';

      if (item.type === 'blockValue') {
        label = resolveString(item.properties['label']);
        const rv = item.properties['role'];
        if (rv) role = resolveString(rv);
      } else {
        label = resolveString(item);
      }

      const btnStyle = style({
        'padding': `${T.spaceSm} ${T.spaceXl}`,
        'background': T.surfaceDefault,
        'color': T.accentDefault,
        'font-size': T.scaleBody,
        'font-weight': '500',
        'border-radius': T.radiusMd,
        'text-decoration': 'none',
        'display': 'inline-flex',
        'align-items': 'center',
      });

      html += `      <a class="tela-btn tela-btn--${esc(role)} tela-btn--inverted" href="${esc(href)}" style="${btnStyle}">${esc(label)}</a>\n`;
    }
    html += `    </div>\n`;
  }

  html += `  </div>\n</section>`;
  return html;
}
