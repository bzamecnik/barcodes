// EAN-13 encoding, ported from reportlab's Ean13BarcodeWidget
// (reportlab/graphics/barcode/eanbc.py) so that the output matches the
// original Python implementation.

import { t } from './i18n.ts';

const LEFT_ODD = ['0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'];
const LEFT_EVEN = ['0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'];
const RIGHT = ['1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100'];
// parity pattern of the left half, selected by the first digit (0 = odd, 1 = even)
const LEFT_PARITY = ['000000', '001011', '001101', '001110', '010011',
  '011001', '011100', '010101', '010110', '011010'];

const GUARD = '101';
const CENTER = '01010';
/** Quiet zone width in modules on each side. */
export const QUIET_MODULES = 9;

/** Check digit for the first 12 digits of an EAN-13. */
export function checkDigit(digits12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

export type EanValidation =
  | { ok: true; code: string }
  | { ok: false; error: string };

/**
 * Validate a user-entered EAN. Accepts 12 digits (the check digit is
 * computed) or 13 digits (the check digit must be correct).
 */
export function validateEan(input: string): EanValidation {
  const value = input.trim();
  if (!/^\d+$/.test(value)) {
    return { ok: false, error: t.eanNotDigits };
  }
  if (value.length === 12) {
    return { ok: true, code: value + checkDigit(value) };
  }
  if (value.length !== 13) {
    return { ok: false, error: t.eanWrongLength(value.length) };
  }
  const expected = checkDigit(value);
  if (value[12] !== expected) {
    return { ok: false, error: t.eanWrongCheckDigit(expected, value[12]) };
  }
  return { ok: true, code: value };
}

/**
 * Module pattern ('1' = bar, '0' = space) of a full 13-digit code,
 * including the quiet zones. Its length is 113 modules.
 */
export function encodeModules(code: string): string {
  const parity = LEFT_PARITY[Number(code[0])];
  let s = '0'.repeat(QUIET_MODULES) + GUARD;
  for (let i = 1; i <= 6; i++) {
    const d = Number(code[i]);
    s += parity[i - 1] === '0' ? LEFT_ODD[d] : LEFT_EVEN[d];
  }
  s += CENTER;
  for (let i = 7; i <= 12; i++) {
    s += RIGHT[Number(code[i])];
  }
  s += GUARD + '0'.repeat(QUIET_MODULES);
  return s;
}

/**
 * Whether the module at index i (in the pattern with quiet zones) is a
 * short bar, i.e. it is not part of the guard bars, which extend down
 * between the human-readable digits.
 */
export function isShortBar(i: number): boolean {
  return (i > 12 && i < 55) || (i > 57 && i < 101);
}

export interface Bar {
  /** start module index */
  start: number;
  /** width in modules */
  width: number;
  /** whether it's a guard bar (extends below the others) */
  guard: boolean;
}

/** Merge adjacent bar modules of the same height into bars. */
export function bars(code: string): Bar[] {
  const modules = encodeModules(code);
  const result: Bar[] = [];
  let current: Bar | null = null;
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === '1') {
      const guard = !isShortBar(i);
      if (current && current.guard === guard) {
        current.width++;
      } else {
        current = { start: i, width: 1, guard };
        result.push(current);
      }
    } else {
      current = null;
    }
  }
  return result;
}
