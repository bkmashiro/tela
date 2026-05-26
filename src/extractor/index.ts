/**
 * Tela HTML Extractor.
 * Converts arbitrary HTML into an approximate .tela document with confidence scores.
 * Uses regex + string parsing only — no external HTML parser dependencies.
 */

import type { ExtractionResult, ExtractedSection } from './types.js';

export type { ExtractionResult, ExtractedSection };

// ─── Theme detection ──────────────────────────────────────────────────────────

interface ThemeDetection {
  theme: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Hex color to RGB components.
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
}

// Theme surface colors for matching
const THEME_SURFACE_COLORS: Array<{ theme: string; color: string; rgb: [number, number, number] }> = [
  { theme: 'warm-editorial', color: '#f5f4ed', rgb: [245, 244, 237] },
  { theme: 'cool-technical', color: '#f8f9fa', rgb: [248, 249, 250] },
  { theme: 'neutral-minimal', color: '#ffffff', rgb: [255, 255, 255] },
  { theme: 'dark-dramatic', color: '#0a0a0a', rgb: [10, 10, 10] },
];

function detectTheme(html: string): ThemeDetection {
  // Look for background-color in body tag or early style attributes
  const bodyMatch = html.match(/<body[^>]*style="([^"]*)"[^>]*>/i)
    ?? html.match(/<body[^>]*style='([^']*)'[^>]*>/i);

  let bgColor: string | null = null;

  if (bodyMatch) {
    const bgMatch = bodyMatch[1].match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]+\))/i);
    if (bgMatch) bgColor = bgMatch[1];
  }

  // Also check :root or body in style blocks
  if (!bgColor) {
    const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? [];
    for (const block of styleBlocks) {
      const bodyRule = block.match(/body\s*\{([^}]*)\}/i);
      if (bodyRule) {
        const bgMatch = bodyRule[1].match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/i);
        if (bgMatch) { bgColor = bgMatch[1]; break; }
      }
    }
  }

  // Check CSS custom properties or meta theme-color
  if (!bgColor) {
    const metaMatch = html.match(/<meta[^>]*name="theme-color"[^>]*content="([^"]+)"/i);
    if (metaMatch) bgColor = metaMatch[1];
  }

  if (bgColor) {
    const rgb = hexToRgb(bgColor);
    if (rgb) {
      // Check for dark theme: low brightness
      const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
      if (brightness < 50) {
        return { theme: 'dark-dramatic', confidence: 'high' };
      }

      // Find nearest theme by color distance
      let nearest = THEME_SURFACE_COLORS[0];
      let minDist = colorDistance(rgb, nearest.rgb);

      for (const candidate of THEME_SURFACE_COLORS) {
        const dist = colorDistance(rgb, candidate.rgb);
        if (dist < minDist) {
          minDist = dist;
          nearest = candidate;
        }
      }

      const confidence: 'high' | 'medium' | 'low' = minDist < 10 ? 'high' : minDist < 40 ? 'medium' : 'low';
      return { theme: nearest.theme, confidence };
    }
  }

  // Heuristic: look for warm-toned color values in the HTML
  const warmColors = (html.match(/#[fF][5-9a-fA-F][4-9a-fA-F][4-9a-fA-F][dDeEfF][dDeEfF]/g) ?? []).length;
  const darkColors = (html.match(/#[0-2][0-9a-fA-F]{5}/g) ?? []).length;

  if (darkColors > warmColors && darkColors > 2) {
    return { theme: 'dark-dramatic', confidence: 'low' };
  }
  if (warmColors > 2) {
    return { theme: 'warm-editorial', confidence: 'low' };
  }

  return { theme: 'warm-editorial', confidence: 'low' };
}

// ─── Section splitting ────────────────────────────────────────────────────────

const SECTION_TAGS = ['section', 'header', 'footer', 'main', 'article', 'nav'];

function splitIntoHtmlChunks(html: string): string[] {
  // Find positions of top-level semantic elements
  const tagPattern = new RegExp(
    `<(${SECTION_TAGS.join('|')})(\\s[^>]*)?>`,
    'gi'
  );

  const matches: Array<{ tag: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = tagPattern.exec(html)) !== null) {
    matches.push({ tag: m[1].toLowerCase(), index: m.index });
  }

  if (matches.length === 0) {
    // Try splitting on large padded divs
    const divPattern = /(<div[^>]*style="[^"]*padding\s*:\s*(\d+)px[^"]*"[^>]*>)/gi;
    const divMatches: Array<{ index: number }> = [];
    while ((m = divPattern.exec(html)) !== null) {
      const paddingMatch = m[0].match(/padding\s*:\s*(\d+)/i);
      if (paddingMatch && parseInt(paddingMatch[1]) > 40) {
        divMatches.push({ index: m.index });
      }
    }

    if (divMatches.length > 0) {
      const chunks: string[] = [];
      for (let i = 0; i < divMatches.length; i++) {
        const start = divMatches[i].index;
        const end = i + 1 < divMatches.length ? divMatches[i + 1].index : html.length;
        chunks.push(html.slice(start, end));
      }
      return chunks;
    }

    // Fallback: entire HTML as one section
    return [html];
  }

  // Extract chunks between match positions
  const chunks: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    const chunk = html.slice(start, end);
    if (chunk.trim()) chunks.push(chunk);
  }

  return chunks;
}

// ─── Layout detection ─────────────────────────────────────────────────────────

type LayoutType = 'split' | 'grid' | 'centered' | 'stack';

interface LayoutDetection {
  layout: LayoutType;
  detail: string;     // e.g. "50/50", "3"
  note: string;
}

function detectLayout(chunk: string): LayoutDetection {
  // Extract all style attributes
  const styles = (chunk.match(/style="([^"]*)"/gi) ?? []).join(' ');

  // Check for grid layout
  const gridColsMatch = styles.match(/grid-template-columns\s*:\s*([^;}"]+)/i);
  if (gridColsMatch) {
    const colDef = gridColsMatch[1].trim();
    // Count columns: "repeat(3, 1fr)" → 3, "1fr 1fr 1fr" → 3
    const repeatMatch = colDef.match(/repeat\s*\(\s*(\d+)/);
    if (repeatMatch) {
      const n = parseInt(repeatMatch[1]);
      return { layout: 'grid', detail: String(n), note: `layout: detected grid (grid-template-columns: ${colDef.trim()}) → grid(${n})` };
    }
    // Count space-separated fractions
    const frParts = colDef.split(/\s+/).filter(p => p.includes('fr') || p.includes('px') || p.includes('%'));
    if (frParts.length > 1) {
      return { layout: 'grid', detail: String(frParts.length), note: `layout: detected grid (${frParts.length} columns) → grid(${frParts.length})` };
    }
  }

  // Check for display: grid without template (check child count)
  if (styles.match(/display\s*:\s*grid/i)) {
    return { layout: 'grid', detail: '2', note: 'layout: detected display:grid → grid(2)' };
  }

  // Check for flex row
  if (styles.match(/display\s*:\s*flex/i)) {
    const isRow = !styles.match(/flex-direction\s*:\s*column/i);
    if (isRow) {
      return { layout: 'split', detail: '50/50', note: 'layout: detected flex row → split(50/50)' };
    }
  }

  // Check text-align: center on container
  if (styles.match(/text-align\s*:\s*center/i)) {
    return { layout: 'centered', detail: '', note: 'layout: detected text-align:center → centered' };
  }

  // Check class-based hints
  if (/class="[^"]*\b(flex|row|grid)\b[^"]*"/i.test(chunk)) {
    return { layout: 'split', detail: '50/50', note: 'layout: detected flex/grid class → split(50/50)' };
  }

  return { layout: 'stack', detail: '', note: 'layout: single column → stack' };
}

// ─── Section type detection ───────────────────────────────────────────────────

type SectionType = 'hero' | 'feature' | 'prose' | 'quote' | 'cta' | 'figure' | 'footer' | 'nav' | 'grid';

interface TypeDetection {
  sectionType: SectionType;
  confidence: number;
}

function detectSectionType(chunk: string): TypeDetection {
  const lower = chunk.toLowerCase();

  // nav tag
  if (/^<nav[\s>]/i.test(chunk.trim()) || /<nav[\s>]/i.test(chunk.slice(0, 200))) {
    return { sectionType: 'nav', confidence: 0.9 };
  }

  // footer tag
  if (/^<footer[\s>]/i.test(chunk.trim()) || /<footer[\s>]/i.test(chunk.slice(0, 200))) {
    return { sectionType: 'footer', confidence: 0.9 };
  }

  // blockquote or italic + attribution → quote
  if (lower.includes('<blockquote') || (lower.includes('<em') && lower.includes('—'))) {
    return { sectionType: 'quote', confidence: 0.8 };
  }

  // hero: h1 + large font size or hero-like class
  const hasH1 = /<h1[\s>]/i.test(chunk);
  const hasLargeFont = /font-size\s*:\s*([4-9]\d|[1-9]\d{2,})px/i.test(chunk);
  const hasHeroClass = /class="[^"]*hero[^"]*"/i.test(chunk);
  if (hasH1 && (hasLargeFont || hasHeroClass || /<h1[\s>]/i.test(chunk))) {
    return { sectionType: 'hero', confidence: hasLargeFont || hasHeroClass ? 0.85 : 0.7 };
  }

  // figure: dominant image
  const imgCount = (chunk.match(/<img[\s>]/gi) ?? []).length;
  const figureCount = (chunk.match(/<figure[\s>]/gi) ?? []).length;
  const textLen = chunk.replace(/<[^>]+>/g, '').trim().length;
  if ((imgCount > 0 || figureCount > 0) && textLen < 100) {
    return { sectionType: 'figure', confidence: 0.75 };
  }

  // cta: button or styled anchor
  const hasCta = /<button[\s>]/i.test(chunk) ||
    /class="[^"]*\b(btn|button|cta)\b[^"]*"/i.test(chunk);
  if (hasCta) {
    return { sectionType: 'cta', confidence: 0.75 };
  }

  // grid: multiple cards
  const cardCount = (chunk.match(/class="[^"]*(card|item|tile)[^"]*"/gi) ?? []).length;
  if (cardCount >= 2) {
    return { sectionType: 'grid', confidence: 0.7 };
  }

  // feature: h2 + body text
  if (/<h2[\s>]/i.test(chunk)) {
    return { sectionType: 'feature', confidence: 0.65 };
  }

  // prose: any paragraphs
  if (/<p[\s>]/i.test(chunk)) {
    return { sectionType: 'prose', confidence: 0.55 };
  }

  return { sectionType: 'prose', confidence: 0.4 };
}

// ─── Content extraction ───────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

interface ExtractedContent {
  headline?: string;
  body?: string;
  cta?: string;
  figure?: string;
  attribution?: string;
  quote?: string;
}

function extractContent(chunk: string): ExtractedContent {
  const content: ExtractedContent = {};

  // Headline from h1-h6
  const headlineMatch = chunk.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (headlineMatch) {
    content.headline = stripTags(headlineMatch[1]) || '{{PLACEHOLDER}}';
  }

  // Body from first <p>
  const bodyMatch = chunk.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (bodyMatch) {
    content.body = stripTags(bodyMatch[1]) || '{{PLACEHOLDER}}';
  }

  // CTA from button or .btn anchor
  const btnMatch = chunk.match(/<button[^>]*>([\s\S]*?)<\/button>/i)
    ?? chunk.match(/<a[^>]*class="[^"]*btn[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
  if (btnMatch) {
    content.cta = stripTags(btnMatch[1]) || '{{PLACEHOLDER}}';
  }

  // Figure from img
  const imgMatch = chunk.match(/<img[^>]*src="([^"]*)"[^>]*>/i);
  if (imgMatch) {
    content.figure = imgMatch[1] || '{{PLACEHOLDER}}';
  }

  // Quote: blockquote content
  const quoteMatch = chunk.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
  if (quoteMatch) {
    content.quote = stripTags(quoteMatch[1]) || '{{PLACEHOLDER}}';
  }

  // Attribution: cite or element after — in a paragraph near a blockquote
  const citeMatch = chunk.match(/<cite[^>]*>([\s\S]*?)<\/cite>/i);
  if (citeMatch) {
    content.attribution = stripTags(citeMatch[1]) || '{{PLACEHOLDER}}';
  } else {
    // Look for "— Name" pattern
    const attrMatch = stripTags(chunk).match(/[—–-]\s+([A-Z][^\n,]+)/);
    if (attrMatch) {
      content.attribution = attrMatch[1].trim();
    }
  }

  return content;
}

// ─── Modifier detection ───────────────────────────────────────────────────────

interface ModifierDetection {
  modifiers: string[];
  bg?: string;
}

function detectModifiers(chunk: string): ModifierDetection {
  const styles = (chunk.match(/style="([^"]*)"/gi) ?? []).join(' ');
  const modifiers: string[] = [];
  let bg: string | undefined;

  // Padding detection
  const paddingMatch = styles.match(/padding\s*:\s*(\d+)px/i)
    ?? styles.match(/padding-top\s*:\s*(\d+)px/i);
  if (paddingMatch) {
    const px = parseInt(paddingMatch[1]);
    if (px > 60) modifiers.push('pad(xl)');
    else if (px > 30) modifiers.push('pad(lg)');
    else if (px > 16) modifiers.push('pad(md)');
    else if (px > 0) modifiers.push('pad(sm)');
  }

  // Border radius
  const radiusMatch = styles.match(/border-radius\s*:\s*(\d+)px/i);
  if (radiusMatch && parseInt(radiusMatch[1]) > 8) {
    modifiers.push('rounded');
  }

  // Box shadow
  if (styles.match(/box-shadow\s*:/i)) {
    modifiers.push('shadow(md)');
  }

  // Background color different from body default
  const bgColorMatch = styles.match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/i);
  if (bgColorMatch) {
    const color = bgColorMatch[1].toLowerCase();
    // Only add bg modifier if it's not just white/near-white defaults
    if (color !== '#ffffff' && color !== '#fff') {
      bg = 'surface.elevated';
    }
  }

  return { modifiers, bg };
}

// ─── Grid column count detection ─────────────────────────────────────────────

function detectGridColumns(chunk: string): number {
  // Try grid-template-columns
  const gtcMatch = chunk.match(/grid-template-columns\s*:\s*([^;}"]+)/i);
  if (gtcMatch) {
    const colDef = gtcMatch[1].trim();
    const repeatMatch = colDef.match(/repeat\s*\(\s*(\d+)/);
    if (repeatMatch) return parseInt(repeatMatch[1]);
    const frParts = colDef.split(/\s+/).filter(p => /fr|px|%/.test(p));
    if (frParts.length > 0) return frParts.length;
  }

  // Count direct children with card-like classes
  const cardMatches = (chunk.match(/class="[^"]*(card|item|tile|col)[^"]*"/gi) ?? []).length;
  if (cardMatches >= 2) return cardMatches;

  return 2;
}

// ─── Tela fragment assembly ───────────────────────────────────────────────────

function assembleSectionTela(
  idx: number,
  sectionType: SectionType,
  layout: LayoutDetection,
  content: ExtractedContent,
  modifiers: ModifierDetection,
  chunk: string,
): string {
  const lines: string[] = [];

  // Build modifier string
  const allMods: string[] = [];
  if (layout.layout === 'split') allMods.push(`split(${layout.detail || '50/50'})`);
  if (layout.layout === 'centered') allMods.push('centered');
  if (layout.layout === 'grid') {
    const n = detectGridColumns(chunk);
    allMods.push(`grid(${n})`);
  }
  allMods.push(...modifiers.modifiers);
  if (modifiers.bg) allMods.push(`bg(${modifiers.bg})`);

  const modStr = allMods.length > 0 ? ` | ${allMods.join(' ')}` : '';

  lines.push(`${sectionType}${modStr}:`);

  // For split layout, create left/right
  if (layout.layout === 'split') {
    lines.push('  left:');
    if (content.headline) lines.push(`    headline: "${content.headline}"`);
    if (content.body) lines.push(`    body: "${content.body}"`);
    if (content.cta) {
      lines.push('    cta:');
      lines.push(`      - label: "${content.cta}"`);
    }
    lines.push('  right:');
    if (content.figure) {
      lines.push(`    figure: "${content.figure}"`);
    } else {
      lines.push('    figure: "{{PLACEHOLDER}}"');
    }
    return lines.join('\n');
  }

  // For quote type
  if (sectionType === 'quote') {
    if (content.quote) lines.push(`  body: "${content.quote}"`);
    else if (content.body) lines.push(`  body: "${content.body}"`);
    if (content.attribution) lines.push(`  attribution: "${content.attribution}"`);
    return lines.join('\n');
  }

  // For grid type
  if (layout.layout === 'grid' || sectionType === 'grid') {
    if (content.headline) lines.push(`  headline: "${content.headline}"`);
    lines.push('  items:');
    lines.push('    - title: "{{PLACEHOLDER}}"');
    lines.push('      body: "{{PLACEHOLDER}}"');
    return lines.join('\n');
  }

  // For figure type
  if (sectionType === 'figure') {
    if (content.figure) lines.push(`  src: "${content.figure}"`);
    if (content.body) lines.push(`  caption: "${content.body}"`);
    return lines.join('\n');
  }

  // For nav
  if (sectionType === 'nav') {
    lines.push('  logo: "{{PLACEHOLDER}}"');
    lines.push('  links:');
    lines.push('    - label: "{{PLACEHOLDER}}"');
    return lines.join('\n');
  }

  // For footer
  if (sectionType === 'footer') {
    if (content.body) lines.push(`  body: "${content.body}"`);
    else lines.push('  body: "{{PLACEHOLDER}}"');
    return lines.join('\n');
  }

  // For cta
  if (sectionType === 'cta') {
    if (content.headline) lines.push(`  headline: "${content.headline}"`);
    if (content.body) lines.push(`  body: "${content.body}"`);
    if (content.cta) {
      lines.push('  cta:');
      lines.push(`    - label: "${content.cta}"`);
    }
    return lines.join('\n');
  }

  // Default: hero, feature, prose
  if (content.headline) lines.push(`  headline: "${content.headline}"`);
  if (content.body) lines.push(`  body: "${content.body}"`);
  if (content.figure) lines.push(`  figure: "${content.figure}"`);
  if (content.cta) {
    lines.push('  cta:');
    lines.push(`    - label: "${content.cta}"`);
  }

  if (lines.length === 1) {
    // Only header line — add placeholder
    lines.push('  body: "{{PLACEHOLDER}}"');
  }

  return lines.join('\n');
}

// ─── Main extract function ────────────────────────────────────────────────────

export function extract(html: string): ExtractionResult {
  const warnings: string[] = [];
  const sections: ExtractedSection[] = [];

  // Step 1: Detect theme
  const themeDetection = detectTheme(html);

  // Step 2: Split into section chunks
  const chunks = splitIntoHtmlChunks(html);

  if (chunks.length === 0) {
    warnings.push('No structural sections detected; treating entire document as a single section.');
  }

  // Steps 3-6: Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const layoutDet = detectLayout(chunk);
    const typeDet = detectSectionType(chunk);
    const content = extractContent(chunk);
    const modDet = detectModifiers(chunk);

    const notes: string[] = [layoutDet.note];

    // Compute section confidence
    const baseConfidence = typeDet.confidence;
    const layoutBonus = layoutDet.layout !== 'stack' ? 0.05 : 0;
    const confidence = Math.min(1.0, baseConfidence + layoutBonus);

    const tela = assembleSectionTela(i, typeDet.sectionType, layoutDet, content, modDet, chunk);

    // Add content replacement notes
    if (content.headline && content.headline !== '{{PLACEHOLDER}}') {
      notes.push(`content: headline extracted from heading element`);
    }
    if (content.body && content.body !== '{{PLACEHOLDER}}') {
      notes.push(`content: body extracted from <p> element`);
    }
    if (!content.headline && !content.body) {
      notes.push('content: no text content detected, using placeholders');
    }

    sections.push({ tela, confidence, notes });
  }

  // Step 7: Assemble full document
  const overallConfidence = sections.length > 0
    ? sections.reduce((sum, s) => sum + s.confidence, 0) / sections.length
    : 0;

  const confidenceStr = overallConfidence.toFixed(2);
  const themeConfidenceStr = themeDetection.confidence;

  const docLines: string[] = [
    `# extracted from: (unknown source)`,
    `# overall confidence: ${confidenceStr}`,
    `# theme: ${themeDetection.theme} (confidence: ${themeConfidenceStr})`,
    `---`,
    `theme: ${themeDetection.theme}   # inferred`,
    `mode: landing           # inferred`,
    `---`,
    ``,
  ];

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const typeHint = detectSectionType(chunks[i]).sectionType;
    const layoutHint = detectLayout(chunks[i]);

    docLines.push(`# section ${i + 1} | type: ${typeHint} | confidence: ${s.confidence.toFixed(2)}`);
    for (const note of s.notes) {
      docLines.push(`# ${note}`);
    }
    docLines.push(s.tela);
    docLines.push('');
    if (i < sections.length - 1) {
      docLines.push('---');
      docLines.push('');
    }
  }

  const tela = docLines.join('\n');

  return {
    tela,
    sections,
    overallConfidence,
    warnings,
  };
}
