# Barcodes

A tool to lay out product barcodes from a CSV to a PDF.

It lays out up to 24 (3x8) stickers of size 70x36 mm per each A4 page.

There can be an EAN13 code, up to 4 lines of short description and a logo.

## Web app

The web app in [`web/`](web/) runs entirely in the browser and produces the
same PDF layout as the Python version. It's deployed to GitHub Pages by
`.github/workflows/pages.yml`: https://bzamecnik.github.io/barcodes/

It keeps a small library of products (EAN + description). For each delivery,
set how many stickers you need for each product, check the preview and print.

- **Counts:** type them, use the +/- buttons, or scan the products with a
  barcode scanner into the search box (each scan adds one sticker; an unknown
  EAN opens the form to add the product).
- **Partially used sheet:** choose the first free sticker ("New sheet" button
  above the preview).
- **Printing:** print the PDF at 100 % ("Actual size"), not "Fit to page".
- **Logo:** optional, in Settings. It's printed above the description.
- **Data** stays in the browser (localStorage), nothing is sent anywhere. Use
  Settings → *Back up to a file* to keep a copy; the app reminds you. Browsers
  may clear data of sites not visited for a while (Safari after 7 days), unless
  the app is installed (Chrome/Edge: install icon in the address bar; Safari on
  Mac: File → Add to Dock; iOS: Share → Add to Home Screen). Installed, it also
  works offline.
- **Language:** English or Czech, chosen by the browser's preferred languages
  (Slovak gets Czech too); it can be changed in Settings.
- **CSV import/export:** columns `ean`, `description` and optionally `count`;
  comma or semicolon separated. To move from the Python web app, use its
  "Export to CSV" and import the file in Settings.

### Development

```shell
cd web
npm install
npm run dev     # local dev server
npm test        # unit tests and a smoke test of the page (happy-dom)
npm run build   # static site in web/dist
# render a PDF from a CSV without a browser (to compare with the Python output):
node scripts/render-pdf.ts ../products.csv labels.pdf --logo ../barcodes/logo.png
```

### Design decisions

- **Own EAN-13 encoder** (`src/ean13.ts`, ~60 lines ported from reportlab)
  instead of a barcode library. The goal was a pixel-identical output to the
  Python version (verified by rendering both PDFs at 600 dpi), so that the
  stickers keep matching the sheets. That depends on reportlab's exact
  geometry (module width, bar heights, guard bars, digit positions). Barcode
  libraries such as JsBarcode or bwip-js render to canvas/SVG with their own
  geometry, so using them would mean converting their output into vector
  shapes in jsPDF and adjusting it - about as much code as the encoder. EAN-13
  is a frozen standard, so there's nothing to maintain. For other symbologies
  (Code 128, QR) a library like bwip-js would be the right choice.
- **PapaParse for CSV** rather than an own parser: real-world CSV files vary a
  lot (separators - Excel with Czech settings uses semicolons -, quoting,
  multi-line fields, broken rows). The app adds on top: Czech column names,
  decoding of Windows-1250 files and detection of EANs mangled into numbers by
  spreadsheets.
- **jsPDF with the built-in Helvetica**, like reportlab. No fonts are embedded,
  which keeps the PDFs small, but only Windows-1252 characters can be printed
  (no Czech diacritics like č, ř). The app warns about other characters.
  Supporting them would mean embedding a TTF font.
- **localStorage** rather than IndexedDB: the data is small (products and a
  logo of at most a few hundred kB), a synchronous API keeps the code simple
  and both have the same eviction rules. A backup file is the safety net.
- **Translations** (`src/i18n.ts`) without a library: one typed dictionary per
  language, so TypeScript reports any missing Czech string. Plurals use
  `Intl.PluralRules` (Czech: 1 štítek, 2 štítky, 5 štítků). Static texts in
  `index.html` are marked with `data-i18n` attributes. Changing the language
  reloads the page rather than re-rendering everything live, as it's rare.
  The PDF has no texts to translate; CSV column names stay English for
  compatibility with the `barcodes` command (Czech ones are accepted on import).
- **No UI framework:** the UI is small, plain TypeScript with a tiny DOM
  helper (`src/ui/dom.ts`) is enough and keeps the dependencies minimal.
- **Hand-written service worker** (`public/sw.js`, network first) rather than a
  Workbox plugin: online, the latest version is always loaded, so updates
  arrive without any prompt; offline, the cached version is used.
- **Dependencies:** jsPDF and PapaParse at runtime. Recently released versions
  are avoided as a precaution against supply-chain attacks (e.g. PapaParse is
  pinned to 5.7.0).

## Python version

### Installation (macOS)

The easiest way is [uv](https://docs.astral.sh/uv/), which also takes care of
installing a suitable Python. Open the Terminal app and run:

```shell
# 1. install uv (one-time)
curl -LsSf https://astral.sh/uv/install.sh | sh
# (or with Homebrew: brew install uv)

# 2. install the barcodes tool (one-time; open a new Terminal window first)
uv tool install git+https://github.com/bzamecnik/barcodes
```

That's it. It gives you two commands, `barcodes` and `barcodes-web`.

To run the web application (it opens in your browser, stop it with Ctrl+C):

```shell
barcodes-web
```

Your products are stored in `~/Library/Application Support/barcodes/barcodes.db`.
Use the "export to CSV" function to back them up.

To upgrade to the latest version later:

```shell
uv tool upgrade barcodes
```

To try it without installing anything permanently:

```shell
uvx --from git+https://github.com/bzamecnik/barcodes barcodes-web
```

For development: `uv sync` in a checkout, then `uv run barcodes-web`.

### Usage

As a script:

`products.csv`:

```
ean,count,description
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
```

```shell
barcodes products.csv labels.pdf -l logo.png
```

Or as a web application:

```shell
barcodes-web              # http://127.0.0.1:5001, opens the browser
barcodes-web --port 8000  # use another port
```

Note: port 5000 is not used by default since it's taken by AirPlay Receiver on macOS.

For development:

```shell
FLASK_APP=barcodes.webapp FLASK_DEBUG=True flask run --port 5001
```

You can fill in the CSV into a text area nad generate a PDF.

#### Docker

Building and running for development.

```shell
docker build . -t barcodes
docker volume create barcodes-db
docker run --rm -it -p 5000:5000 -v barcodes-db:/data barcodes
```

Building, publishing and running for production.

```shell
VERSION=0.3.0
docker build . -t bzamecnik/barcodes:$VERSION
docker push bzamecnik/barcodes:$VERSION

# production:
# create volume once
docker volume create barcodes-db
docker pull bzamecnik/barcodes:$VERSION
docker run -d --restart on-failure:10 -p 5000:5000 -v barcodes-db:/data --name barcodes bzamecnik/barcodes:$VERSION
```
