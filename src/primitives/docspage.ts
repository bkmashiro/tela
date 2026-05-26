/**
 * docspage primitive — two-column sticky-sidebar docs layout.
 */

import type { RenderContext } from '../renderer/types.js';
import {
  T, esc, style, getModArg, spaceToken, resolveString, getArrayItems,
  getBlockValueProps,
} from '../renderer/helpers.js';

export function renderDocsPage(ctx: RenderContext): string {
  const { block } = ctx.section;
  const { properties, modifiers } = block;

  const padSize = getModArg(modifiers, 'pad', 'lg');
  const bgToken = getModArg(modifiers, 'bg', '');
  const bgStyle = bgToken
    ? `var(--t-${bgToken.replace(/\./g, '-')})`
    : T.surfaceDefault;

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const sidebarVal = properties['sidebar'];
  const sidebarProps = getBlockValueProps(sidebarVal);
  const sidebarTitle = resolveString(sidebarProps['title']);

  const linksVal = sidebarProps['links'];
  const linkItems = getArrayItems(linksVal);

  let linksHtml = '';
  for (const link of linkItems) {
    let label = '';
    let href = '#';

    if (link.type === 'blockValue') {
      label = resolveString(link.properties['label']);
      href = resolveString(link.properties['href'] ?? link.properties['url']) || '#';
    } else if (link.type === 'modified') {
      label = resolveString(link.base);
      const hrefMod = link.modifiers.find((m) => m.name === 'href' || m.name === 'url');
      if (hrefMod && hrefMod.args.length > 0) href = String(hrefMod.args[0]);
    } else {
      label = resolveString(link);
    }

    linksHtml += `      <li style="margin-bottom: 4px;">
        <a href="${esc(href)}" style="${style({
    'display': 'block',
    'padding': '6px 8px',
    'font-size': T.scaleBody,
    'color': T.textSecondary,
    'text-decoration': 'none',
    'border-radius': T.radiusSm,
  })}" onmouseover="this.style.background='${T.accentTint}';this.style.color='${T.accentDefault}'" onmouseout="this.style.background='';this.style.color='${T.textSecondary}'">${esc(label)}</a>
      </li>`;
  }

  const sidebarHtml = `  <nav class="tela-docspage__sidebar" style="${style({
    'position': 'sticky',
    'top': '0',
    'height': '100vh',
    'overflow-y': 'auto',
    'padding': '32px 24px',
    'border-right': `1px solid ${T.borderSubtle}`,
    'background': T.surfaceElevated,
  })}">
    ${sidebarTitle ? `<div style="${style({
    'font-weight': '600',
    'margin-bottom': '16px',
    'font-size': T.scaleBody,
    'color': T.textPrimary,
  })}">${esc(sidebarTitle)}</div>` : ''}
    <ul style="list-style: none; padding: 0; margin: 0;">
${linksHtml}    </ul>
  </nav>`;

  // ── Content ───────────────────────────────────────────────────────────────
  const contentVal = properties['content'];
  const contentItems = getArrayItems(contentVal);

  let sectionsHtml = '';
  for (const item of contentItems) {
    if (item.type !== 'blockValue') continue;

    const sectionHeading = resolveString(item.properties['section'] ?? item.properties['heading']);
    const sectionId = resolveString(item.properties['id']);
    const body = resolveString(item.properties['body']);
    const code = resolveString(item.properties['code']);

    sectionsHtml += `    <section${sectionId ? ` id="${esc(sectionId)}"` : ''} style="margin-bottom: 48px;">
`;

    if (sectionHeading) {
      sectionsHtml += `      <h2 style="${style({
        'font-family': T.familySerif,
        'font-size': T.scaleH2,
        'font-weight': T.weightHeading,
        'line-height': T.leadingTight,
        'color': T.textPrimary,
        'margin': `0 0 ${T.spaceMd} 0`,
        'padding-bottom': T.spaceSm,
        'border-bottom': `1px solid ${T.borderSubtle}`,
      })}">${esc(sectionHeading)}</h2>
`;
    }

    if (body) {
      const paragraphs = body.split(/\n{2,}/);
      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (trimmed) {
          sectionsHtml += `      <p style="${style({
            'font-size': T.scaleBody,
            'line-height': T.leadingLoose,
            'color': T.textSecondary,
            'margin': `0 0 ${T.spaceMd} 0`,
          })}">${esc(trimmed)}</p>
`;
        }
      }
    }

    if (code) {
      sectionsHtml += `      <pre style="${style({
        'font-family': T.familyMono,
        'font-size': T.scaleCaption,
        'background': T.surfaceElevated,
        'border': `1px solid ${T.borderDefault}`,
        'border-radius': T.radiusMd,
        'padding': T.spaceMd,
        'overflow-x': 'auto',
        'line-height': T.leadingDefault,
        'color': T.textPrimary,
      })}"><code>${esc(code)}</code></pre>
`;
    }

    sectionsHtml += `    </section>\n`;
  }

  const contentHtml = `  <main class="tela-docspage__content" style="${style({
    'padding': '48px',
    'max-width': '720px',
    'overflow-y': 'auto',
  })}">
${sectionsHtml}  </main>`;

  return `<div class="tela-docspage" style="${style({
    'display': 'grid',
    'grid-template-columns': '240px 1fr',
    'gap': '0',
    'min-height': '100vh',
    'max-width': '1200px',
    'margin': '0 auto',
    'background': bgStyle,
  })}">
${sidebarHtml}
${contentHtml}
</div>`;
}
