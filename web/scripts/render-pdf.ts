// Render labels from a CSV (ean,count,description) to a PDF, like the
// Python `barcodes` command. Used to compare the output with the original.
//
// usage: node scripts/render-pdf.ts products.csv labels.pdf [--logo logo.png] [--border]

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseCsvRecords } from '../src/csv.ts';
import { expandCounts, generatePdf } from '../src/labels.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    logo: { type: 'string', short: 'l' },
    border: { type: 'boolean' },
  },
});
const [csvPath, pdfPath] = positionals;
if (!csvPath || !pdfPath) {
  console.error('usage: node scripts/render-pdf.ts products.csv labels.pdf [--logo logo.png] [--border]');
  process.exit(1);
}

const products = parseCsvRecords(readFileSync(csvPath, 'utf8')).map((r) => ({
  ean: r.ean ?? '',
  description: r.description ?? '',
  count: Number(r.count || 0),
}));
const logo = values.logo ? { data: new Uint8Array(readFileSync(values.logo)) } : null;
const doc = generatePdf(expandCounts(products), { logo, showBorder: values.border });
writeFileSync(pdfPath, Buffer.from(doc.output('arraybuffer')));
console.log(`wrote ${pdfPath}`);
