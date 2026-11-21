// Render labels from a CSV (ean,count,description) to a PDF, like the
// Python `barcodes` command. Used to compare the output with the original.
//
// usage: node scripts/render-pdf.ts products.csv labels.pdf [--logo logo.png] [--border]

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { decodeText, parseProductsCsv } from '../src/importExport.ts';
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

const { items, errors } = parseProductsCsv(decodeText(readFileSync(csvPath)));
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const products = items.map((p) => ({ ...p, count: p.count ?? 1 }));
const logo = values.logo ? { data: new Uint8Array(readFileSync(values.logo)) } : null;
const doc = generatePdf(expandCounts(products), { logo, showBorder: values.border });
writeFileSync(pdfPath, Buffer.from(doc.output('arraybuffer')));
console.log(`wrote ${pdfPath}`);
