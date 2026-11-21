// Translations of the user interface.
//
// `t` is the dictionary of the current language. It's a live binding:
// after setLanguage() all modules see the new dictionary. Every language
// must have the same keys as English (checked by TypeScript).
//
// Strings ending with "Html" contain markup and are inserted as HTML (they
// are static strings from this file, never user input).

export type Language = 'en' | 'cs';
export type LanguageSetting = 'auto' | Language;
export const LANGUAGES: Language[] = ['en', 'cs'];

type PluralForms = { one: string; few?: string; other: string };

let pluralRules = new Intl.PluralRules('en');

/** "1 sticker", "2 stickers"; Czech has also the "few" form for 2-4. */
function plural(n: number, forms: PluralForms): string {
  const rule = pluralRules.select(n);
  const form = rule === 'one' ? forms.one : rule === 'few' && forms.few ? forms.few : forms.other;
  return `${n} ${form}`;
}

const en = {
  locale: 'en',
  languageName: 'English',

  appName: 'Barcodes',
  appDescription: 'Print EAN-13 barcode stickers for your products, on A4 sheets with 3 × 8 stickers.',

  // header and banners
  addProduct: 'Add product',
  settings: 'Settings',
  settingsAndData: 'Settings and data',
  backupBanner: 'Your products are saved only in this browser. Back them up to a file in case browser data gets cleared.',
  backupNow: 'Back up now',
  later: 'Later',
  storageUnavailable: 'This browser does not allow storing data for this page. Products will be lost when you close it.',
  saveFailed: (error: string) => `Could not save the changes: ${error}`,

  // product list
  products: 'Products',
  searchLabel: 'Search or scan an EAN',
  searchPlaceholder: 'Search or scan EAN',
  selectedOnly: 'Selected only',
  clearCounts: 'Clear counts',
  productCount: (n: number) => plural(n, { one: 'product', other: 'products' }),
  visibleOfTotal: (visible: number, total: number) => `${visible} of ${total}`,
  libraryEmpty: 'Your product library is empty',
  libraryEmptyHint: 'Add your products once. For each delivery, just set how many stickers to print.',
  importCsvEllipsis: 'Import CSV…',
  trySample: 'Try with sample products',
  noMatch: (query: string) => `No products match “${query}”.`,
  addProductWithEan: (ean: string) => `Add product ${ean}`,
  noneSelected: 'No products selected yet.',
  editProduct: 'Edit product',
  countLabel: (product: string) => `Number of stickers: ${product}`,
  oneLess: (product: string) => `One less: ${product}`,
  oneMore: (product: string) => `One more: ${product}`,
  scanned: (product: string, count: number) => `+1 ${product} – now ${count}`,
  orderSummary: (stickers: number, products: number, sheets: number) => ({
    stickers: plural(stickers, { one: 'sticker', other: 'stickers' }),
    rest: ` of ${plural(products, { one: 'product', other: 'products' })} on ${plural(sheets, { one: 'sheet', other: 'sheets' })}`,
  }),
  noStickersSelected: 'No stickers selected',
  confirmClearCounts: (stickers: number) =>
    `Clear the counts of all ${plural(stickers, { one: 'sticker', other: 'stickers' })}?`,

  // preview
  stickers: 'Stickers',
  outlines: 'Outlines',
  previewTitle: 'PDF preview of the stickers',
  noStickersYet: 'No stickers yet',
  noStickersHint: 'Set how many stickers you need for each product and they appear here.',
  printHint: 'Print at 100 % (“Actual size”), not “Fit to page”.',
  openToPrint: 'Open to print',
  downloadPdf: 'Download PDF',
  pdfFailed: 'Could not create the PDF',
  newSheet: 'New sheet',
  startAt: (position: number) => `Start at ${position}`,
  partiallyUsedSheet: 'Partially used sheet?',
  partiallyUsedHint: 'Click the first free sticker. Printing starts there.',
  firstFreeSticker: 'First free sticker',
  startAtSticker: (position: number, row: number, column: number) =>
    `Start at sticker ${position} (row ${row}, column ${column})`,

  // product dialog
  editProductTitle: 'Edit product',
  addProductTitle: 'Add product',
  ean: 'EAN',
  eanPlaceholder: '13 digits',
  description: 'Description',
  descriptionHint: '(as printed, one item per line)',
  delete: 'Delete',
  cancel: 'Cancel',
  save: 'Save',
  close: 'Close',
  eanOnlyDigits: 'Only digits, please.',
  eanDigitsSoFar: (n: number) => `${n} of 13 digits`,
  eanCheckDigitAdded: (digit: string) => `The check digit ${digit} will be added.`,
  eanWrongCheckDigitHint: (expected: string) => `Wrong check digit (should be ${expected}). Is there a typo?`,
  eanAlreadyInLibrary: (product: string) => `Already in the library: ${product}`,
  eanValid: 'Valid EAN-13 ✓',
  confirmDelete: (product: string, ean: string) => `Delete “${product}” (${ean})?`,

  // validation of EANs and products
  eanNotDigits: 'EAN must contain only digits',
  eanWrongLength: (n: number) => `EAN must have 13 digits (has ${n})`,
  eanWrongCheckDigit: (expected: string, actual: string) => `Wrong check digit: expected ${expected}, got ${actual}`,
  descriptionEmpty: 'Description is empty',
  eanExists: (ean: string, product: string) => `EAN ${ean} already exists: ${product}`,
  invalidEan: (ean: string, error: string) => `Invalid EAN “${ean}”: ${error}`,

  // description warnings
  unprintableChars: (chars: string) => `These characters can't be printed and would be garbled: ${chars}`,
  tooManyLines: (max: number, actual: number, hasLogo: boolean) =>
    `Only ${max} lines fit on a sticker${hasLogo ? ' with a logo' : ''}, this has ${actual}.`,
  lineTooLong: (line: string) => `Line “${line}” is too long and would be cut off.`,

  // settings dialog
  settingsTitle: 'Settings & data',
  language: 'Language',
  languageAuto: (detected: string) => `Automatic (${detected})`,
  logo: 'Logo',
  logoHint: 'Printed on every sticker above the description. Optional.',
  chooseImage: 'Choose image…',
  remove: 'Remove',
  noLogo: 'No logo',
  logoAlt: (name: string) => `Logo: ${name}`,
  notAnImage: 'This file is not an image the browser can read.',
  importExportTitle: 'Import & export products',
  importExportHintHtml:
    'CSV file with the columns <code>ean</code>, <code>description</code> and optionally <code>count</code>. ' +
    'Products with an EAN that’s already in the list are updated.',
  importCsv: 'Import CSV…',
  exportCsv: 'Export CSV',
  backupTitle: 'Backup',
  backupHint: 'Products and the logo are stored only in this browser on this device. Keep a backup file in case ' +
    'the browser data gets cleared, or to move to another computer.',
  backupToFile: 'Back up to a file',
  restoreFromBackup: 'Restore from backup…',
  lastBackup: (date: string, changedSince: boolean) =>
    `Last backup: ${date}${changedSince ? ' (there are changes since)' : ''}.`,
  notBackedUp: 'Not backed up yet.',
  installTitle: 'Install as an app',
  installHint: 'Then it opens in its own window, works offline and the browser keeps its data more reliably.',
  installStepsHtml:
    '<li><strong>Chrome, Edge:</strong> the install icon at the right of the address bar.</li>' +
    '<li><strong>Safari on Mac:</strong> File → Add to Dock.</li>' +
    '<li><strong>iPhone, iPad:</strong> Share → Add to Home Screen.</li>',
  sourceCode: 'Barcodes is open source:',

  // import and backup results
  nothingImported: 'Nothing was imported.',
  imported: (file: string, added: number, updated: number, unchanged: number) => {
    const parts = [
      added && plural(added, { one: 'new product', other: 'new products' }),
      updated && `${updated} updated`,
      unchanged && `${unchanged} unchanged`,
    ].filter(Boolean);
    return `Imported from ${file}: ${parts.join(', ') || 'nothing'}.`;
  },
  rowsSkipped: (n: number) => ` ${plural(n, { one: 'row was', other: 'rows were' })} skipped:`,
  andMore: (n: number) => `…and ${n} more`,
  confirmRestore: (current: number, restored: number, date: string) =>
    `Replace your ${plural(current, { one: 'product', other: 'products' })} with ` +
    `${plural(restored, { one: 'product', other: 'products' })} from the backup of ${date}?`,
  restored: (n: number, skipped: number) =>
    `Restored ${plural(n, { one: 'product', other: 'products' })}` +
    (skipped ? `, ${plural(skipped, { one: 'product was', other: 'products were' })} skipped:` : '.'),

  // CSV and backup errors
  row: (n: number) => `Row ${n}`,
  productNumber: (n: number) => `Product ${n}`,
  csvMissingColumns: (found: string) =>
    `The CSV needs a header with the columns “ean” and “description”, found: ${found || 'nothing'}`,
  csvEanAsNumber: (ean: string) =>
    `the EAN “${ean}” was converted to a number by a spreadsheet; format the column as text`,
  csvInvalidCount: (count: string) => `invalid count “${count}”`,
  backupNotJson: 'This is not a backup file (not valid JSON).',
  backupWrongFormat: 'This is not a backup file of this app.',
  backupWrongVersion: (version: unknown) => `Unsupported backup version ${version}. Is the app up to date?`,
  backupBadLogo: 'The logo in the backup is not a PNG or JPEG image.',
};

export type Messages = typeof en;

const cs: Messages = {
  locale: 'cs',
  languageName: 'Čeština',

  appName: 'Čárové kódy',
  appDescription: 'Tisk štítků s čárovými kódy EAN-13 pro vaše produkty na archy A4 s 3 × 8 štítky.',

  addProduct: 'Přidat produkt',
  settings: 'Nastavení',
  settingsAndData: 'Nastavení a data',
  backupBanner: 'Produkty jsou uložené jen v tomto prohlížeči. Zálohujte je do souboru pro případ, že se data prohlížeče smažou.',
  backupNow: 'Zálohovat teď',
  later: 'Později',
  storageUnavailable: 'Tento prohlížeč nedovoluje stránce ukládat data. Produkty se po zavření ztratí.',
  saveFailed: (error) => `Změny se nepodařilo uložit: ${error}`,

  products: 'Produkty',
  searchLabel: 'Hledat nebo naskenovat EAN',
  searchPlaceholder: 'Hledat nebo naskenovat EAN',
  selectedOnly: 'Jen vybrané',
  clearCounts: 'Vynulovat počty',
  productCount: (n) => plural(n, { one: 'produkt', few: 'produkty', other: 'produktů' }),
  visibleOfTotal: (visible, total) => `${visible} z ${total}`,
  libraryEmpty: 'Seznam produktů je prázdný',
  libraryEmptyHint: 'Produkty zadáte jen jednou. U každé dodávky pak stačí nastavit, kolik štítků vytisknout.',
  importCsvEllipsis: 'Importovat CSV…',
  trySample: 'Vyzkoušet s ukázkovými produkty',
  noMatch: (query) => `Hledání „${query}“ neodpovídá žádný produkt.`,
  addProductWithEan: (ean) => `Přidat produkt ${ean}`,
  noneSelected: 'Zatím nejsou vybrané žádné produkty.',
  editProduct: 'Upravit produkt',
  countLabel: (product) => `Počet štítků: ${product}`,
  oneLess: (product) => `O jeden méně: ${product}`,
  oneMore: (product) => `O jeden více: ${product}`,
  scanned: (product, count) => `+1 ${product} – nyní ${count}`,
  orderSummary: (stickers, products, sheets) => ({
    stickers: plural(stickers, { one: 'štítek', few: 'štítky', other: 'štítků' }),
    rest: ` pro ${plural(products, { one: 'produkt', few: 'produkty', other: 'produktů' })}` +
      ` na ${plural(sheets, { one: 'archu', few: 'arších', other: 'arších' })}`,
  }),
  noStickersSelected: 'Nejsou vybrané žádné štítky',
  confirmClearCounts: (stickers) =>
    `Vynulovat všechny počty? Celkem ${plural(stickers, { one: 'štítek', few: 'štítky', other: 'štítků' })}.`,

  stickers: 'Štítky',
  outlines: 'Obrysy',
  previewTitle: 'Náhled štítků v PDF',
  noStickersYet: 'Zatím žádné štítky',
  noStickersHint: 'Nastavte u produktů, kolik štítků potřebujete, a objeví se tady.',
  printHint: 'Tiskněte ve 100% velikosti („Skutečná velikost“), ne „Přizpůsobit stránce“.',
  openToPrint: 'Otevřít k tisku',
  downloadPdf: 'Stáhnout PDF',
  pdfFailed: 'PDF se nepodařilo vytvořit',
  newSheet: 'Nový arch',
  startAt: (position) => `Začít od ${position}`,
  partiallyUsedSheet: 'Načatý arch?',
  partiallyUsedHint: 'Klikněte na první volný štítek. Tisk začne od něj.',
  firstFreeSticker: 'První volný štítek',
  startAtSticker: (position, row, column) => `Začít štítkem ${position} (řádek ${row}, sloupec ${column})`,

  editProductTitle: 'Upravit produkt',
  addProductTitle: 'Přidat produkt',
  ean: 'EAN',
  eanPlaceholder: '13 číslic',
  description: 'Popis',
  descriptionHint: '(jak se vytiskne, každá položka na samostatný řádek)',
  delete: 'Smazat',
  cancel: 'Zrušit',
  save: 'Uložit',
  close: 'Zavřít',
  eanOnlyDigits: 'Jen číslice, prosím.',
  eanDigitsSoFar: (n) => `${n} z 13 číslic`,
  eanCheckDigitAdded: (digit) => `Kontrolní číslice ${digit} se doplní.`,
  eanWrongCheckDigitHint: (expected) => `Chybná kontrolní číslice (má být ${expected}). Není tam překlep?`,
  eanAlreadyInLibrary: (product) => `Už je v seznamu: ${product}`,
  eanValid: 'Platný EAN-13 ✓',
  confirmDelete: (product, ean) => `Smazat „${product}“ (${ean})?`,

  eanNotDigits: 'EAN smí obsahovat jen číslice',
  eanWrongLength: (n) => `EAN musí mít 13 číslic (má ${n})`,
  eanWrongCheckDigit: (expected, actual) => `Chybná kontrolní číslice: má být ${expected}, je ${actual}`,
  descriptionEmpty: 'Popis je prázdný',
  eanExists: (ean, product) => `EAN ${ean} už existuje: ${product}`,
  invalidEan: (ean, error) => `Neplatný EAN „${ean}“: ${error}`,

  unprintableChars: (chars) =>
    `Tyto znaky nejde vytisknout a byly by zkomolené: ${chars} – použijte písmena bez diakritiky.`,
  tooManyLines: (max, actual, hasLogo) =>
    `Na štítek${hasLogo ? ' s logem' : ''} se vejde nejvýš ${max} řádků, tento popis jich má ${actual}.`,
  lineTooLong: (line) => `Řádek „${line}“ je příliš dlouhý a byl by oříznutý.`,

  settingsTitle: 'Nastavení a data',
  language: 'Jazyk',
  languageAuto: (detected) => `Automaticky (${detected})`,
  logo: 'Logo',
  logoHint: 'Tiskne se na každý štítek nad popis. Nepovinné.',
  chooseImage: 'Vybrat obrázek…',
  remove: 'Odebrat',
  noLogo: 'Bez loga',
  logoAlt: (name) => `Logo: ${name}`,
  notAnImage: 'Tento soubor není obrázek, který prohlížeč umí přečíst.',
  importExportTitle: 'Import a export produktů',
  importExportHintHtml:
    'Soubor CSV se sloupci <code>ean</code>, <code>description</code> a volitelně <code>count</code> ' +
    '(nebo české <code>kód</code>, <code>popis</code>, <code>počet</code>). ' +
    'Produkty s EAN, který už v seznamu je, se aktualizují.',
  importCsv: 'Importovat CSV…',
  exportCsv: 'Exportovat CSV',
  backupTitle: 'Záloha',
  backupHint: 'Produkty a logo jsou uložené jen v tomto prohlížeči na tomto zařízení. Mějte zálohu v souboru ' +
    'pro případ, že se data prohlížeče smažou, nebo pro přenos na jiný počítač.',
  backupToFile: 'Zálohovat do souboru',
  restoreFromBackup: 'Obnovit ze zálohy…',
  lastBackup: (date, changedSince) => `Poslední záloha: ${date}${changedSince ? ' (od té doby jsou změny)' : ''}.`,
  notBackedUp: 'Zatím nezálohováno.',
  installTitle: 'Instalace jako aplikace',
  installHint: 'Pak se otevírá ve vlastním okně, funguje i offline a prohlížeč její data spolehlivěji uchovává.',
  installStepsHtml:
    '<li><strong>Chrome, Edge:</strong> ikona instalace vpravo v adresním řádku.</li>' +
    '<li><strong>Safari na Macu:</strong> Soubor → Přidat do Docku.</li>' +
    '<li><strong>iPhone, iPad:</strong> Sdílet → Přidat na plochu.</li>',
  sourceCode: 'Zdrojový kód aplikace:',

  nothingImported: 'Nic se neimportovalo.',
  imported: (file, added, updated, unchanged) =>
    `Import ze souboru ${file} – nové: ${added}, aktualizované: ${updated}, beze změny: ${unchanged}.`,
  rowsSkipped: (n) => ` Přeskočené řádky (${n}):`,
  andMore: (n) => `…a dalších ${n}`,
  confirmRestore: (current, restored, date) =>
    `Nahradit současné produkty (celkem ${current}) produkty ze zálohy z ${date} (celkem ${restored})?`,
  restored: (n, skipped) =>
    `Obnoveno produktů: ${n}` + (skipped ? `, přeskočeno: ${skipped}:` : '.'),

  row: (n) => `Řádek ${n}`,
  productNumber: (n) => `Produkt ${n}`,
  csvMissingColumns: (found) =>
    `CSV musí mít záhlaví se sloupci „ean“ a „description“ (nebo „kód“ a „popis“), nalezeno: ${found || 'nic'}`,
  csvEanAsNumber: (ean) => `EAN „${ean}“ převedl tabulkový program na číslo; nastavte sloupci formát text`,
  csvInvalidCount: (count) => `neplatný počet „${count}“`,
  backupNotJson: 'Toto není soubor se zálohou (neplatný JSON).',
  backupWrongFormat: 'Toto není soubor se zálohou této aplikace.',
  backupWrongVersion: (version) => `Nepodporovaná verze zálohy ${version}. Je aplikace aktuální?`,
  backupBadLogo: 'Logo v záloze není obrázek PNG ani JPEG.',
};

const dictionaries: Record<Language, Messages> = { en, cs };

/** The dictionary of the current language. */
export let t: Messages = en;
export let language: Language = 'en';

export function setLanguage(lang: Language): void {
  language = lang;
  t = dictionaries[lang];
  pluralRules = new Intl.PluralRules(lang);
}

export function languageName(lang: Language): string {
  return dictionaries[lang].languageName;
}

/**
 * The first supported language from the browser's preferred languages.
 * Slovak speakers get Czech, which is closer to them than English.
 */
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split('-')[0];
    if (primary === 'cs' || primary === 'sk') return 'cs';
    if (primary === 'en') return 'en';
  }
  return 'en';
}

export function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language].filter(Boolean);
}

export function resolveLanguage(setting: LanguageSetting, preferred = browserLanguages()): Language {
  return setting === 'auto' ? detectLanguage(preferred) : setting;
}

/**
 * Translate the static page: elements with data-i18n (text), data-i18n-html
 * (markup from the dictionary) and data-i18n-attr ("attr:key;attr2:key2").
 */
export function translatePage(root: ParentNode = document): void {
  const lookup = (key: string): string => {
    const value = (t as Record<string, unknown>)[key];
    if (typeof value !== 'string') throw new Error(`Missing translation: ${key}`);
    return value;
  };
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = lookup(el.dataset.i18n!);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-html]')) {
    el.innerHTML = lookup(el.dataset.i18nHtml!);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr!.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      el.setAttribute(attr, lookup(key));
    }
  }
  if (root === document) {
    document.documentElement.lang = language;
    document.title = t.appName;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.appDescription);
  }
}
