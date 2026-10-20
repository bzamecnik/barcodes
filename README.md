# Barcodes

A tool to lay out product barcodes from a CSV to a PDF.

It lays out up to 21 (8x3) stickers of size 70x36 mm per each A4 page.

There can be an EAN13 code, up to 4 lines of short description and a logo.

## Installation (macOS)

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
barcodes-web              # http://127.0.0.1:5001, opens the browser
barcodes-web --port 8000  # use another port
```

Note: port 5000 is not used by default since it's taken by AirPlay Receiver on macOS.

For development:

```shell
FLASK_APP=barcodes.webapp FLASK_DEBUG=True flask run --port 5001
```

You can fill in the CSV into a text area nad generate a PDF.

### Docker

Building and running for development.

```shell
docker build . -t barcodes
docker volume create barcodes-db
docker run --rm -it -p 5000:5000 -v barcodes-db:/data barcodes
```

Building, publishing and running for production.

```shell
VERSION=0.2.0
docker build . -t bzamecnik/barcodes:$VERSION
docker push bzamecnik/barcodes:$VERSION

# production:
# create volume once
docker volume create barcodes-db
docker pull bzamecnik/barcodes:$VERSION
docker run -d --restart on-failure:10 -p 5000:5000 -v barcodes-db:/data --name barcodes bzamecnik/barcodes:$VERSION
```
