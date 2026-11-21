import { describe, expect, it } from 'vitest';
import {
  descriptionLines, descriptionWarnings, expandCounts, generatePdf, maxDescriptionLines, unsupportedChars,
} from '../src/labels.ts';

describe('expandCounts', () => {
  it('repeats each product count times', () => {
    const labels = expandCounts([
      { ean: '1', description: 'a', count: 2 },
      { ean: '2', description: 'b', count: 0 },
      { ean: '3', description: 'c', count: 1 },
    ]);
    expect(labels.map((l) => l.ean)).toEqual(['1', '1', '3']);
  });
});

describe('descriptionLines', () => {
  it('splits and trims lines', () => {
    expect(descriptionLines('  A \r\nB\n C ')).toEqual(['A', 'B', 'C']);
  });
});

describe('unsupportedChars', () => {
  it('allows ASCII, Latin-1 and Windows-1252 extras', () => {
    expect(unsupportedChars('PLA 1.75 mm – 1 kg ü é €\n')).toEqual([]);
  });
  it('reports characters outside of WinAnsi', () => {
    expect(unsupportedChars('Žluťoučký kůň')).toEqual(['ť', 'č', 'ů', 'ň']);
  });
});

describe('generatePdf', () => {
  const label = { ean: '8594199700121', description: 'X' };
  it('puts 24 labels on a page', () => {
    expect(generatePdf(Array(24).fill(label)).getNumberOfPages()).toBe(1);
    expect(generatePdf(Array(25).fill(label)).getNumberOfPages()).toBe(2);
  });
  it('rejects an invalid EAN', () => {
    expect(() => generatePdf([{ ean: '8594199700122', description: '' }])).toThrow(/check digit/);
  });
});

describe('descriptionWarnings', () => {
  it('accepts the typical descriptions', () => {
    const d = '3DXTECH\nCARBONX\nCarbon Fiber Nylon\n1.75 mm 0.5 kg';
    expect(descriptionWarnings(d, true)).toEqual([]);
    expect(descriptionWarnings(d, false)).toEqual([]);
  });
  it('limits the number of lines, fewer with a logo', () => {
    expect(maxDescriptionLines(true)).toBe(5);
    expect(maxDescriptionLines(false)).toBe(8);
    expect(descriptionWarnings('1\n2\n3\n4\n5\n6', true)).toHaveLength(1);
    expect(descriptionWarnings('1\n2\n3\n4\n5\n6', false)).toEqual([]);
  });
  it('reports lines too long for the sticker', () => {
    const w = descriptionWarnings('Carbon Fiber Reinforced Nylon 12', false);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/too long/);
  });
  it('reports unsupported characters', () => {
    expect(descriptionWarnings('Černá', false)[0]).toMatch(/Č/);
  });
});
