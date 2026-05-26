/**
 * Lightweight HTML parsing utilities using regex/string operations.
 * No external dependencies.
 */

export interface HtmlElement {
  tag: string;
  attrs: Record<string, string>;
  /** Approximate position (character index) in the HTML string. */
  pos: number;
  /** The raw outer HTML of the opening tag. */
  raw: string;
}

/** Extract all opening tags of a given name from HTML. */
export function findTags(html: string, tagName: string): HtmlElement[] {
  const results: HtmlElement[] = [];
  // Match opening tags (not self-closed void elements need separate handling)
  const re = new RegExp(`<${tagName}(\\s[^>]*)?>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[0];
    const attrsStr = m[1] ?? '';
    results.push({
      tag: tagName.toLowerCase(),
      attrs: parseAttrs(attrsStr),
      pos: m.index,
      raw,
    });
  }
  return results;
}

/** Parse an attribute string into a key→value map. */
export function parseAttrs(attrsStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Match: key="value", key='value', or key=value, or standalone key
  const re = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrsStr)) !== null) {
    const key = m[1].toLowerCase();
    const val = m[2] ?? m[3] ?? m[4] ?? '';
    result[key] = val;
  }
  return result;
}

/** Parse inline style string into a property→value map. */
export function parseStyle(styleStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const decl of styleStr.split(';')) {
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const val = decl.slice(colon + 1).trim();
    if (prop) result[prop] = val;
  }
  return result;
}

/** Extract all inline style objects from a block of HTML. */
export function extractAllStyles(html: string): Record<string, string>[] {
  const styles: Record<string, string>[] = [];
  const re = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const styleStr = m[1] ?? m[2] ?? '';
    styles.push(parseStyle(styleStr));
  }
  return styles;
}

/** Get text content between two tags (very naive — no nesting awareness). */
export function getTextContent(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Parse a CSS px value string and return the numeric value, or null.
 * Handles: "16px", "1.5rem" → converted at 16px/rem, "0"
 */
export function parsePx(val: string): number | null {
  const trimmed = val.trim();
  if (trimmed === '0') return 0;
  const pxMatch = /^([\d.]+)px$/.exec(trimmed);
  if (pxMatch) return parseFloat(pxMatch[1]);
  const remMatch = /^([\d.]+)rem$/.exec(trimmed);
  if (remMatch) return parseFloat(remMatch[1]) * 16;
  return null;
}

/**
 * Split a CSS shorthand value (e.g. padding: "8px 16px") into parts.
 */
export function splitShorthand(val: string): string[] {
  return val.trim().split(/\s+/);
}

/** Find all occurrences of a regex in a string. */
export function findAll(html: string, pattern: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  // Ensure global flag
  const re = pattern.global ? pattern : new RegExp(pattern.source, pattern.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    results.push(m);
  }
  return results;
}
