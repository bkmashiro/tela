/**
 * SiteStore — manages multi-page sites composed of Tela documents.
 */

import { randomUUID } from 'crypto';
import { DocumentStore } from './store.js';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

export interface SitePage {
  slug: string;  // 'index', 'docs', 'about', 'docs/api'
  docId: string;
}

export interface Site {
  id: string;
  name: string;
  theme?: string;
  pages: SitePage[];
  createdAt: number;
}

export interface SiteRenderResult {
  outputDir: string;
  pages: Array<{ slug: string; htmlPath: string }>;
}

export class SiteStore {
  private sites: Map<string, Site> = new Map();

  constructor(private docStore: DocumentStore) {}

  createSite(name: string, theme?: string): string {
    const id = `site-${randomUUID().slice(0, 8)}`;
    this.sites.set(id, {
      id,
      name,
      theme,
      pages: [],
      createdAt: Date.now(),
    });
    return id;
  }

  addPage(siteId: string, slug: string, docId: string): void {
    const site = this.sites.get(siteId);
    if (!site) throw new Error(`Site not found: ${siteId}`);
    // Remove existing page with same slug
    site.pages = site.pages.filter(p => p.slug !== slug);
    site.pages.push({ slug, docId });
  }

  removePage(siteId: string, slug: string): void {
    const site = this.sites.get(siteId);
    if (!site) throw new Error(`Site not found: ${siteId}`);
    site.pages = site.pages.filter(p => p.slug !== slug);
  }

  listPages(siteId: string): SitePage[] {
    const site = this.sites.get(siteId);
    if (!site) throw new Error(`Site not found: ${siteId}`);
    return [...site.pages];
  }

  getSite(siteId: string): Site {
    const site = this.sites.get(siteId);
    if (!site) throw new Error(`Site not found: ${siteId}`);
    return site;
  }

  listSites(): Site[] {
    return Array.from(this.sites.values());
  }

  async renderSite(siteId: string, outDir: string): Promise<SiteRenderResult> {
    const site = this.sites.get(siteId);
    if (!site) throw new Error(`Site not found: ${siteId}`);

    const results: Array<{ slug: string; htmlPath: string }> = [];
    const allSlugs = site.pages.map(p => p.slug);

    for (const page of site.pages) {
      // Determine output path
      let htmlPath: string;
      if (page.slug === 'index') {
        htmlPath = join(outDir, 'index.html');
      } else {
        htmlPath = join(outDir, page.slug, 'index.html');
      }

      // Render with basePath for link resolution
      const basePath = page.slug === 'index' ? '' : page.slug;
      const renderResult = this.docStore.renderDocument(page.docId, {
        basePath,
        sitePages: allSlugs,
      });

      // Write rendered HTML to correct location
      mkdirSync(dirname(htmlPath), { recursive: true });
      writeFileSync(htmlPath, renderResult.html, 'utf-8');

      results.push({ slug: page.slug, htmlPath });
    }

    return { outputDir: outDir, pages: results };
  }
}
