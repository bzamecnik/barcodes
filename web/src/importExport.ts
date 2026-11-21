// Import and export of products (CSV) and of the whole library (JSON backup).

import Papa from 'papaparse';
import { t } from './i18n.ts';
import {
  emptyState, mergeProducts, normalizeDescription, sortedProducts, type ProductInput, type State,
} from './store.ts';

// --- CSV ---

/** Accepted column names (lowercase), including Czech ones. */
const COLUMNS: Record<'ean' | 'description' | 'count', string[]> = {
  ean: ['ean', 'ean13', 'ean-13', 'code', 'barcode', 'kód', 'kod', 'čárový kód'],
  description: ['description', 'name', 'text', 'popis', 'název', 'nazev'],
  count: ['count', 'quantity', 'qty', 'počet', 'pocet', 'ks', 'množství', 'mnozstvi'],
};

export interface CsvImport {
  items: (ProductInput & { count?: number; source: string })[];
  errors: string[];
}

/**
 * Decode a text file: UTF-8, or Windows-1250 (Czech Excel and older
 * Windows programs) if it's not valid UTF-8.
 */
export function decodeText(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1250').decode(bytes);
  }
}

/**
 * Parse products from CSV with a header. The separator is detected (Excel
 * with Czech settings uses semicolons). Columns: ean, description and an
 * optional count.
 */
export function parseProductsCsv(text: string): CsvImport {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const errors: string[] = result.errors
    .filter((e) => e.code !== 'UndetectableDelimiter')
    .map((e) => (e.row !== undefined ? `${t.row(e.row + 2)}: ${e.message}` : e.message));

  const fields = result.meta.fields ?? [];
  const find = (key: keyof typeof COLUMNS) => fields.find((f) => COLUMNS[key].includes(f));
  const eanColumn = find('ean');
  const descriptionColumn = find('description');
  const countColumn = find('count');
  if (!eanColumn || !descriptionColumn) {
    return {
      items: [],
      errors: [t.csvMissingColumns(fields.join(', '))],
    };
  }

  const items: CsvImport['items'] = [];
  result.data.forEach((row, i) => {
    const source = t.row(i + 2);
    const ean = (row[eanColumn] ?? '').trim();
    const description = row[descriptionColumn] ?? '';
    if (!ean && !description.trim()) return;
    if (/^\d+([.,]\d+)?e\+?\d+$/i.test(ean)) {
      errors.push(`${source}: ${t.csvEanAsNumber(ean)}`);
      return;
    }
    const item: CsvImport['items'][number] = { ean, description, source };
    if (countColumn) {
      const raw = (row[countColumn] ?? '').trim();
      const count = Number(raw || 0);
      if (!Number.isInteger(count) || count < 0) {
        errors.push(`${source}: ${t.csvInvalidCount(raw)}`);
        return;
      }
      item.count = count;
    }
    items.push(item);
  });
  return { items, errors };
}

/** CSV with columns ean, description, count, readable by the `barcodes` command. */
export function productsToCsv(state: State): string {
  return Papa.unparse({
    fields: ['ean', 'description', 'count'],
    data: sortedProducts(state.products).map((p) => [p.ean, p.description, state.counts[p.id] ?? 0]),
  }, { newline: '\n' }) + '\n';
}

// --- JSON backup ---

const BACKUP_FORMAT = 'barcodes-backup';

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  products: { ean: string; description: string; count?: number }[];
  settings: { logo: string | null; logoName: string | null; showBorder: boolean };
}

export function createBackup(state: State, exportedAt = new Date().toISOString()): Backup {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt,
    products: sortedProducts(state.products).map((p) => ({
      ean: p.ean,
      description: p.description,
      ...(state.counts[p.id] ? { count: state.counts[p.id] } : {}),
    })),
    settings: {
      logo: state.settings.logo,
      logoName: state.settings.logoName,
      showBorder: state.settings.showBorder,
    },
  };
}

export class BackupError extends Error {}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError(t.backupNotJson);
  }
  const b = data as Partial<Backup>;
  if (!b || b.format !== BACKUP_FORMAT || !Array.isArray(b.products)) {
    throw new BackupError(t.backupWrongFormat);
  }
  if (b.version !== 1) {
    throw new BackupError(t.backupWrongVersion(b.version));
  }
  const logo = b.settings?.logo;
  if (logo !== null && logo !== undefined && !/^data:image\/(png|jpeg);base64,/.test(logo)) {
    throw new BackupError(t.backupBadLogo);
  }
  return b as Backup;
}

/**
 * Replace the library with the backup. Returns the new state and the
 * products which could not be restored.
 */
export function restoreBackup(state: State, backup: Backup): { state: State; errors: string[] } {
  const base: State = {
    ...emptyState(),
    settings: {
      ...state.settings,
      logo: backup.settings?.logo ?? null,
      logoName: backup.settings?.logoName ?? null,
      showBorder: !!backup.settings?.showBorder,
    },
  };
  const items = backup.products.map((p, i) => ({
    ean: String(p.ean ?? ''),
    description: normalizeDescription(String(p.description ?? '')),
    count: Number(p.count) || 0,
    source: t.productNumber(i + 1),
  }));
  const result = mergeProducts(base, items);
  const now = new Date().toISOString();
  return { state: { ...result.state, lastChange: now, lastBackup: now }, errors: result.errors };
}
