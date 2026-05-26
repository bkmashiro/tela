/**
 * Token system types for Tela.
 */

export type TokenNamespace =
  | 'color.surface'
  | 'color.text'
  | 'color.border'
  | 'color.accent'
  | 'space'
  | 'type.scale'
  | 'type.weight'
  | 'type.leading'
  | 'type.family'
  | 'elevation'
  | 'radius';

/** Flat map of all token path → raw value (CSS string or number). */
export type TokenMap = Record<string, string | number>;

export interface ResolvedTokens {
  /** Flat map from CSS custom property name to value. */
  values: Record<string, string>;
  /** Tokens that were overridden by the user. */
  overrides: string[];
  /** Theme that was used as the base. */
  theme: string;
}

export type ThemeName =
  | 'warm-editorial'
  | 'cool-technical'
  | 'neutral-minimal'
  | 'dark-dramatic';

export const THEME_NAMES: ThemeName[] = [
  'warm-editorial',
  'cool-technical',
  'neutral-minimal',
  'dark-dramatic',
];
