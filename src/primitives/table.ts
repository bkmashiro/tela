/**
 * table primitive — data table with optional striping, alignment, and row highlighting.
 */

import type { RenderContext } from '../renderer/types.js';
import { T, esc, style, getModArg, resolveString, getArrayItems, spaceToken } from '../renderer/helpers.js';

export function renderTable(ctx: RenderContext): string {
  const { section, tokens } = ctx;
  const { block } = section;
  const { properties, modifiers } = block;

  const padSize = getModArg(modifiers, 'pad', 'section');
  const bgToken = getModArg(modifiers, 'bg', '');
  const bgStyle = bgToken ? `var(--t-${bgToken.replace(/\./g, '-')})` : T.surfaceDefault;
  const striped = modifiers.some(m => m.name === 'striped');

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
    'margin': `0 0 ${T.spaceMd} 0`,
  });

  // Parse headers
  const headersVal = properties['headers'];
  const headersStr = resolveString(headersVal);
  const headers = headersStr ? headersStr.split(',').map(s => s.trim()) : [];

  // Parse align (e.g. "left, right, right, right")
  const alignVal = properties['align'];
  const alignStr = resolveString(alignVal);
  const aligns = alignStr ? alignStr.split(',').map(s => s.trim()) : [];

  // Parse rows — each row is an array item whose string value is comma-separated.
  // Handles both plain strings and bracket-wrapped strings like "[val1, val2]".
  const rowsVal = properties['rows'];
  const rowItems = getArrayItems(rowsVal);
  const rows: string[][] = rowItems.map(item => {
    let rowStr = resolveString(item);
    // Strip surrounding brackets if present: "[val1, val2]" → "val1, val2"
    rowStr = rowStr.trim();
    if (rowStr.startsWith('[') && rowStr.endsWith(']')) {
      rowStr = rowStr.slice(1, -1);
    }
    return rowStr.split(',').map(s => s.trim());
  });

  // highlight: "last" | "first" | number (1-indexed)
  const highlight = resolveString(properties['highlight']);
  const highlightIdx = highlight === 'last' ? rows.length - 1
    : highlight === 'first' ? 0
    : highlight ? parseInt(highlight, 10) - 1
    : -1;

  // Table styles
  const tableStyle = style({
    'width': '100%',
    'border-collapse': 'collapse',
    'font-family': T.familySans,
    'font-size': T.scaleBody,
  });

  const thStyle = (i: number) => style({
    'text-align': aligns[i] ?? 'left',
    'padding': `${T.spaceSm} ${T.spaceMd}`,
    'font-size': T.scaleCaption,
    'font-weight': T.weightEmphasis,
    'color': T.textSecondary,
    'text-transform': 'uppercase',
    'letter-spacing': '0.05em',
    'border-bottom': `2px solid ${T.borderDefault}`,
    'white-space': 'nowrap',
  });

  const tdStyle = (i: number, rowIdx: number, isHighlighted: boolean) => style({
    'text-align': aligns[i] ?? 'left',
    'padding': `${T.spaceSm} ${T.spaceMd}`,
    'border-bottom': `1px solid ${T.borderSubtle}`,
    'color': isHighlighted ? T.accentDefault : T.textPrimary,
    'font-weight': isHighlighted ? T.weightEmphasis : T.weightBody,
    'background': isHighlighted
      ? tokens.values['--t-accent-tint'] ?? '#e8edf4'
      : striped && rowIdx % 2 === 1
        ? tokens.values['--t-surface-warm'] ?? '#f0f4f8'
        : 'transparent',
  });

  // Build HTML
  let html = `<section class="tela-table" style="${sectionStyle}">\n`;
  html += `  <div style="max-width: 900px; margin: 0 auto; overflow-x: auto;">\n`;

  if (title) {
    html += `    <h3 style="${titleStyle}">${esc(title)}</h3>\n`;
  }

  html += `    <table style="${tableStyle}">\n`;

  // Header row
  if (headers.length > 0) {
    html += `      <thead>\n        <tr>\n`;
    headers.forEach((h, i) => {
      html += `          <th style="${thStyle(i)}">${esc(h)}</th>\n`;
    });
    html += `        </tr>\n      </thead>\n`;
  }

  // Body rows
  html += `      <tbody>\n`;
  rows.forEach((row, rowIdx) => {
    const isHighlighted = rowIdx === highlightIdx;
    html += `        <tr>\n`;
    row.forEach((cell, colIdx) => {
      html += `          <td style="${tdStyle(colIdx, rowIdx, isHighlighted)}">${esc(cell)}</td>\n`;
    });
    html += `        </tr>\n`;
  });
  html += `      </tbody>\n    </table>\n  </div>\n</section>`;

  return html;
}
