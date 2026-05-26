/**
 * Asset cache — downloads external libraries and caches them locally
 * so the renderer can inline them into HTML output for offline/headless use.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CACHE_DIR = join(homedir(), '.tela', 'cache');

const CHARTJS_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
const CHARTJS_CACHE_PATH = join(CACHE_DIR, 'chartjs-4.min.js');

// In-process memory cache so we only read disk once per process
let _chartJsSource: string | null = null;

/**
 * Return the cached Chart.js source synchronously, or null if not yet fetched.
 */
export function getChartJsSync(): string | null {
  if (_chartJsSource) return _chartJsSource;
  if (existsSync(CHARTJS_CACHE_PATH)) {
    _chartJsSource = readFileSync(CHARTJS_CACHE_PATH, 'utf-8');
    return _chartJsSource;
  }
  return null;
}

/**
 * Ensure Chart.js is cached locally. Downloads if necessary.
 * Safe to call multiple times — idempotent.
 */
export async function ensureChartJs(): Promise<string> {
  const cached = getChartJsSync();
  if (cached) return cached;

  mkdirSync(CACHE_DIR, { recursive: true });

  const response = await fetch(CHARTJS_URL);
  if (!response.ok) {
    throw new Error(`Failed to download Chart.js: ${response.status} ${response.statusText}`);
  }
  const source = await response.text();

  writeFileSync(CHARTJS_CACHE_PATH, source, 'utf-8');
  _chartJsSource = source;
  return source;
}

/** Clear the in-process memory cache (for testing). */
export function _clearChartJsCache(): void {
  _chartJsSource = null;
}
