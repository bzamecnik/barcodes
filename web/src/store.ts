// Application state: the product library, the counts of stickers to print
// and settings. Persisted as JSON in localStorage.
//
// The state is immutable: the functions below return a new state and the
// Store notifies subscribers about the change.

import { validateEan } from './ean13.ts';
import type { LanguageSetting } from './i18n.ts';
import { t } from './i18n.ts';
import { LABELS_PER_PAGE, type Label } from './labels.ts';

export interface Product {
  id: string;
  /** normalized 13-digit EAN */
  ean: string;
  description: string;
}

export interface Settings {
  /** logo image as a data URL (PNG or JPEG) */
  logo: string | null;
  logoName: string | null;
  showBorder: boolean;
  /** 1-based index of the first sticker to use on the first sheet */
  startPosition: number;
  /** language of the UI, 'auto' follows the browser */
  language: LanguageSetting;
}

export interface State {
  products: Product[];
  /** number of stickers to print, by product id */
  counts: Record<string, number>;
  settings: Settings;
  /** ISO timestamp of the last change of products or logo */
  lastChange: string | null;
  /** ISO timestamp of the last backup export */
  lastBackup: string | null;
}

export const MAX_COUNT = 9999;

export function emptyState(): State {
  return {
    products: [],
    counts: {},
    settings: { logo: null, logoName: null, showBorder: false, startPosition: 1, language: 'auto' },
    lastChange: null,
    lastBackup: null,
  };
}

export class ProductError extends Error {}

export interface ProductInput {
  ean: string;
  description: string;
}

/** Normalize line endings and trailing whitespace. */
export function normalizeDescription(description: string): string {
  return description.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim();
}

function now(): string {
  return new Date().toISOString();
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function checkInput(state: State, input: ProductInput, exceptId?: string): ProductInput {
  const v = validateEan(input.ean);
  if (!v.ok) throw new ProductError(v.error);
  const description = normalizeDescription(input.description);
  if (!description) throw new ProductError(t.descriptionEmpty);
  const duplicate = state.products.find((p) => p.ean === v.code && p.id !== exceptId);
  if (duplicate) {
    throw new ProductError(t.eanExists(v.code, firstLine(duplicate.description)));
  }
  return { ean: v.code, description };
}

export function firstLine(description: string): string {
  return description.split('\n')[0];
}

export function findByEan(state: State, ean: string): Product | undefined {
  const v = validateEan(ean);
  return v.ok ? state.products.find((p) => p.ean === v.code) : undefined;
}

export function addProduct(state: State, input: ProductInput): { state: State; product: Product } {
  const product = { id: newId(), ...checkInput(state, input) };
  return {
    state: { ...state, products: [...state.products, product], lastChange: now() },
    product,
  };
}

export function updateProduct(state: State, id: string, input: ProductInput): State {
  const checked = checkInput(state, input, id);
  return {
    ...state,
    products: state.products.map((p) => (p.id === id ? { ...p, ...checked } : p)),
    lastChange: now(),
  };
}

export function deleteProduct(state: State, id: string): State {
  const { [id]: _, ...counts } = state.counts;
  return {
    ...state,
    products: state.products.filter((p) => p.id !== id),
    counts,
    lastChange: now(),
  };
}

export function clampCount(n: number): number {
  return Number.isFinite(n) ? Math.min(MAX_COUNT, Math.max(0, Math.floor(n))) : 0;
}

export function setCount(state: State, id: string, count: number): State {
  const counts = { ...state.counts };
  const n = clampCount(count);
  if (n > 0) counts[id] = n;
  else delete counts[id];
  return { ...state, counts };
}

export function clearCounts(state: State): State {
  return { ...state, counts: {} };
}

export interface MergeResult {
  state: State;
  added: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

/**
 * Merge imported products into the library, matching them by EAN. Existing
 * products get the imported description. Counts are set if given.
 */
export function mergeProducts(
  state: State,
  items: (ProductInput & { count?: number; source?: string })[],
): MergeResult {
  let s = state;
  let added = 0, updated = 0, unchanged = 0;
  const errors: string[] = [];
  for (const item of items) {
    const where = item.source ? `${item.source}: ` : '';
    try {
      const existing = findByEan(s, item.ean);
      let id: string;
      if (existing) {
        id = existing.id;
        if (normalizeDescription(item.description) === existing.description) {
          unchanged++;
        } else {
          s = updateProduct(s, existing.id, item);
          updated++;
        }
      } else {
        const r = addProduct(s, item);
        s = r.state;
        id = r.product.id;
        added++;
      }
      if (item.count !== undefined) s = setCount(s, id, item.count);
    } catch (e) {
      errors.push(where + (e instanceof Error ? e.message : String(e)));
    }
  }
  return { state: s, added, updated, unchanged, errors };
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Products sorted by description (so that a supplier's products are together). */
export function sortedProducts(products: Product[]): Product[] {
  return [...products].sort((a, b) =>
    collator.compare(a.description, b.description) || a.ean.localeCompare(b.ean));
}

/** Plain-text description on one line, for searching and display. */
export function oneLine(description: string): string {
  return description.split('\n').join(' · ');
}

export function searchProducts(products: Product[], query: string): Product[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return products;
  return products.filter((p) => {
    const text = `${p.ean} ${p.description.replace(/\n/g, ' ')}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** Labels to print, in the order of the product list, after the skipped stickers. */
export function labelsToPrint(state: State): Label[] {
  const skipped = Array.from({ length: state.settings.startPosition - 1 },
    () => ({ ean: '', description: '' }));
  const labels = sortedProducts(state.products).flatMap((p) =>
    Array.from({ length: state.counts[p.id] ?? 0 }, () => ({ ean: p.ean, description: p.description })));
  return labels.length ? [...skipped, ...labels] : [];
}

export function orderSummary(state: State): { stickers: number; products: number; sheets: number } {
  const ids = new Set(state.products.map((p) => p.id));
  let stickers = 0, products = 0;
  for (const [id, n] of Object.entries(state.counts)) {
    if (ids.has(id) && n > 0) {
      stickers += n;
      products++;
    }
  }
  const sheets = stickers ? Math.ceil((state.settings.startPosition - 1 + stickers) / LABELS_PER_PAGE) : 0;
  return { stickers, products, sheets };
}

// --- persistence ---

const STORAGE_KEY = 'barcodes:v1';

/** Validate and fill in defaults of a state loaded from storage or a backup. */
export function parseState(raw: unknown): State {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<State>;
  const products = Array.isArray(r.products)
    ? r.products.filter((p): p is Product =>
      !!p && typeof p.id === 'string' && typeof p.ean === 'string' && typeof p.description === 'string')
    : [];
  const counts: Record<string, number> = {};
  if (r.counts && typeof r.counts === 'object') {
    for (const [id, n] of Object.entries(r.counts)) {
      const c = clampCount(Number(n));
      if (c > 0) counts[id] = c;
    }
  }
  const settings = { ...base.settings, ...(r.settings ?? {}) };
  settings.startPosition = Math.min(LABELS_PER_PAGE, Math.max(1, Math.floor(Number(settings.startPosition) || 1)));
  settings.showBorder = !!settings.showBorder;
  if (!(['auto', 'en', 'cs'] as unknown[]).includes(settings.language)) settings.language = 'auto';
  return {
    products,
    counts,
    settings,
    lastChange: typeof r.lastChange === 'string' ? r.lastChange : null,
    lastBackup: typeof r.lastBackup === 'string' ? r.lastBackup : null,
  };
}

type Listener = (state: State, previous: State) => void;

export class Store {
  #state: State;
  #listeners = new Set<Listener>();
  #storage: Storage | null;
  /** error of the last save, e.g. when the storage quota is exceeded */
  saveError: string | null = null;

  constructor(storage: Storage | null) {
    this.#storage = storage;
    this.#state = this.#load();
  }

  get state(): State {
    return this.#state;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  set(state: State): void {
    const previous = this.#state;
    if (state === previous) return;
    this.#state = state;
    this.#save();
    for (const listener of this.#listeners) listener(state, previous);
  }

  update(fn: (state: State) => State): void {
    this.set(fn(this.#state));
  }

  #load(): State {
    if (!this.#storage) return emptyState();
    let text: string | null = null;
    try {
      text = this.#storage.getItem(STORAGE_KEY);
      return text ? parseState(JSON.parse(text)) : emptyState();
    } catch {
      // keep unreadable data aside instead of overwriting it
      try {
        if (text) this.#storage.setItem(`${STORAGE_KEY}:corrupt:${Date.now()}`, text);
      } catch { /* ignore */ }
      return emptyState();
    }
  }

  #save(): void {
    if (!this.#storage) return;
    try {
      this.#storage.setItem(STORAGE_KEY, JSON.stringify(this.#state));
      this.saveError = null;
    } catch (e) {
      this.saveError = e instanceof Error ? e.message : String(e);
    }
  }
}
