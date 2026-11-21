// The product library: search (also by scanning an EAN), counts of stickers
// to print for each product and a summary of the order.

import { validateEan } from '../ean13.ts';
import { t } from '../i18n.ts';
import {
  clearCounts, findByEan, firstLine, oneLine, orderSummary, searchProducts, setCount, sortedProducts,
  type Product, type State, type Store,
} from '../store.ts';
import { byId, h, icon } from './dom.ts';
import { icons } from './icons.ts';

export interface ProductListActions {
  addProduct(prefill?: { ean?: string }): void;
  editProduct(product: Product): void;
  /** extra buttons for the empty library, e.g. import */
  emptyLibraryActions(): HTMLElement[];
}

interface Row {
  li: HTMLLIElement;
  input: HTMLInputElement;
}

export interface ProductList {
  /** scroll to a product, briefly highlight it and optionally focus its count */
  reveal(id: string, focusCount?: boolean): void;
  showStatus(text: string, kind?: 'info' | 'error'): void;
}

export function setupProductList(store: Store, actions: ProductListActions): ProductList {
  const search = byId<HTMLInputElement>('search');
  const onlySelected = byId<HTMLInputElement>('only-selected');
  const list = byId<HTMLUListElement>('product-list');
  const empty = byId('list-empty');
  const total = byId('product-total');
  const statusEl = byId('list-status');
  const summary = byId('order-summary');
  const clearButton = byId<HTMLButtonElement>('clear-counts');
  const rows = new Map<string, Row>();
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  const changeCount = (id: string, delta: number) =>
    store.update((s) => setCount(s, id, (s.counts[id] ?? 0) + delta));

  function row(p: Product): HTMLLIElement {
    const [title, ...rest] = p.description.split('\n');
    const label = oneLine(p.description);
    const input = h('input', {
      type: 'number',
      min: '0',
      max: '9999',
      inputMode: 'numeric',
      placeholder: '0',
      class: 'count-input',
      attrs: { 'aria-label': t.countLabel(label) },
      on: {
        input: () => store.update((s) => setCount(s, p.id, Number(input.value))),
        focus: () => input.select(),
        keydown: (e) => {
          // Enter jumps back to the search box, ready for the next product
          if (e.key === 'Enter') {
            e.preventDefault();
            search.focus();
          }
        },
      },
    });
    const li = h('li', { class: 'product', dataset: { id: p.id } },
      h('button', {
        type: 'button',
        class: 'product-main',
        title: t.editProduct,
        on: { click: () => actions.editProduct(p) },
      },
      h('span', { class: 'product-name' },
        h('strong', {}, title),
        rest.length ? h('span', { class: 'muted' }, ' · ' + rest.join(' · ')) : null),
      h('span', { class: 'product-ean' }, p.ean)),
      h('div', { class: 'stepper' },
        h('button', {
          type: 'button',
          class: 'step',
          tabIndex: -1,
          attrs: { 'aria-label': t.oneLess(label) },
          on: { click: () => changeCount(p.id, -1) },
        }, icon(icons.minus)),
        input,
        h('button', {
          type: 'button',
          class: 'step',
          tabIndex: -1,
          attrs: { 'aria-label': t.oneMore(label) },
          on: { click: () => changeCount(p.id, 1) },
        }, icon(icons.plus))));
    rows.set(p.id, { li, input });
    return li;
  }

  function render(): void {
    const state = store.state;
    const all = sortedProducts(state.products);
    const query = search.value.trim();
    let visible = searchProducts(all, query);
    if (onlySelected.checked) visible = visible.filter((p) => (state.counts[p.id] ?? 0) > 0);

    rows.clear();
    list.replaceChildren(...visible.map(row));
    syncCounts(state);

    total.textContent = visible.length === all.length
      ? t.productCount(all.length)
      : t.visibleOfTotal(visible.length, all.length);

    empty.hidden = visible.length > 0;
    if (visible.length === 0) empty.replaceChildren(...emptyContent(all.length, query));
  }

  function emptyContent(count: number, query: string): HTMLElement[] {
    if (count === 0) {
      return [
        h('p', {}, h('strong', {}, t.libraryEmpty)),
        h('p', { class: 'muted' }, t.libraryEmptyHint),
        h('div', { class: 'buttons' },
          h('button', { type: 'button', class: 'btn primary', on: { click: () => actions.addProduct() } },
            icon(icons.plus), t.addProduct),
          ...actions.emptyLibraryActions()),
      ];
    }
    const result: HTMLElement[] = [];
    if (query) {
      result.push(h('p', {}, t.noMatch(query)));
      const v = validateEan(query.replace(/\s/g, ''));
      if (v.ok && !findByEan(store.state, v.code)) {
        result.push(h('div', { class: 'buttons' },
          h('button', {
            type: 'button',
            class: 'btn',
            on: { click: () => actions.addProduct({ ean: v.code }) },
          }, icon(icons.plus), t.addProductWithEan(v.code))));
      }
    } else {
      result.push(h('p', { class: 'muted' }, t.noneSelected));
    }
    return result;
  }

  function syncCounts(state: State): void {
    for (const [id, { li, input }] of rows) {
      const n = state.counts[id] ?? 0;
      li.classList.toggle('selected', n > 0);
      // don't overwrite what the user is typing (e.g. an empty field while
      // retyping), but do update after the +/- buttons
      if (document.activeElement !== input || Number(input.value) !== n) {
        input.value = n ? String(n) : '';
      }
    }
    const { stickers, products, sheets } = orderSummary(state);
    const text = t.orderSummary(stickers, products, sheets);
    summary.replaceChildren(stickers
      ? h('span', {}, h('strong', {}, text.stickers), text.rest)
      : h('span', { class: 'muted' }, t.noStickersSelected));
    clearButton.disabled = stickers === 0;
  }

  function showStatus(text: string, kind: 'info' | 'error' = 'info'): void {
    statusEl.textContent = text;
    statusEl.className = `status ${kind}`;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusEl.textContent = '';
    }, 5000);
  }

  function reveal(id: string, focusCount = false): void {
    let r = rows.get(id);
    if (!r) {
      // make sure the product is visible
      search.value = '';
      onlySelected.checked = false;
      render();
      r = rows.get(id);
    }
    if (!r) return;
    r.li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    r.li.classList.remove('flash');
    void r.li.offsetWidth; // restart the animation
    r.li.classList.add('flash');
    if (focusCount) r.input.focus();
  }

  // A barcode scanner types the EAN followed by Enter.
  function onSearchEnter(): void {
    const query = search.value.trim();
    if (/^\d{12,13}$/.test(query)) {
      const product = findByEan(store.state, query);
      if (product) {
        changeCount(product.id, 1);
        search.value = '';
        render();
        reveal(product.id);
        showStatus(t.scanned(firstLine(product.description), store.state.counts[product.id]));
        return;
      }
      const v = validateEan(query);
      if (v.ok) {
        actions.addProduct({ ean: v.code });
      } else {
        showStatus(`${query}: ${v.error}`, 'error');
      }
      return;
    }
    // a single match: go to its count
    const inputs = [...rows.values()];
    if (inputs.length === 1) inputs[0].input.focus();
  }

  search.addEventListener('input', render);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearchEnter();
    }
  });
  onlySelected.addEventListener('change', render);
  clearButton.addEventListener('click', () => {
    const { stickers } = orderSummary(store.state);
    if (confirm(t.confirmClearCounts(stickers))) {
      store.update(clearCounts);
      onlySelected.checked = false;
      render();
    }
  });

  store.subscribe((state, previous) => {
    if (state.products !== previous.products) render();
    else if (state.counts !== previous.counts) syncCounts(state);
  });
  render();

  return { reveal, showStatus };
}
