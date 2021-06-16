import argparse

from . import labels_csv_to_pdf


def main():
    args = parse_args()
    labels_csv_to_pdf(args.csv_path, args.pdf_path, args.logo_path)


def parse_args():
    parser = argparse.ArgumentParser('barcodes')
    parser.add_argument('csv_path', metavar='CSV_PATH')
    parser.add_argument('pdf_path', metavar='PDF_PATH')
    parser.add_argument('-l', '--logo-path')
    return parser.parse_args()


if __name__ == '__main__':
    main()
