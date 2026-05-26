/**
 * comparison primitive — side-by-side plan/edition comparison table.
 *
 * Usage:
 *   comparison | pad(xl):
 *     highlight: 2
 *     columns:
 *       - name: Starter
 *         price: Free
 *         cta: Get started | role(ghost)
 *       - name: Pro
 *         price: $29/mo
 *         badge: Most Popular
 *         cta: Try free | role(primary)
 *       - name: Enterprise
 *         price: Custom
 *         cta: Contact us | role(ghost)
 *     rows:
 *       - feature: Storage
 *         values: 5 GB, 100 GB, Unlimited
 *       - feature: Team seats
 *         values: 1, 10, Unlimited
 *       - feature: API access
 *         values: ✗, ✓, ✓
 */

import type { RenderContext } from '../renderer/types.js';
import type { Value } from '../ast/types.js';
import {
  T, esc, style, getModArg, spaceToken,
  resolveString, getBlockValueProps, getArrayItems,
} from '../renderer/helpers.js';

interface ColDef {
  name: string;
  price: string;
  subtitle: string;
  badge: string;
  ctaLabel: string;
  ctaRole: string;
  ctaHref: string;
}

interface RowDef {
  feature: string;
  values: string[];
}

function parseColumns(val: Value | undefined): ColDef[] {
  const items = getArrayItems(val);
  return items.map((item) => {
    const props = getBlockValueProps(item);
    const ctaVal = props['cta'];
    let ctaLabel = '';
    let ctaRole = 'primary';
    let ctaHref = '#';

    if (ctaVal) {
      if (ctaVal.type === 'modified') {
        ctaLabel = resolveString(ctaVal.base);
        const roleMod = ctaVal.modifiers.find((m) => m.name === 'role');
        if (roleMod?.args[0]) ctaRole = String(roleMod.args[0]);
        const hrefMod = ctaVal.modifiers.find((m) => m.name === 'href');
        if (hrefMod?.args[0]) ctaHref = String(hrefMod.args[0]);
      } else if (ctaVal.type === 'blockValue') {
        ctaLabel = resolveString(ctaVal.properties['label']);
        const r = ctaVal.properties['role'];
        if (r) ctaRole = resolveString(r);
        const h = ctaVal.properties['href'];
        if (h) ctaHref = resolveString(h);
      } else {
        ctaLabel = resolveString(ctaVal);
      }
    }

    return {
      name: resolveString(props['name']),
      price: resolveString(props['price']),
      subtitle: resolveString(props['subtitle']),
      badge: resolveString(props['badge']),
      ctaLabel,
      ctaRole,
      ctaHref,
    };
  });
}

function parseRows(val: Value | undefined, colCount: number): RowDef[] {
  const items = getArrayItems(val);
  return items.map((item) => {
    const props = getBlockValueProps(item);
    const feature = resolveString(props['feature']);
    const rawValues = resolveString(props['values']);
    const values = rawValues.split(',').map((s) => s.trim());
    // Pad or trim to colCount
    while (values.length < colCount) values.push('');
    return { feature, values: values.slice(0, colCount) };
  });
}

// Symbol font stack — ensures check/cross glyphs render in headless environments
const SYMBOL_FONT = `'Noto Sans Symbols', 'Noto Sans', system-ui, sans-serif`;

function renderValue(v: string, isHighlight: boolean): string {
  const vt = v.trim();
  // ✓ and synonyms — green check
  if (vt === '✓' || vt === '✔' || vt.toLowerCase() === 'yes') {
    return `<span style="font-family: ${SYMBOL_FONT}; color: #22c55e; font-weight: 600; font-size: 1.1em;">✓</span>`;
  }
  // ✗ and synonyms — render as × (U+00D7 MULTIPLICATION SIGN, universally available)
  if (vt === '✗' || vt === '✘' || vt === 'x' || vt.toLowerCase() === 'no') {
    return `<span style="color: ${T.textCaption}; font-size: 1.1em;">&#xD7;</span>`;
  }
  return esc(v);
}

function renderButton(col: ColDef, inverted = false): string {
  if (!col.ctaLabel) return '';
  const role = col.ctaRole;
  const href = col.ctaHref;

  let btnStyle: Record<string, string>;
  if (role === 'primary') {
    btnStyle = {
      'display': 'block',
      'width': '100%',
      'padding': `${T.spaceSm} ${T.spaceMd}`,
      'background': T.accentDefault,
      'color': T.textInverse,
      'font-size': T.scaleBody,
      'font-weight': '600',
      'border-radius': T.radiusMd,
      'text-decoration': 'none',
      'text-align': 'center',
      'border': 'none',
      'cursor': 'pointer',
      'box-sizing': 'border-box',
    };
  } else {
    btnStyle = {
      'display': 'block',
      'width': '100%',
      'padding': `${T.spaceSm} ${T.spaceMd}`,
      'background': 'transparent',
      'color': T.textPrimary,
      'font-size': T.scaleBody,
      'font-weight': '500',
      'border': `1px solid ${T.borderDefault}`,
      'border-radius': T.radiusMd,
      'text-decoration': 'none',
      'text-align': 'center',
      'cursor': 'pointer',
      'box-sizing': 'border-box',
    };
  }

  return `<a href="${esc(href)}" style="${style(btnStyle)}">${esc(col.ctaLabel)}</a>`;
}

export function renderComparison(ctx: RenderContext): string {
  const { section, tokens } = ctx;
  const { block } = section;
  const { properties, modifiers } = block;

  const padSize = getModArg(modifiers, 'pad', 'section');
  const padValue = spaceToken(padSize);

  // Parse columns + highlight index (1-indexed)
  const cols = parseColumns(properties['columns']);
  const highlightStr = resolveString(properties['highlight']);
  const highlightIdx = highlightStr ? parseInt(highlightStr, 10) - 1 : -1;

  // Title
  const title = resolveString(properties['title']);

  // Parse rows
  const rows = parseRows(properties['rows'], cols.length);

  const sectionStyle = style({
    'padding': `${padValue} ${T.spaceXl}`,
    'background': T.surfaceDefault,
  });

  // Grid: feature-label column + one column per plan
  const labelColWidth = cols.length <= 2 ? '220px' : '180px';
  const gridStyle = style({
    'display': 'grid',
    'grid-template-columns': `${labelColWidth} ${cols.map(() => '1fr').join(' ')}`,
    'max-width': '960px',
    'margin': '0 auto',
    'border': `1px solid ${T.borderSubtle}`,
    'border-radius': T.radiusLg,
    'overflow': 'hidden',
  });

  // Accent tint for highlighted column
  const accentTint = tokens.values['--t-accent-tint'] ?? '#e8edf4';

  let html = `<section class="tela-comparison" style="${sectionStyle}">\n`;
  html += `  <div style="max-width: 960px; margin: 0 auto;">\n`;

  if (title) {
    html += `    <h2 style="${style({
      'font-family': T.familySerif,
      'font-size': T.scaleH2,
      'font-weight': T.weightHeading,
      'color': T.textPrimary,
      'margin': `0 0 ${T.spaceLg} 0`,
      'text-align': 'center',
    })}">${esc(title)}</h2>\n`;
  }

  html += `  <div class="tela-comparison__grid" style="${gridStyle}">\n`;

  // ── Header row ──────────────────────────────────────────────────────────────
  // Empty feature-label header cell
  html += `    <div style="${style({
    'padding': T.spaceMd,
    'background': T.surfaceElevated,
    'border-bottom': `1px solid ${T.borderSubtle}`,
  })}"></div>\n`;

  cols.forEach((col, i) => {
    const isHL = i === highlightIdx;
    const headerStyle = style({
      'padding': `${T.spaceLg} ${T.spaceMd} ${T.spaceMd}`,
      'background': isHL ? accentTint : T.surfaceElevated,
      'border-bottom': `1px solid ${T.borderSubtle}`,
      'border-left': `1px solid ${T.borderSubtle}`,
      'text-align': 'center',
      'position': 'relative',
      ...(isHL ? { 'border-top': `3px solid ${T.accentDefault}` } : {}),
    });

    html += `    <div style="${headerStyle}">\n`;

    if (col.badge) {
      html += `      <div style="${style({
        'display': 'inline-block',
        'font-size': T.scaleCaption,
        'font-weight': '600',
        'text-transform': 'uppercase',
        'letter-spacing': '0.06em',
        'color': T.textInverse,
        'background': T.accentDefault,
        'padding': '2px 10px',
        'border-radius': T.radiusPill,
        'margin-bottom': T.spaceSm,
      })}">${esc(col.badge)}</div>\n`;
    }

    html += `      <div style="${style({
      'font-family': T.familySans,
      'font-size': T.scaleLead,
      'font-weight': T.weightHeading,
      'color': T.textPrimary,
      'margin-bottom': '4px',
    })}">${esc(col.name)}</div>\n`;

    if (col.price) {
      html += `      <div style="${style({
        'font-family': T.familySerif,
        'font-size': T.scaleH2,
        'font-weight': T.weightHeading,
        'color': isHL ? T.accentDefault : T.textPrimary,
        'line-height': T.leadingTight,
        'margin-bottom': T.spaceSm,
      })}">${esc(col.price)}</div>\n`;
    }

    if (col.subtitle) {
      html += `      <div style="${style({
        'font-size': T.scaleCaption,
        'color': T.textCaption,
        'margin-bottom': T.spaceSm,
      })}">${esc(col.subtitle)}</div>\n`;
    }

    if (col.ctaLabel) {
      html += `      <div style="margin-top: ${T.spaceMd};">${renderButton(col)}</div>\n`;
    }

    html += `    </div>\n`;
  });

  // ── Feature rows ─────────────────────────────────────────────────────────────
  rows.forEach((row, rowIdx) => {
    const isLast = rowIdx === rows.length - 1;
    const rowBorder = isLast ? '' : `border-bottom: 1px solid ${T.borderSubtle};`;

    // Feature label cell
    html += `    <div style="${style({
      'padding': `${T.spaceSm} ${T.spaceMd}`,
      'font-size': T.scaleBody,
      'color': T.textSecondary,
      'font-family': T.familySans,
      'display': 'flex',
      'align-items': 'center',
      ...(isLast ? {} : { 'border-bottom': `1px solid ${T.borderSubtle}` }),
    })}">${esc(row.feature)}</div>\n`;

    // Value cells
    row.values.forEach((v, ci) => {
      const isHL = ci === highlightIdx;
      html += `    <div style="${style({
        'padding': `${T.spaceSm} ${T.spaceMd}`,
        'font-size': T.scaleBody,
        'font-family': T.familySans,
        'color': isHL ? T.textPrimary : T.textSecondary,
        'text-align': 'center',
        'display': 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'background': isHL ? accentTint : 'transparent',
        'border-left': `1px solid ${T.borderSubtle}`,
        ...(isLast ? {} : { 'border-bottom': `1px solid ${T.borderSubtle}` }),
      })}">${renderValue(v, isHL)}</div>\n`;
    });
  });

  html += `  </div>\n`;
  html += `  </div>\n`;
  html += `</section>`;

  return html;
}
