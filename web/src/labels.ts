// Layout of barcode stickers on A4 pages, ported from barcodes/__init__.py
// (generate_pdf). Coordinates are computed in PDF points with the origin at
// the bottom-left corner like in reportlab and flipped when drawing, since
// jsPDF has the origin at the top-left corner.

import { jsPDF } from 'jspdf';
import { bars, QUIET_MODULES, validateEan } from './ean13.ts';

const MM = 72 / 25.4;

export interface Label {
  ean: string;
  description: string;
}

export interface Logo {
  /** PNG or JPEG bytes, or a data URL */
  data: Uint8Array | string;
}

export interface LayoutOptions {
  logo?: Logo | null;
  /** draw label outlines (for checking alignment with the sticker sheet) */
  showBorder?: boolean;
}

// sticker sheet: A4 with 3 x 8 stickers of 70 x 36 mm
const PAGE_WIDTH = 210 * MM;
const PAGE_HEIGHT = 297 * MM;
const COLUMNS = 3;
const ROWS = 8;
/** top and bottom page margin */
const Y_MARGIN = 4.5 * MM;
const LABEL_WIDTH = PAGE_WIDTH / COLUMNS;
const LABEL_HEIGHT = (PAGE_HEIGHT - 2 * Y_MARGIN) / ROWS;
export const LABELS_PER_PAGE = COLUMNS * ROWS;

// barcode
const CODE_WIDTH = 37 * MM;
const CODE_HEIGHT = 26 * MM;
const CODE_X = 2 * MM;
const MODULE_WIDTH = (37.29 / 113) * MM;
const BAR_HEIGHT = 25.93 * MM;
const DIGITS_FONT_SIZE = 8;
/** width of each digit in Helvetica, in em */
const HELVETICA_DIGIT_WIDTH = 0.556;
/** guard bars extend this much below the other bars */
const DIGITS_SPACE = DIGITS_FONT_SIZE * 1.2;

// logo box, the logo is fit into it, aligned to its top-left corner
const LOGO_BOX_HEIGHT = 7 * MM;
const LOGO_BOX_WIDTH = (400 / 120) * LOGO_BOX_HEIGHT;

// description text
const TEXT_X = CODE_WIDTH + 2 * MM;
const FONT_SIZE = 9;
const LEADING = 1.2 * FONT_SIZE;
/** Helvetica ascent (718/1000 em) */
const FONT_ASCENT = 0.718 * FONT_SIZE;

/** Expand products with counts into a flat list of labels. */
export function expandCounts(products: (Label & { count: number })[]): Label[] {
  return products.flatMap((p) =>
    Array.from({ length: Math.max(0, Math.floor(p.count || 0)) },
      () => ({ ean: p.ean, description: p.description })));
}

/** Split a description into trimmed lines, like reportlab's textLines(). */
export function descriptionLines(description: string): string[] {
  return description.trim().split(/\r?\n|\r/).map((line) => line.trim());
}

// Characters that the built-in PDF Helvetica (WinAnsiEncoding) can draw on
// top of Latin-1: the extra characters of Windows-1252 in 0x80-0x9F.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/** Characters of the text that cannot be printed with the built-in font. */
export function unsupportedChars(text: string): string[] {
  const result = new Set<string>();
  for (const c of text) {
    const code = c.codePointAt(0)!;
    const latin1 = (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff);
    if (!latin1 && !WIN_ANSI_EXTRA.has(c) && c !== '\n' && c !== '\r' && c !== '\t') {
      result.add(c);
    }
  }
  return [...result];
}

/**
 * Generate a PDF with barcode stickers. Labels with an empty EAN leave an
 * empty space on the sheet. Throws on invalid EANs.
 */
export function generatePdf(labels: Label[], options: LayoutOptions = {}): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: 'Barcodes', creator: 'barcodes' });

  // flip from bottom-left to top-left origin
  const rect = (x: number, y: number, w: number, h: number, style: 'F' | 'S') =>
    doc.rect(x, PAGE_HEIGHT - y - h, w, h, style);
  const text = (s: string, x: number, y: number) =>
    doc.text(s, x, PAGE_HEIGHT - y, { baseline: 'alphabetic' });
  // Centered from the Helvetica metrics like reportlab's textAnchor='middle'.
  // jsPDF's own width of digits is slightly off (by 0.3 pt for 6 digits).
  const centeredDigits = (s: string, x: number, y: number) =>
    text(s, x - (s.length * HELVETICA_DIGIT_WIDTH * DIGITS_FONT_SIZE) / 2, y);

  let logo: { width: number; height: number } | null = null;
  if (options.logo) {
    const props = doc.getImageProperties(options.logo.data);
    const scale = Math.min(LOGO_BOX_WIDTH / props.width, LOGO_BOX_HEIGHT / props.height);
    logo = { width: props.width * scale, height: props.height * scale };
  }

  doc.setFillColor(0, 0, 0);
  doc.setTextColor(0, 0, 0);

  labels.forEach((label, i) => {
    const indexOnPage = i % LABELS_PER_PAGE;
    if (indexOnPage === 0 && i > 0) {
      doc.addPage();
    }
    if (!label.ean.trim()) {
      return;
    }
    const validation = validateEan(label.ean);
    if (!validation.ok) {
      throw new Error(`Invalid EAN "${label.ean}": ${validation.error}`);
    }
    const code = validation.code;

    // fill rows from the top
    const row = Math.floor(indexOnPage / COLUMNS);
    const col = indexOnPage % COLUMNS;
    const x0 = LABEL_WIDTH * col;
    const y0 = Y_MARGIN + LABEL_HEIGHT * (ROWS - 1 - row);

    if (options.showBorder) {
      doc.setLineWidth(0.5);
      rect(x0, y0, LABEL_WIDTH, LABEL_HEIGHT, 'S');
    }

    // barcode
    const codeX = x0 + CODE_X;
    const codeY = y0 + (LABEL_HEIGHT - CODE_HEIGHT) / 2;
    for (const bar of bars(code)) {
      const dh = bar.guard ? 0 : DIGITS_SPACE;
      rect(codeX + bar.start * MODULE_WIDTH, codeY + dh,
        bar.width * MODULE_WIDTH, BAR_HEIGHT - dh, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(DIGITS_FONT_SIZE);
    const digitsY = codeY + 0.2 * DIGITS_SPACE;
    text(code[0], codeX + (QUIET_MODULES - 8) * MODULE_WIDTH, digitsY);
    const leftCenter = codeX + (33 - 9 + QUIET_MODULES) * MODULE_WIDTH;
    centeredDigits(code.slice(1, 7), leftCenter, digitsY);
    centeredDigits(code.slice(7), leftCenter + 47 * MODULE_WIDTH, digitsY);

    // logo
    const logoBoxBottom = y0 + LABEL_HEIGHT - LOGO_BOX_HEIGHT - (LABEL_HEIGHT - CODE_HEIGHT) / 2;
    if (options.logo && logo) {
      const logoTop = logoBoxBottom + LOGO_BOX_HEIGHT;
      doc.addImage(options.logo.data, x0 + TEXT_X, PAGE_HEIGHT - logoTop,
        logo.width, logo.height, 'logo', 'FAST');
    }

    // description
    let baseline: number;
    if (logo) {
      baseline = logoBoxBottom - 5 * MM;
    } else {
      // align the top of the first line with the top of the bars
      baseline = codeY + BAR_HEIGHT - FONT_ASCENT;
    }
    doc.setFontSize(FONT_SIZE);
    descriptionLines(label.description).forEach((line, j) => {
      text(line, x0 + TEXT_X, baseline - j * LEADING);
    });
  });

  return doc;
}
