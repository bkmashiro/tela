/**
 * Component registry — maps block types to render functions.
 */

import type { ComponentDefinition } from '../renderer/types.js';

import { renderHero } from './hero.js';
import { renderFeature } from './feature.js';
import { renderGrid, renderFeatures } from './grid.js';
import { renderProse } from './prose.js';
import { renderQuote, renderTestimonial } from './quote.js';
import { renderCta } from './cta.js';
import { renderFigure, renderGallery } from './figure.js';
import { renderAside } from './aside.js';
import { renderDivider } from './divider.js';
import { renderFooter } from './footer.js';
import { renderNav } from './nav.js';
import { renderStack, renderSplit, renderCentered } from './stack.js';
import { renderTabs } from './tabs.js';
import { renderAccordion } from './accordion.js';
import { renderModal } from './modal.js';
import { renderToggle } from './toggle.js';

export const COMPONENT_REGISTRY: Record<string, ComponentDefinition> = {
  hero: {
    name: 'hero',
    render: renderHero,
    validModifiers: ['split', 'pad', 'bg', 'centered', 'inverted', 'bleed', 'id'],
    requiredProps: ['headline'],
  },
  feature: {
    name: 'feature',
    render: renderFeature,
    validModifiers: ['accent', 'muted', 'pad', 'rounded', 'shadow', 'bg'],
    requiredProps: ['title'],
  },
  features: {
    name: 'features',
    render: renderFeatures,
    validModifiers: ['grid', 'gap', 'pad', 'bg', 'bleed'],
  },
  grid: {
    name: 'grid',
    render: renderGrid,
    validModifiers: ['grid', 'gap', 'pad', 'bg', 'bleed'],
  },
  prose: {
    name: 'prose',
    render: renderProse,
    validModifiers: ['pad', 'centered', 'bg', 'muted'],
    requiredProps: ['body'],
  },
  quote: {
    name: 'quote',
    render: renderQuote,
    validModifiers: ['accent', 'centered', 'pad', 'bg'],
    requiredProps: ['text'],
  },
  testimonial: {
    name: 'testimonial',
    render: renderTestimonial,
    validModifiers: ['pad', 'rounded', 'shadow', 'bg'],
    requiredProps: ['text', 'name'],
  },
  cta: {
    name: 'cta',
    render: renderCta,
    validModifiers: ['centered', 'pad', 'bg', 'inverted', 'accent'],
    requiredProps: ['headline'],
  },
  figure: {
    name: 'figure',
    render: renderFigure,
    validModifiers: ['aspect', 'rounded', 'shadow', 'bleed', 'float', 'centered'],
    requiredProps: ['src'],
  },
  gallery: {
    name: 'gallery',
    render: renderGallery,
    validModifiers: ['grid', 'gap', 'pad', 'masonry'],
  },
  aside: {
    name: 'aside',
    render: renderAside,
    validModifiers: ['pad', 'bg', 'rounded'],
    requiredProps: ['body'],
  },
  divider: {
    name: 'divider',
    render: renderDivider,
    validModifiers: ['muted', 'accent'],
  },
  footer: {
    name: 'footer',
    render: renderFooter,
    validModifiers: ['pad', 'bg', 'inverted'],
  },
  nav: {
    name: 'nav',
    render: renderNav,
    validModifiers: ['pad', 'bg', 'inverted', 'sticky'],
    requiredProps: ['brand'],
  },
  // Generic layout containers
  stack: {
    name: 'stack',
    render: renderStack,
    validModifiers: ['gap', 'pad', 'bleed'],
  },
  split: {
    name: 'split',
    render: renderSplit,
    validModifiers: ['split', 'gap', 'pad'],
  },
  centered: {
    name: 'centered',
    render: renderCentered,
    validModifiers: ['pad'],
  },
  tabs: {
    name: 'tabs',
    render: renderTabs,
    validModifiers: ['pad', 'bg', 'inverted'],
    requiredProps: [],
  },
  accordion: {
    name: 'accordion',
    render: renderAccordion,
    validModifiers: ['pad', 'bg'],
    requiredProps: [],
  },
  modal: {
    name: 'modal',
    render: renderModal,
    validModifiers: ['pad', 'trigger'],
    requiredProps: [],
  },
  toggle: {
    name: 'toggle',
    render: renderToggle,
    validModifiers: ['label', 'pad', 'centered'],
    requiredProps: [],
  },
};

/** List all available component names. */
export function listComponents(): Array<{
  name: string;
  validModifiers: string[];
  requiredProps: string[];
}> {
  return Object.values(COMPONENT_REGISTRY).map((c) => ({
    name: c.name,
    validModifiers: c.validModifiers ?? [],
    requiredProps: c.requiredProps ?? [],
  }));
}
