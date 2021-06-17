# Barcodes

A service to lay out product barcodes from a CSV to a PDF.

It lays out up to 21 (8x3) stickers of size 70x36 mm per each A4 page.

There can be an EAN13 code, up to 4 lines of short description and a logo.

## Installation

```shell
pip install .
```

Uses ReportLab and Pandas.

## Usage

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
FLASK_APP=barcodes.webapp flask run
open http://localhost:5000

# or for development
FLASK_APP=barcodes.webapp FLASK_DEBUG=True flask run
```

You can fill in the CSV into a text area nad generate a PDF.

### Docker

```shell
docker build . -t barcodes
docker volume create barcodes-db
docker run --rm -it -p 5000:5000 -v barcodes-db:/data barcodes
```
