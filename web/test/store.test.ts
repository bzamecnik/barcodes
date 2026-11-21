import { describe, expect, it } from 'vitest';
import {
  addProduct, clearCounts, deleteProduct, emptyState, labelsToPrint, mergeProducts, orderSummary,
  parseState, ProductError, searchProducts, setCount, sortedProducts, Store, updateProduct, type State,
} from '../src/store.ts';

function withProducts(...items: [string, string][]): State {
  let s = emptyState();
  for (const [ean, description] of items) s = addProduct(s, { ean, description }).state;
  return s;
}

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(k: string) { return this.data.get(k) ?? null; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  setItem(k: string, v: string) { this.data.set(k, v); }
}

describe('products', () => {
  it('adds a product with a normalized EAN and description', () => {
    const { state, product } = addProduct(emptyState(), { ean: ' 859419970012 ', description: ' A  \r\nB \n' });
    expect(product).toMatchObject({ ean: '8594199700121', description: 'A\nB' });
    expect(state.products).toHaveLength(1);
    expect(state.lastChange).not.toBeNull();
  });

  it('rejects invalid input and duplicates', () => {
    const s = withProducts(['8594199700121', 'A']);
    expect(() => addProduct(s, { ean: '8594199700122', description: 'X' })).toThrow(ProductError);
    expect(() => addProduct(s, { ean: '8594199700138', description: ' ' })).toThrow(/empty/);
    expect(() => addProduct(s, { ean: '8594199700121', description: 'X' })).toThrow(/already exists: A/);
  });

  it('updates a product, allowing to keep its own EAN', () => {
    const s = withProducts(['8594199700121', 'A'], ['8594199700138', 'B']);
    const [a, b] = s.products;
    const s2 = updateProduct(s, a.id, { ean: a.ean, description: 'A2' });
    expect(s2.products[0].description).toBe('A2');
    expect(() => updateProduct(s, a.id, { ean: b.ean, description: 'A' })).toThrow(/already exists/);
  });

  it('deletes a product with its count', () => {
    let s = withProducts(['8594199700121', 'A']);
    const id = s.products[0].id;
    s = setCount(s, id, 3);
    s = deleteProduct(s, id);
    expect(s.products).toEqual([]);
    expect(s.counts).toEqual({});
  });
});

describe('counts', () => {
  it('sets, clamps and clears counts', () => {
    let s = withProducts(['8594199700121', 'A']);
    const id = s.products[0].id;
    s = setCount(s, id, 2.7);
    expect(s.counts[id]).toBe(2);
    s = setCount(s, id, 1e9);
    expect(s.counts[id]).toBe(9999);
    s = setCount(s, id, -1);
    expect(s.counts).toEqual({});
    s = clearCounts(setCount(s, id, 5));
    expect(s.counts).toEqual({});
  });

  it('lists labels in product order after the skipped stickers', () => {
    let s = withProducts(['8594199700138', 'B'], ['8594199700121', 'A']);
    const [b, a] = s.products;
    s = setCount(setCount(s, b.id, 1), a.id, 2);
    expect(labelsToPrint(s).map((l) => l.description)).toEqual(['A', 'A', 'B']);
    s = { ...s, settings: { ...s.settings, startPosition: 3 } };
    expect(labelsToPrint(s).map((l) => l.ean)).toEqual(['', '', a.ean, a.ean, b.ean]);
    expect(orderSummary(s)).toEqual({ stickers: 3, products: 2, sheets: 1 });
    s = { ...s, settings: { ...s.settings, startPosition: 23 } };
    expect(orderSummary(s).sheets).toBe(2);
    expect(labelsToPrint(clearCounts(s))).toEqual([]);
  });
});

describe('sorting and searching', () => {
  const s = withProducts(
    ['8594199700220', '3DXTECH\nFLUORX\n1.75 mm'],
    ['8594199700121', '3DXTECH\n3DXSTAT\n1.75 mm'],
    ['8594199700138', '3DXTECH\n3DXSTAT\n2.85 mm'],
  );
  it('sorts by description', () => {
    expect(sortedProducts(s.products).map((p) => p.ean))
      .toEqual(['8594199700121', '8594199700138', '8594199700220']);
  });
  it('searches all words in description and EAN, case-insensitively', () => {
    expect(searchProducts(s.products, 'dxstat 2.85').map((p) => p.ean)).toEqual(['8594199700138']);
    expect(searchProducts(s.products, '700220')).toHaveLength(1);
    expect(searchProducts(s.products, '  ')).toHaveLength(3);
  });
});

describe('mergeProducts', () => {
  it('adds new, updates changed and reports errors', () => {
    const s = withProducts(['8594199700121', 'A'], ['8594199700138', 'B']);
    const r = mergeProducts(s, [
      { ean: '8594199700121', description: 'A' },
      { ean: '8594199700138', description: 'B2', count: 4 },
      { ean: '8594199700220', description: 'C' },
      { ean: '123', description: 'bad', source: 'row 5' },
    ]);
    expect([r.added, r.updated, r.unchanged]).toEqual([1, 1, 1]);
    expect(r.errors).toEqual(['row 5: EAN must have 13 digits (has 3)']);
    expect(r.state.products.map((p) => p.description)).toEqual(['A', 'B2', 'C']);
    expect(r.state.counts[s.products[1].id]).toBe(4);
  });
});

describe('persistence', () => {
  it('saves and loads the state', () => {
    const storage = new MemoryStorage();
    const store = new Store(storage);
    store.update((s) => addProduct(s, { ean: '8594199700121', description: 'A' }).state);
    const loaded = new Store(storage).state;
    expect(loaded.products[0].description).toBe('A');
  });

  it('keeps corrupt data aside and starts empty', () => {
    const storage = new MemoryStorage();
    storage.setItem('barcodes:v1', '{not json');
    expect(new Store(storage).state.products).toEqual([]);
    expect([...storage.data.keys()].some((k) => k.startsWith('barcodes:v1:corrupt:'))).toBe(true);
  });

  it('notifies subscribers', () => {
    const store = new Store(null);
    const calls: number[] = [];
    store.subscribe((s, prev) => calls.push(s.products.length - prev.products.length));
    store.update((s) => addProduct(s, { ean: '8594199700121', description: 'A' }).state);
    expect(calls).toEqual([1]);
  });

  it('sanitizes loaded data', () => {
    const s = parseState({
      products: [{ id: '1', ean: '8594199700121', description: 'A' }, { bad: true }],
      counts: { 1: '3', 2: -5 },
      settings: { startPosition: 99, showBorder: 'yes' },
    });
    expect(s.products).toHaveLength(1);
    expect(s.counts).toEqual({ 1: 3 });
    expect(s.settings).toMatchObject({ startPosition: 24, showBorder: true, logo: null });
  });
});
