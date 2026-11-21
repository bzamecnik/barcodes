// Dialog for adding, editing and deleting a product, with live checks of the
// EAN and of how the description fits on a sticker.

import { checkDigit, validateEan } from '../ean13.ts';
import { t } from '../i18n.ts';
import { descriptionWarnings } from '../labels.ts';
import {
  addProduct, deleteProduct, findByEan, firstLine, ProductError, updateProduct,
  type Product, type Store,
} from '../store.ts';
import { byId, h } from './dom.ts';

export interface ProductDialog {
  open(product?: Product | null, prefill?: { ean?: string }): void;
}

export function setupProductDialog(
  store: Store,
  onSaved: (id: string, isNew: boolean) => void,
): ProductDialog {
  const dialog = byId<HTMLDialogElement>('product-dialog');
  const form = byId<HTMLFormElement>('product-form');
  const title = byId('product-dialog-title');
  const ean = byId<HTMLInputElement>('product-ean');
  const eanHint = byId('product-ean-hint');
  const description = byId<HTMLTextAreaElement>('product-description');
  const warnings = byId<HTMLUListElement>('product-warnings');
  const error = byId('product-error');
  const deleteButton = byId<HTMLButtonElement>('product-delete');
  let editing: Product | null = null;

  function checkEan(): void {
    const value = ean.value.replace(/\s/g, '');
    let text = '';
    let kind = '';
    if (!value) {
      text = '';
    } else if (!/^\d+$/.test(value)) {
      text = t.eanOnlyDigits;
      kind = 'error';
    } else if (value.length < 12) {
      text = t.eanDigitsSoFar(value.length);
    } else if (value.length === 12) {
      text = t.eanCheckDigitAdded(checkDigit(value));
    } else {
      const v = validateEan(value);
      if (!v.ok) {
        text = t.eanWrongCheckDigitHint(checkDigit(value));
        kind = 'error';
      } else {
        const other = findByEan(store.state, value);
        if (other && other.id !== editing?.id) {
          text = t.eanAlreadyInLibrary(firstLine(other.description));
          kind = 'error';
        } else {
          text = t.eanValid;
          kind = 'ok';
        }
      }
    }
    eanHint.textContent = text;
    eanHint.className = `field-hint ${kind}`;
  }

  function checkDescription(): void {
    const items = descriptionWarnings(description.value, !!store.state.settings.logo);
    warnings.replaceChildren(...items.map((w) => h('li', {}, w)));
  }

  function open(product: Product | null = null, prefill: { ean?: string } = {}): void {
    editing = product;
    title.textContent = product ? t.editProductTitle : t.addProductTitle;
    ean.value = product?.ean ?? prefill.ean ?? '';
    description.value = product?.description ?? '';
    deleteButton.hidden = !product;
    error.textContent = '';
    checkEan();
    checkDescription();
    dialog.showModal();
    (ean.value && !product ? description : ean).focus();
  }

  ean.addEventListener('input', () => {
    error.textContent = '';
    checkEan();
  });
  description.addEventListener('input', () => {
    error.textContent = '';
    checkDescription();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = { ean: ean.value, description: description.value };
    try {
      if (editing) {
        const id = editing.id;
        store.update((s) => updateProduct(s, id, input));
        onSaved(id, false);
      } else {
        // run outside of update() to get the new product's id
        const result = addProduct(store.state, input);
        store.set(result.state);
        onSaved(result.product.id, true);
      }
      dialog.close();
    } catch (err) {
      if (!(err instanceof ProductError)) throw err;
      error.textContent = err.message;
    }
  });

  deleteButton.addEventListener('click', () => {
    if (!editing) return;
    const id = editing.id;
    if (confirm(t.confirmDelete(firstLine(editing.description), editing.ean))) {
      store.update((s) => deleteProduct(s, id));
      dialog.close();
    }
  });

  for (const button of dialog.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => dialog.close());
  }

  return { open };
}
