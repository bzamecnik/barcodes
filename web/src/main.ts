// Minimal page for checking the PDF output: paste a CSV, optionally pick a
// logo, generate the PDF. The proper product management UI comes later.

import { parseCsvRecords } from './csv.ts';
import { validateEan } from './ean13.ts';
import { expandCounts, generatePdf, unsupportedChars, type Logo } from './labels.ts';

const SAMPLE_CSV = `ean,count,description
8594199700121,20,"3DXTECH
3DXSTAT
ESD PLA
1.75 mm 1 kg"
8594199700138,10,"3DXTECH
3DXSTAT
ESD PLA
2.85 mm 1 kg"
8594199700541,10,"3DXTECH
CARBONX
Carbon Fiber Nylon
1.75 mm 0.5 kg"
8594199700220,10,"3DXTECH
FLUORX
PVDF KYNAR
1.75 mm 0.5 kg"
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const csvInput = $<HTMLTextAreaElement>('csv');
const csvFile = $<HTMLInputElement>('csv-file');
const logoFile = $<HTMLInputElement>('logo-file');
const logoName = $<HTMLSpanElement>('logo-name');
const logoClear = $<HTMLButtonElement>('logo-clear');
const border = $<HTMLInputElement>('border');
const generateButton = $<HTMLButtonElement>('generate');
const download = $<HTMLAnchorElement>('download');
const openLink = $<HTMLAnchorElement>('open');
const messages = $<HTMLUListElement>('messages');
const preview = $<HTMLIFrameElement>('preview');

csvInput.value = SAMPLE_CSV;
let logo: Logo | null = null;
let pdfUrl: string | null = null;

csvFile.addEventListener('change', async () => {
  const file = csvFile.files?.[0];
  if (file) csvInput.value = await file.text();
  csvFile.value = '';
});

logoFile.addEventListener('change', async () => {
  const file = logoFile.files?.[0];
  if (!file) return;
  logo = { data: new Uint8Array(await file.arrayBuffer()) };
  logoName.textContent = file.name;
  logoClear.hidden = false;
  logoFile.value = '';
});

logoClear.addEventListener('click', () => {
  logo = null;
  logoName.textContent = 'no logo';
  logoClear.hidden = true;
});

function showMessages(items: { level: 'error' | 'warning'; text: string }[]) {
  messages.replaceChildren(...items.map(({ level, text }) => {
    const li = document.createElement('li');
    li.className = level;
    li.textContent = text;
    return li;
  }));
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

generateButton.addEventListener('click', () => {
  const problems: { level: 'error' | 'warning'; text: string }[] = [];
  const products = parseCsvRecords(csvInput.value).map((r, i) => {
    const row = i + 2; // 1-based, after the header
    const ean = (r.ean ?? '').trim();
    const description = r.description ?? '';
    const count = Number((r.count ?? '').trim() || 0);
    if (!Number.isInteger(count) || count < 0) {
      problems.push({ level: 'error', text: `Row ${row}: invalid count "${r.count}"` });
    }
    if (ean) {
      const v = validateEan(ean);
      if (!v.ok) problems.push({ level: 'error', text: `Row ${row} (${ean}): ${v.error}` });
    }
    const bad = unsupportedChars(description);
    if (bad.length) {
      problems.push({
        level: 'warning',
        text: `Row ${row} (${ean}): these characters can't be printed and will be garbled: ${bad.join(' ')}`,
      });
    }
    return { ean, description, count };
  });

  if (problems.some((p) => p.level === 'error')) {
    showMessages(problems);
    return;
  }

  let doc;
  try {
    doc = generatePdf(expandCounts(products), { logo, showBorder: border.checked });
  } catch (e) {
    showMessages([...problems, { level: 'error', text: String(e instanceof Error ? e.message : e) }]);
    return;
  }
  showMessages(problems);

  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  pdfUrl = URL.createObjectURL(doc.output('blob'));
  preview.src = pdfUrl;
  download.href = pdfUrl;
  download.download = `barcodes_${timestamp()}.pdf`;
  openLink.href = pdfUrl;
  download.hidden = openLink.hidden = false;
});
