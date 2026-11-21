import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvRecords } from '../src/csv.ts';

describe('parseCsv', () => {
  it('parses quoted fields with newlines, commas and quotes', () => {
    expect(parseCsv('a,b\r\n"x\ny","1,2 ""q"""\n')).toEqual([
      ['a', 'b'],
      ['x\ny', '1,2 "q"'],
    ]);
  });
  it('handles a BOM, no trailing newline and empty lines', () => {
    expect(parseCsv('﻿a,b\n\n1,\n2,3')).toEqual([['a', 'b'], ['1', ''], ['2', '3']]);
  });
});

describe('parseCsvRecords', () => {
  it('maps rows to the header', () => {
    const csv = 'ean,count,description\n8594199700121,20,"3DXTECH\n3DXSTAT"\n';
    expect(parseCsvRecords(csv)).toEqual([
      { ean: '8594199700121', count: '20', description: '3DXTECH\n3DXSTAT' },
    ]);
  });
});
