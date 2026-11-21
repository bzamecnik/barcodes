import { resolveLanguage, setLanguage, t, translatePage } from './i18n.ts';
import { mergeProducts, Store } from './store.ts';
import { byId, h, icon } from './ui/dom.ts';
import { icons } from './ui/icons.ts';
import { setupPreview, setupStartPicker } from './ui/preview.ts';
import { setupProductDialog } from './ui/productDialog.ts';
import { setupProductList } from './ui/productList.ts';
import { setupSettings } from './ui/settings.ts';

const SAMPLE_PRODUCTS = [
  { ean: '8594199700121', description: '3DXTECH\n3DXSTAT\nESD PLA\n1.75 mm 1 kg' },
  { ean: '8594199700138', description: '3DXTECH\n3DXSTAT\nESD PLA\n2.85 mm 1 kg' },
  { ean: '8594199700541', description: '3DXTECH\nCARBONX\nCarbon Fiber Nylon\n1.75 mm 0.5 kg' },
  { ean: '8594199700220', description: '3DXTECH\nFLUORX\nPVDF KYNAR\n1.75 mm 0.5 kg' },
];

/** localStorage, or null if it's not available (e.g. blocked site data). */
function browserStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    storage.getItem('barcodes:test');
    return storage;
  } catch {
    return null;
  }
}

const storage = browserStorage();
const store = new Store(storage);

setLanguage(resolveLanguage(store.state.settings.language));
translatePage();

const banner = byId('banner');
function showBanner(text: string | null): void {
  banner.hidden = !text;
  banner.replaceChildren(...(text ? [icon(icons.alert), h('span', {}, text)] : []));
}
if (!storage) {
  showBanner(t.storageUnavailable);
}
store.subscribe(() => {
  if (store.saveError) showBanner(t.saveFailed(store.saveError));
});

// Ask the browser not to evict the data under storage pressure. Browsers
// grant it e.g. for installed apps or frequently used sites.
let persistRequested = false;
function requestPersistentStorage(): void {
  if (persistRequested || !store.state.products.length) return;
  persistRequested = true;
  navigator.storage?.persist?.().catch(() => {});
}
store.subscribe(requestPersistentStorage);
requestPersistentStorage();

const settings = setupSettings(store, () => window.location.reload());
const productDialog = setupProductDialog(store, (id, isNew) => list.reveal(id, isNew));

const list = setupProductList(store, {
  addProduct: (prefill) => productDialog.open(null, prefill),
  editProduct: (product) => productDialog.open(product),
  emptyLibraryActions: () => [
    h('button', {
      type: 'button',
      class: 'btn',
      on: { click: () => settings.open('products') },
    }, t.importCsvEllipsis),
    h('button', {
      type: 'button',
      class: 'btn',
      on: { click: () => store.update((s) => mergeProducts(s, SAMPLE_PRODUCTS).state) },
    }, t.trySample),
  ],
});

setupPreview(store);
setupStartPicker(store);

const addButton = byId<HTMLButtonElement>('add-product');
addButton.replaceChildren(icon(icons.plus), t.addProduct);
addButton.addEventListener('click', () => productDialog.open());

const settingsButton = byId<HTMLButtonElement>('open-settings');
settingsButton.replaceChildren(icon(icons.settings), h('span', { class: 'label' }, t.settings));
settingsButton.addEventListener('click', () => settings.open());

// offline support (not in development, where it would get in the way)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker not registered', e));
}
