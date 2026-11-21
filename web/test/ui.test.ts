// @vitest-environment happy-dom
// Smoke test of the whole page: it loads index.html, runs main.ts and
// clicks through the main workflow.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  // happy-dom can't load scripts and frames (the test imports main.ts itself
  // and only checks the visibility of the preview)
  .replace(/<script[^>]*><\/script>/g, '')
  .replace(/<iframe([^>]*)><\/iframe>/g, '<div$1></div>');

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
function enter(el: HTMLElement) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}
const rowNames = () => $$('.product .product-name strong').map((e) => e.textContent);
const counts = () => $$('.count-input').map((e) => (e as HTMLInputElement).value);
const summary = () => $('#order-summary').textContent;

async function loadApp() {
  vi.resetModules();
  document.body.innerHTML = body;
  await import('../src/main.ts');
}

beforeAll(() => {
  // not implemented in happy-dom
  URL.createObjectURL ??= () => 'blob:test';
  URL.revokeObjectURL ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  for (const name of ['showModal', 'close'] as const) {
    if (!HTMLDialogElement.prototype[name]) {
      HTMLDialogElement.prototype[name] = function (this: HTMLDialogElement) {
        this.open = name === 'showModal';
      };
    }
  }
});

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('confirm', () => true);
});

describe('app', () => {
  it('starts empty and loads sample products', async () => {
    await loadApp();
    expect($('#list-empty').hidden).toBe(false);
    expect($('#list-empty').textContent).toMatch(/library is empty/);
    expect(summary()).toBe('No stickers selected');
    expect($('#download-pdf').getAttribute('aria-disabled')).toBe('true');

    $$('#list-empty button').find((b) => /sample/.test(b.textContent!))!.click();
    expect(rowNames()).toHaveLength(4);
    expect($('#product-total').textContent).toBe('4 products');
  });

  it('sets counts with the stepper and typing, persists them and makes a PDF', async () => {
    await loadApp();
    $$('#list-empty button').find((b) => /sample/.test(b.textContent!))!.click();

    const plus = $$('.product')[0].querySelectorAll<HTMLButtonElement>('.step')[1];
    plus.click();
    plus.click();
    type($$('.count-input')[2] as HTMLInputElement, '25');
    expect(counts()).toEqual(['2', '', '25', '']);
    expect(summary()).toBe('27 stickers of 2 products on 2 sheets');
    expect($$('.product.selected')).toHaveLength(2);

    // the preview is debounced
    await new Promise((r) => setTimeout(r, 300));
    expect($('#download-pdf').getAttribute('aria-disabled')).toBe('false');
    expect($<HTMLIFrameElement>('#preview').hidden).toBe(false);

    // reload: everything is still there
    await loadApp();
    expect(counts()).toEqual(['2', '', '25', '']);

    $<HTMLInputElement>('#only-selected').click();
    expect(rowNames()).toHaveLength(2);

    $<HTMLButtonElement>('#clear-counts').click();
    expect(summary()).toBe('No stickers selected');
  });

  it('searches and counts scanned EANs', async () => {
    await loadApp();
    $$('#list-empty button').find((b) => /sample/.test(b.textContent!))!.click();
    const search = $<HTMLInputElement>('#search');

    type(search, 'fluorx');
    expect(rowNames()).toEqual(['3DXTECH']);
    expect($('#product-total').textContent).toBe('1 of 4');

    // a scanner types the code and Enter, twice
    for (let i = 0; i < 2; i++) {
      type(search, '8594199700541');
      enter(search);
    }
    expect(search.value).toBe('');
    expect(rowNames()).toHaveLength(4);
    expect(summary()).toBe('2 stickers of 1 product on 1 sheet');
    expect($('#list-status').textContent).toBe('+1 3DXTECH – now 2');

    // an unknown valid EAN opens the dialog to add it
    type(search, '4006381333931');
    enter(search);
    expect($<HTMLDialogElement>('#product-dialog').open).toBe(true);
    expect($<HTMLInputElement>('#product-ean').value).toBe('4006381333931');
  });

  it('adds, validates, edits and deletes products', async () => {
    await loadApp();
    $<HTMLButtonElement>('#add-product').click();
    const dialog = $<HTMLDialogElement>('#product-dialog');
    const ean = $<HTMLInputElement>('#product-ean');
    const description = $<HTMLTextAreaElement>('#product-description');
    const save = () => $<HTMLFormElement>('#product-form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(dialog.open).toBe(true);

    type(ean, '400638133393');
    expect($('#product-ean-hint').textContent).toMatch(/check digit 1 will be added/);
    type(ean, '4006381333932');
    expect($('#product-ean-hint').textContent).toMatch(/Wrong check digit/);
    type(description, 'Faber-Castell\nA pencil with a much too long description line');
    expect($('#product-warnings').textContent).toMatch(/too long/);

    save();
    expect(dialog.open).toBe(true);
    expect($('#product-error').textContent).toMatch(/check digit/);

    type(ean, '4006381333931');
    type(description, 'Faber-Castell\nPencil');
    save();
    expect(dialog.open).toBe(false);
    expect(rowNames()).toEqual(['Faber-Castell']);
    // a new product gets the focus on its count
    expect(document.activeElement).toBe($('.count-input'));

    // duplicate EAN
    $<HTMLButtonElement>('#add-product').click();
    type(ean, '4006381333931');
    expect($('#product-ean-hint').textContent).toMatch(/Already in the library: Faber-Castell/);

    // edit
    $<HTMLButtonElement>('.product-main').click();
    expect($('#product-dialog-title').textContent).toBe('Edit product');
    expect(ean.value).toBe('4006381333931');
    type(description, 'Faber-Castell\nPencil HB');
    save();
    expect($('.product-name').textContent).toBe('Faber-Castell · Pencil HB');

    // delete
    $<HTMLButtonElement>('.product-main').click();
    $<HTMLButtonElement>('#product-delete').click();
    expect(rowNames()).toEqual([]);
  });

  it('chooses the start position on a partially used sheet', async () => {
    await loadApp();
    const summaryEl = $('.start-picker summary');
    expect(summaryEl.textContent).toBe('New sheet');
    $$('.sheet-cell')[6].click();
    expect(summaryEl.textContent).toBe('Start at 7');
    expect($$('.sheet-cell.used')).toHaveLength(6);
  });

  it('imports a CSV, reminds to back up, backs up and restores', async () => {
    await loadApp();
    const chooseFile = (id: string, name: string, content: string) => {
      const input = $<HTMLInputElement>(id);
      Object.defineProperty(input, 'files', { value: [new File([content], name)], configurable: true });
      input.dispatchEvent(new Event('change'));
      return new Promise((r) => setTimeout(r, 50));
    };
    const downloads: Blob[] = [];
    URL.createObjectURL = (blob: Blob) => {
      downloads.push(blob);
      return 'blob:test';
    };
    expect($('#backup-banner').hidden).toBe(true);

    // the empty library offers the import
    $$('#list-empty button').find((b) => /Import CSV/.test(b.textContent!))!.click();
    expect($<HTMLDialogElement>('#settings-dialog').open).toBe(true);

    await chooseFile('#csv-file', 'products.csv',
      'Kód;Popis;Počet\n8594199700121;"3DXTECH\n3DXSTAT";5\n8594199700138;B;\n8594199700220;C;0\n123;bad;1\n');
    expect($('#import-result').textContent).toMatch(/Imported from products.csv: 3 new products\. 1 row was skipped:.*13 digits/);
    expect(rowNames()).toEqual(['3DXTECH', 'B', 'C']);
    expect(summary()).toBe('5 stickers of 1 product on 1 sheet');

    // 3 products not backed up yet
    expect($('#backup-banner').hidden).toBe(false);
    expect($('#backup-status').textContent).toBe('Not backed up yet.');
    $<HTMLButtonElement>('#backup-banner-now').click();
    expect($('#backup-banner').hidden).toBe(true);
    expect($('#backup-status').textContent).toMatch(/^Last backup: /);
    const backup = await downloads.at(-1)!.text();
    expect(JSON.parse(backup)).toMatchObject({ format: 'barcodes-backup', products: [{ ean: '8594199700121', count: 5 }, {}, {}] });

    // CSV export
    $<HTMLButtonElement>('#csv-export').click();
    expect(await downloads.at(-1)!.text()).toMatch(/^ean,description,count\n8594199700121,"3DXTECH\n3DXSTAT",5\n/);

    // restore into a changed library
    $<HTMLButtonElement>('.product-main').click();
    $<HTMLButtonElement>('#product-delete').click();
    expect(rowNames()).toEqual(['B', 'C']);
    await chooseFile('#backup-file', 'backup.json', backup);
    expect($('#restore-result').textContent).toBe('Restored 3 products.');
    expect(rowNames()).toEqual(['3DXTECH', 'B', 'C']);

    await chooseFile('#backup-file', 'other.json', '{"x": 1}');
    expect($('#restore-result').textContent).toMatch(/not a backup file/);
  });
});
