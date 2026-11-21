// Settings & data dialog: logo, CSV import/export, backup/restore, and the
// reminder to back up.

import {
  BackupError, createBackup, decodeText, parseBackup, parseProductsCsv, productsToCsv, restoreBackup,
} from '../importExport.ts';
import { mergeProducts, type State, type Store } from '../store.ts';
import { byId, h, plural } from './dom.ts';

/** Logos larger than this (in pixels) are scaled down to keep storage and PDFs small. */
const LOGO_MAX_WIDTH = 1200;
const LOGO_MAX_BYTES = 300_000;
/** remind to back up when the last backup is older than this */
const BACKUP_REMINDER_DAYS = 14;
/** don't nag before there's something worth backing up */
const BACKUP_REMINDER_MIN_PRODUCTS = 3;

export interface Settings {
  open(section?: 'products'): void;
  backup(): void;
}

function timestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This file is not an image the browser can read.'));
    img.src = src;
  });
}

/**
 * Read a logo as a PNG or JPEG data URL (the formats jsPDF supports).
 * Other formats (SVG, WebP, ...) and large images are converted to PNG.
 */
async function readLogo(file: File): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const supported = file.type === 'image/png' || file.type === 'image/jpeg';
  if (supported && img.naturalWidth <= LOGO_MAX_WIDTH && file.size <= LOGO_MAX_BYTES) {
    return dataUrl;
  }
  // SVGs without explicit size report 0
  const width = img.naturalWidth || 1000;
  const height = img.naturalHeight || 300;
  const scale = Math.min(1, LOGO_MAX_WIDTH / width);
  const canvas = h('canvas', { width: Math.round(width * scale), height: Math.round(height * scale) });
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function resultList(summary: string, errors: string[], kind: 'ok' | 'error' = 'ok'): HTMLElement[] {
  const shown = errors.slice(0, 10);
  const result: HTMLElement[] = [h('p', { class: kind }, summary)];
  if (shown.length) result.push(h('ul', { class: 'warnings' }, ...shown.map((e) => h('li', {}, e))));
  if (errors.length > shown.length) {
    result.push(h('p', { class: 'small muted' }, `…and ${errors.length - shown.length} more`));
  }
  return result;
}

export function setupSettings(store: Store): Settings {
  const dialog = byId<HTMLDialogElement>('settings-dialog');
  const logoPreview = byId('logo-preview');
  const logoFile = byId<HTMLInputElement>('logo-file');
  const logoRemove = byId<HTMLButtonElement>('logo-remove');
  const csvFile = byId<HTMLInputElement>('csv-file');
  const csvExport = byId<HTMLButtonElement>('csv-export');
  const importResult = byId('import-result');
  const backupExport = byId<HTMLButtonElement>('backup-export');
  const backupFile = byId<HTMLInputElement>('backup-file');
  const backupStatus = byId('backup-status');
  const restoreResult = byId('restore-result');
  const banner = byId('backup-banner');
  let bannerDismissed = false;

  function renderLogo(state: State): void {
    const { logo, logoName } = state.settings;
    logoPreview.replaceChildren(logo
      ? h('img', { src: logo, alt: logoName ? `Logo: ${logoName}` : 'Logo' })
      : h('span', { class: 'muted' }, 'No logo'));
    logoRemove.hidden = !logo;
  }

  function renderBackupStatus(state: State): void {
    const { lastBackup, lastChange, products } = state;
    backupStatus.textContent = lastBackup
      ? `Last backup: ${formatDate(lastBackup)}${lastChange && lastChange > lastBackup ? ' (there are changes since)' : ''}.`
      : products.length ? 'Not backed up yet.' : '';

    const unsaved = !!lastChange && (!lastBackup || lastChange > lastBackup);
    const ageDays = lastBackup ? (Date.now() - Date.parse(lastBackup)) / 86_400_000 : Infinity;
    const due = lastBackup
      ? ageDays >= BACKUP_REMINDER_DAYS
      : products.length >= BACKUP_REMINDER_MIN_PRODUCTS;
    banner.hidden = bannerDismissed || !unsaved || !due;
  }

  function backup(): void {
    const state = store.state;
    downloadFile(`barcodes-backup_${timestamp()}.json`, JSON.stringify(createBackup(state), null, 2),
      'application/json');
    store.update((s) => ({ ...s, lastBackup: new Date().toISOString() }));
  }

  function open(section?: 'products'): void {
    importResult.replaceChildren();
    restoreResult.replaceChildren();
    dialog.showModal();
    if (section === 'products') byId('settings-products').scrollIntoView({ block: 'start' });
  }

  logoFile.addEventListener('change', async () => {
    const file = logoFile.files?.[0];
    logoFile.value = '';
    if (!file) return;
    try {
      const logo = await readLogo(file);
      store.update((s) => ({
        ...s,
        settings: { ...s.settings, logo, logoName: file.name },
        lastChange: new Date().toISOString(),
      }));
    } catch (e) {
      logoPreview.replaceChildren(h('span', { class: 'error' }, e instanceof Error ? e.message : String(e)));
    }
  });

  logoRemove.addEventListener('click', () => {
    store.update((s) => ({
      ...s,
      settings: { ...s.settings, logo: null, logoName: null },
      lastChange: new Date().toISOString(),
    }));
  });

  csvFile.addEventListener('change', async () => {
    const file = csvFile.files?.[0];
    csvFile.value = '';
    if (!file) return;
    const parsed = parseProductsCsv(decodeText(await file.arrayBuffer()));
    if (!parsed.items.length) {
      importResult.replaceChildren(...resultList('Nothing was imported.', parsed.errors, 'error'));
      return;
    }
    const result = mergeProducts(store.state, parsed.items);
    store.set(result.state);
    const errors = [...parsed.errors, ...result.errors];
    const parts = [
      result.added && `${plural(result.added, 'new product', 'new products')}`,
      result.updated && `${result.updated} updated`,
      result.unchanged && `${result.unchanged} unchanged`,
    ].filter(Boolean);
    importResult.replaceChildren(...resultList(
      `Imported from ${file.name}: ${parts.join(', ') || 'nothing'}.` +
      (errors.length ? ` ${plural(errors.length, 'row was', 'rows were')} skipped:` : ''),
      errors));
  });

  csvExport.addEventListener('click', () => {
    downloadFile(`barcodes_${timestamp()}.csv`, productsToCsv(store.state), 'text/csv;charset=utf-8');
  });

  backupExport.addEventListener('click', backup);

  backupFile.addEventListener('change', async () => {
    const file = backupFile.files?.[0];
    backupFile.value = '';
    if (!file) return;
    try {
      const data = parseBackup(await file.text());
      const current = store.state.products.length;
      if (current && !confirm(
        `Replace your ${plural(current, 'product', 'products')} with ` +
        `${plural(data.products.length, 'product', 'products')} from the backup of ${formatDate(data.exportedAt)}?`)) {
        return;
      }
      const result = restoreBackup(store.state, data);
      store.set(result.state);
      restoreResult.replaceChildren(...resultList(
        `Restored ${plural(result.state.products.length, 'product', 'products')}` +
        (result.errors.length ? `, ${plural(result.errors.length, 'product was', 'products were')} skipped:` : '.'),
        result.errors));
    } catch (e) {
      if (!(e instanceof BackupError)) throw e;
      restoreResult.replaceChildren(...resultList(e.message, [], 'error'));
    }
  });

  for (const button of dialog.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => dialog.close());
  }

  byId('backup-banner-now').addEventListener('click', backup);
  byId('backup-banner-later').addEventListener('click', () => {
    bannerDismissed = true;
    banner.hidden = true;
  });

  store.subscribe((state, previous) => {
    if (state.settings.logo !== previous.settings.logo) renderLogo(state);
    renderBackupStatus(state);
  });
  renderLogo(store.state);
  renderBackupStatus(store.state);

  return { open, backup };
}
