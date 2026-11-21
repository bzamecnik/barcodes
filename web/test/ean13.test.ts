import { describe, expect, it } from 'vitest';
import { bars, checkDigit, encodeModules, validateEan } from '../src/ean13.ts';

describe('checkDigit', () => {
  it('computes EAN-13 check digits', () => {
    expect(checkDigit('859419970012')).toBe('1');
    expect(checkDigit('859419970054')).toBe('1');
    expect(checkDigit('400638133393')).toBe('1');
    expect(checkDigit('000000000000')).toBe('0');
  });
});

describe('validateEan', () => {
  it('accepts a valid 13-digit code', () => {
    expect(validateEan(' 8594199700121 ')).toEqual({ ok: true, code: '8594199700121' });
  });
  it('completes the check digit for 12 digits', () => {
    expect(validateEan('859419970012')).toEqual({ ok: true, code: '8594199700121' });
  });
  it('rejects a wrong check digit', () => {
    expect(validateEan('8594199700122').ok).toBe(false);
  });
  it('rejects non-digits and wrong lengths', () => {
    expect(validateEan('85941997001a1').ok).toBe(false);
    expect(validateEan('12345').ok).toBe(false);
    expect(validateEan('').ok).toBe(false);
  });
});

describe('encodeModules', () => {
  it('has 113 modules with quiet zones and guards', () => {
    const m = encodeModules('4006381333931');
    expect(m).toHaveLength(113);
    expect(m.slice(0, 12)).toBe('000000000101');
    expect(m.slice(54, 59)).toBe('01010');
    expect(m.slice(101)).toBe('101000000000');
  });
  it('encodes a known code', () => {
    // 4006381333931: first digit 4 -> parity OEOOEE
    const m = encodeModules('4006381333931');
    const data = m.slice(12, 54) + '|' + m.slice(59, 101);
    expect(data).toBe(
      '0001101' + '0100111' + '0101111' + '0111101' + '0001001' + '0110011' + '|' +
      '1000010' + '1000010' + '1000010' + '1110100' + '1000010' + '1100110');
  });
});

describe('bars', () => {
  it('marks only the guard bars as long', () => {
    const b = bars('8594199700121');
    expect(b.filter((x) => x.guard).map((x) => x.start)).toEqual([9, 11, 55, 57, 101, 103]);
    expect(b.every((x) => x.width >= 1 && x.width <= 4)).toBe(true);
  });
});
