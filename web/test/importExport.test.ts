import { describe, expect, it } from 'vitest';
import {
  BackupError, createBackup, decodeText, parseBackup, parseProductsCsv, productsToCsv, restoreBackup,
} from '../src/importExport.ts';
import { addProduct, emptyState, mergeProducts, setCount } from '../src/store.ts';

describe('parseProductsCsv', () => {
  it('parses the format of the barcodes command', () => {
    const r = parseProductsCsv('ean,count,description\n8594199700121,20,"3DXTECH\n3DXSTAT"\n\n');
    expect(r.errors).toEqual([]);
    expect(r.items).toEqual([{ ean: '8594199700121', description: '3DXTECH\n3DXSTAT', count: 20, source: 'Row 2' }]);
  });

  it('detects semicolons and Czech headers, count is optional', () => {
    const r = parseProductsCsv('﻿Kód;Popis\r\n8594199700121;"A; B"\r\n');
    expect(r.errors).toEqual([]);
    expect(r.items).toEqual([{ ean: '8594199700121', description: 'A; B', source: 'Row 2' }]);
  });

  it('reports missing columns, numbers mangled by Excel and bad counts', () => {
    expect(parseProductsCsv('a,b\n1,2').errors[0]).toMatch(/columns “ean” and “description”, found: a, b/);
    const r = parseProductsCsv('ean,description,count\n8.59419970012E+12,A,1\n8594199700138,B,-1\n8594199700220,C,\n');
    expect(r.errors).toEqual([
      'Row 2: the EAN “8.59419970012E+12” was converted to a number by a spreadsheet; format the column as text',
      'Row 3: invalid count “-1”',
    ]);
    expect(r.items).toEqual([{ ean: '8594199700220', description: 'C', count: 0, source: 'Row 4' }]);
  });
});

describe('decodeText', () => {
  it('decodes UTF-8 and falls back to Windows-1250', () => {
    expect(decodeText(new TextEncoder().encode('Žluťoučký'))).toBe('Žluťoučký');
    // "Žluť" in Windows-1250
    expect(decodeText(new Uint8Array([0x8e, 0x6c, 0x75, 0x9d]))).toBe('Žluť');
  });
});

describe('productsToCsv', () => {
  it('exports sorted products with counts, round-tripping through the import', () => {
    let s = addProduct(emptyState(), { ean: '8594199700138', description: 'B, "quoted"' }).state;
    s = addProduct(s, { ean: '8594199700121', description: 'A\nline 2' }).state;
    s = setCount(s, s.products[0].id, 3);
    const csv = productsToCsv(s);
    expect(csv).toBe('ean,description,count\n8594199700121,"A\nline 2",0\n8594199700138,"B, ""quoted""",3\n');
    const back = parseProductsCsv(csv).items.map(({ source: _, ...rest }) => rest);
    expect(back).toEqual([
      { ean: '8594199700121', description: 'A\nline 2', count: 0 },
      { ean: '8594199700138', description: 'B, "quoted"', count: 3 },
    ]);
  });
});

describe('backup', () => {
  it('round-trips products, counts and the logo, replacing the library', () => {
    let s = addProduct(emptyState(), { ean: '8594199700121', description: 'A' }).state;
    s = setCount(s, s.products[0].id, 5);
    s = { ...s, settings: { ...s.settings, logo: 'data:image/png;base64,AAAA', logoName: 'logo.png', startPosition: 4 } };
    const json = JSON.stringify(createBackup(s, '2026-11-21T10:00:00.000Z'));

    let other = mergeProducts(emptyState(), [{ ean: '8594199700138', description: 'B' }]).state;
    other = { ...other, settings: { ...other.settings, startPosition: 2 } };
    const { state: restored, errors } = restoreBackup(other, parseBackup(json));
    expect(errors).toEqual([]);
    expect(restored.products.map((p) => p.description)).toEqual(['A']);
    expect(Object.values(restored.counts)).toEqual([5]);
    expect(restored.settings).toMatchObject({ logo: 'data:image/png;base64,AAAA', logoName: 'logo.png', startPosition: 2 });
    expect(restored.lastBackup).not.toBeNull();
  });

  it('rejects other files', () => {
    expect(() => parseBackup('ean,description')).toThrow(BackupError);
    expect(() => parseBackup('{"products": []}')).toThrow(/not a backup/);
    expect(() => parseBackup('{"format": "barcodes-backup", "version": 2, "products": []}')).toThrow(/version 2/);
    expect(() => parseBackup(JSON.stringify({
      format: 'barcodes-backup', version: 1, products: [], settings: { logo: 'javascript:alert(1)' },
    }))).toThrow(/logo/);
  });
});
