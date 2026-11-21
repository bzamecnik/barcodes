import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateEan } from '../src/ean13.ts';
import { detectLanguage, LANGUAGES, resolveLanguage, setLanguage, t, type Messages } from '../src/i18n.ts';
import { descriptionWarnings } from '../src/labels.ts';

afterEach(() => setLanguage('en'));

function dictionary(lang: 'en' | 'cs'): Messages {
  setLanguage(lang);
  return t;
}

describe('dictionaries', () => {
  it('have the same keys and types in all languages', () => {
    const en = dictionary('en');
    for (const lang of LANGUAGES) {
      const d = dictionary(lang);
      expect(Object.keys(d).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en) as (keyof Messages)[]) {
        expect(typeof d[key], `${lang}.${key}`).toBe(typeof en[key]);
      }
    }
  });

  it('contain all keys used in index.html as strings', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    const keys = [
      ...[...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)]
        .flatMap((m) => m[1].split(';').map((pair) => pair.split(':')[1].trim())),
    ];
    expect(keys.length).toBeGreaterThan(30);
    for (const lang of LANGUAGES) {
      const d = dictionary(lang) as Record<string, unknown>;
      for (const key of keys) expect(typeof d[key], `${lang}.${key}`).toBe('string');
    }
  });
});

describe('language detection', () => {
  it('picks the first supported preferred language', () => {
    expect(detectLanguage(['cs-CZ', 'en'])).toBe('cs');
    expect(detectLanguage(['de-DE', 'en-US', 'cs'])).toBe('en');
    expect(detectLanguage(['sk'])).toBe('cs');
    expect(detectLanguage(['de', 'fr'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });
  it('lets the setting override the browser', () => {
    expect(resolveLanguage('auto', ['cs'])).toBe('cs');
    expect(resolveLanguage('en', ['cs'])).toBe('en');
    expect(resolveLanguage('cs', ['en'])).toBe('cs');
  });
});

describe('Czech', () => {
  it('uses the plural forms for 1, 2-4 and 5+', () => {
    setLanguage('cs');
    expect([0, 1, 2, 4, 5, 22, 25].map((n) => t.productCount(n))).toEqual([
      '0 produktů', '1 produkt', '2 produkty', '4 produkty', '5 produktů', '22 produktů', '25 produktů',
    ]);
    const s = (a: number, b: number, c: number) => {
      const r = t.orderSummary(a, b, c);
      return r.stickers + r.rest;
    };
    expect(s(1, 1, 1)).toBe('1 štítek pro 1 produkt na 1 archu');
    expect(s(3, 2, 1)).toBe('3 štítky pro 2 produkty na 1 archu');
    expect(s(30, 5, 2)).toBe('30 štítků pro 5 produktů na 2 arších');
  });

  it('translates the messages of the core modules', () => {
    setLanguage('cs');
    expect(validateEan('8594199700122')).toEqual({ ok: false, error: 'Chybná kontrolní číslice: má být 1, je 2' });
    expect(descriptionWarnings('Černá', false)[0]).toMatch(/^Tyto znaky nejde vytisknout.*Č.*bez diakritiky/);
  });
});
