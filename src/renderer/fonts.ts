/**
 * Font loading strategy for Tela renderer.
 * Maps font family names to Google Fonts parameters.
 */

const GOOGLE_FONTS: Record<string, string> = {
  'Inter': 'Inter:wght@400;500;600',
  'Source Serif 4': 'Source+Serif+4:wght@400;500;600',
  'EB Garamond': 'EB+Garamond:wght@400;500',
  'Playfair Display': 'Playfair+Display:wght@400;600',
  'IBM Plex Mono': 'IBM+Plex+Mono:wght@400',
  'JetBrains Mono': 'JetBrains+Mono:wght@400',
  // System fonts — no load needed
  'Charter': '',
  'Georgia': '',
  '-apple-system': '',
};

/**
 * Extract the primary font name from a font-family stack value.
 * e.g. "'Inter', 'SF Pro Display', ..." → "Inter"
 */
function extractPrimaryFont(familyValue: string): string {
  const first = familyValue.split(',')[0].trim().replace(/['"]/g, '');
  return first;
}

/**
 * Generate Google Fonts <link> tags for a set of resolved token values.
 */
export function generateFontLinks(tokenValues: Record<string, string>): string {
  const families: string[] = [];

  for (const [key, value] of Object.entries(tokenValues)) {
    if (key.startsWith('--t-family-')) {
      const primaryFont = extractPrimaryFont(value);
      const gfParam = GOOGLE_FONTS[primaryFont];
      if (gfParam === undefined) {
        // Unknown font — attempt to load it anyway with default weights
        const encoded = primaryFont.replace(/ /g, '+');
        families.push(`${encoded}:wght@400;500;600`);
      } else if (gfParam !== '') {
        families.push(gfParam);
      }
      // '' means system font, skip
    }
  }

  // Always include Noto Sans Symbols as a universal fallback for geometric/symbol glyphs
  // (covers U+25A0–U+25FF and other symbol blocks that decorated serif fonts lack)
  families.push('Noto+Sans+Symbols:wght@400');

  // Deduplicate
  const unique = [...new Set(families)];
  if (unique.length === 0) return '';

  const familyParams = unique.map((f) => `family=${f}`).join('&');
  const url = `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;

  return [
    `<link rel="preconnect" href="https://fonts.googleapis.com">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `<link href="${url}" rel="stylesheet">`,
  ].join('\n  ');
}
