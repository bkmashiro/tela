/**
 * hero primitive component.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, hasMod, spaceToken, shadowToken,
  resolveString, getBlockValueProps, getArrayItems
} from '../renderer/helpers.js';
import type { Value } from '../ast/types.js';
import { renderCtaGroup } from './shared.js';

export function renderHero(ctx: RenderContext): string {
  const { section } = ctx;
  const { block } = section;
  const { properties, modifiers } = block;

  const isSplit = modifiers.some((m) => m.name === 'split');
  const padSize = getModArg(modifiers, 'pad', 'xl');
  const isCentered = hasMod(modifiers, 'centered');
  const isInverted = hasMod(modifiers, 'inverted');

  // Background
  const bgToken = getModArg(modifiers, 'bg', '');
  const bgStyle = bgToken ? `var(--t-${bgToken.replace(/\./g, '-')})` : T.surfaceDefault;
  const textColor = isInverted ? T.textInverse : T.textPrimary;

  const padValue = spaceToken(padSize);
  const sectionStyle = style({
    'padding': `${padValue} var(--t-space-xl)`,
    'background': bgStyle,
  });

  if (isSplit) {
    return renderSplitHero(ctx, padValue, textColor, isInverted);
  }

  // Stacked hero (default)
  const textAlign = isCentered ? 'center' : 'left';
  const maxWidth = isCentered ? '720px' : '800px';

  // Support either direct props or left/right sub-blocks
  const eyebrow = resolveString(properties['eyebrow']);
  const headline = resolveString(properties['headline']);
  const body = resolveString(properties['body']);
  const cta = properties['cta'];

  const headlineLength = headline.length;
  const headlineScale = headlineLength > 60 ? T.scaleH1 : T.scaleDisplay;

  const innerStyle = style({
    'max-width': maxWidth,
    'margin': '0 auto',
    'text-align': textAlign,
  });

  let html = `<section class="tela-hero" style="${sectionStyle}">\n`;
  html += `  <div class="tela-hero__inner" style="${innerStyle}">\n`;

  if (eyebrow) {
    html += `    <p class="tela-eyebrow" style="${style({
      'font-size': T.scaleCaption,
      'font-weight': '500',
      'letter-spacing': '0.05em',
      'text-transform': 'uppercase',
      'color': T.textCaption,
      'margin-bottom': T.spaceSm,
    })}">${esc(eyebrow)}</p>\n`;
  }

  if (headline) {
    html += `    <h1 class="tela-headline" style="${style({
      'font-family': T.familySerif,
      'font-size': headlineScale,
      'font-weight': T.weightHeading,
      'line-height': T.leadingTight,
      'color': textColor,
      'margin': `0 0 ${T.spaceMd} 0`,
    })}">${esc(headline).replace(/\n/g, '<br>')}</h1>\n`;
  }

  if (body) {
    html += `    <p class="tela-body" style="${style({
      'font-size': T.scaleLead,
      'line-height': T.leadingDefault,
      'color': T.textSecondary,
      'margin': `0 0 ${T.spaceLg} 0`,
      'max-width': '520px',
      ...(isCentered ? { 'margin-left': 'auto', 'margin-right': 'auto' } : {}),
    })}">${esc(body)}</p>\n`;
  }

  if (cta) {
    html += renderCtaGroup(cta, isInverted, isCentered);
  }

  html += `  </div>\n</section>`;
  return html;
}

function renderSplitHero(
  ctx: RenderContext,
  padValue: string,
  textColor: string,
  isInverted: boolean
): string {
  const { section } = ctx;
  const { block } = section;
  const { properties, modifiers } = block;

  // Get split ratio
  const splitMod = modifiers.find((m) => m.name === 'split');
  const leftFr = splitMod?.args[0] ?? 60;
  const rightFr = splitMod?.args[1] ?? 40;

  const bgToken = getModArg(modifiers, 'bg', '');
  const bgStyle = bgToken ? `var(--t-${bgToken.replace(/\./g, '-')})` : T.surfaceDefault;

  const sectionStyle = style({
    'padding': `${padValue} var(--t-space-xl)`,
    'background': bgStyle,
  });

  const innerStyle = style({
    'display': 'grid',
    'grid-template-columns': `${leftFr}fr ${rightFr}fr`,
    'gap': T.spaceXl,
    'max-width': '1200px',
    'margin': '0 auto',
    'align-items': 'center',
  });

  // Get left/right sub-blocks or fall back to top-level props
  const leftProps = getBlockValueProps(properties['left']);
  const rightProps = getBlockValueProps(properties['right']);

  const eyebrow = resolveString(leftProps['eyebrow'] ?? properties['eyebrow']);
  const headline = resolveString(leftProps['headline'] ?? properties['headline']);
  const body = resolveString(leftProps['body'] ?? properties['body']);
  const cta = leftProps['cta'] ?? properties['cta'];

  const headlineLength = headline.length;
  const headlineScale = headlineLength > 60 ? T.scaleH1 : T.scaleDisplay;

  let leftHtml = '';

  if (eyebrow) {
    leftHtml += `      <p class="tela-eyebrow" style="${style({
      'font-size': T.scaleCaption,
      'font-weight': '500',
      'letter-spacing': '0.05em',
      'text-transform': 'uppercase',
      'color': T.textCaption,
      'margin-bottom': T.spaceSm,
    })}">${esc(eyebrow)}</p>\n`;
  }

  if (headline) {
    leftHtml += `      <h1 class="tela-headline" style="${style({
      'font-family': T.familySerif,
      'font-size': headlineScale,
      'font-weight': T.weightHeading,
      'line-height': T.leadingTight,
      'color': textColor,
      'margin': `0 0 ${T.spaceMd} 0`,
    })}">${esc(headline).replace(/\n/g, '<br>')}</h1>\n`;
  }

  if (body) {
    leftHtml += `      <p class="tela-body" style="${style({
      'font-size': T.scaleLead,
      'line-height': T.leadingDefault,
      'color': T.textSecondary,
      'margin': `0 0 ${T.spaceLg} 0`,
      'max-width': '520px',
    })}">${esc(body)}</p>\n`;
  }

  if (cta) {
    leftHtml += '    ' + renderCtaGroup(cta, isInverted) + '\n';
  }

  // Right side — figure
  let rightHtml = '';
  const figureVal = rightProps['figure'] ?? properties['figure'];
  if (figureVal) {
    const figSrc = resolveString(figureVal.type === 'modified' ? figureVal.base : figureVal);
    const figMods = figureVal.type === 'modified' ? figureVal.modifiers : [];
    const aspectMod = figMods.find((m) => m.name === 'aspect');
    const aspectRatio = aspectMod
      ? `${aspectMod.args[0]}/${aspectMod.args[1]}`
      : '4/3';
    const isRounded = figMods.some((m) => m.name === 'rounded');
    const shadowArg = figMods.find((m) => m.name === 'shadow')?.args[0];
    const shadow = shadowArg ? shadowToken(String(shadowArg)) : 'none';

    // Render as background-image div for reliable aspect-ratio sizing
    rightHtml += `      <div class="tela-figure" style="${style({
      'width': '100%',
      'aspect-ratio': aspectRatio,
      'background-image': `url('${figSrc}')`,
      'background-size': 'cover',
      'background-position': 'center',
      'border-radius': isRounded ? T.radiusLg : '0',
      'box-shadow': shadow,
    })}"></div>\n`;
  }

  return `<section class="tela-hero tela-hero--split-${leftFr}-${rightFr}" style="${sectionStyle}">
  <div class="tela-hero__inner" style="${innerStyle}">
    <div class="tela-hero__left">
${leftHtml}    </div>
    <div class="tela-hero__right">
${rightHtml}    </div>
  </div>
</section>`;
}
