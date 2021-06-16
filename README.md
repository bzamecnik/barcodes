# Barcodes

A service to lay out product barcodes to PDF.

## Installation

```shell
pip install .
```

Uses ReportLab and Pandas.

## Usage

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
