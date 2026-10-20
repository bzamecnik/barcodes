import argparse
import csv
from datetime import datetime
import os
import webbrowser
from io import BytesIO, StringIO
from threading import Timer
from sqlite3 import IntegrityError

from flask import Flask, render_template, redirect, request, make_response, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import asc

from platformdirs import user_data_dir

from barcodes import generate_pdf, generate_values


def default_database_uri():
    """SQLite file in the per-user data dir (~/Library/Application Support/barcodes on a Mac)."""
    data_dir = user_data_dir('barcodes')
    os.makedirs(data_dir, exist_ok=True)
    return f'sqlite:///{os.path.join(data_dir, "barcodes.db")}'


app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URI') or default_database_uri()
db = SQLAlchemy()

logo_path = os.path.join(os.path.dirname(__file__), '..', 'logo.png')


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ean = db.Column(db.String(13), unique=True, nullable=False)
    description = db.Column(db.String(50), unique=False, nullable=False)

    def __repr__(self):
        return '<Product %r %r>' % (self.ean, self._remove_newlines(self.description))

    @staticmethod
    def _remove_newlines(text):
        return text.replace('\n', '\\n') if text else text


with app.app_context():
    db.init_app(app)
    db.create_all()


@app.route('/')
def index():
    return redirect(url_for('list_products'))


@app.route('/pdf', methods=['POST'])
def pdf():
    products = Product.query.order_by(asc(Product.id)).all()
    counts = [int(c or 0) for c in request.form.getlist('count')]
    product_ids = [int(p) for p in request.form.getlist('product_id')]
    counts = [c for _, c in sorted(zip(product_ids, counts))]
    counted_products = sorted(
        [{'ean': p.ean, 'description': p.description, 'count': count} for p, count in zip(products, counts)],
        key=lambda item: item['ean'])
    eans, texts = generate_values(counted_products)

    with BytesIO() as pdf_file:
        generate_pdf(eans, texts, pdf_file, logo_path)
        response = make_response(pdf_file.getvalue())

    now = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f'barcodes_{now}.pdf'
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = \
        f'inline; filename={file_name}'

    return response


@app.route('/products', methods=['GET'])
def list_products():
    products = Product.query.order_by(asc(Product.ean)).all()
    return render_template('products.html', products=products)


@app.route('/products/new', methods=['POST'])
def add_product():
    """Add or edit product (it there's already the same EAN)."""
    product = Product.query.filter_by(ean=request.form['ean']).first()
    product_id = product.id if product else None
    product = Product(id=product_id, **{key: request.form[key] for key in ['ean', 'description']})
    db.session.merge(product)
    db.session.commit()
    return redirect(url_for('list_products'))


@app.route('/products/delete/<id>', methods=['GET'])
def delete_product(id):
    product = db.session.get(Product, id)
    db.session.delete(product)
    db.session.commit()
    return redirect(url_for('list_products'))


@app.route('/products/csv', methods=['GET'])
def export_csv():
    products = Product.query.order_by(asc(Product.ean)).all()
    with StringIO() as csv_file:
        writer = csv.DictWriter(csv_file, ['ean', 'description'])
        writer.writeheader()
        for product in products:
            writer.writerow({'ean': product.ean, 'description': product.description})
        response = make_response(csv_file.getvalue())

    now = datetime.now().strftime('%Y%m%d_%H%M%S')
    file_name = f'barcodes_{now}.csv'
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = \
        f'inline; filename={file_name}'

    return response


def main():
    """Run the web app locally and open it in the browser."""
    parser = argparse.ArgumentParser('barcodes-web', description='Run the barcodes web app.')
    parser.add_argument('--host', default='127.0.0.1')
    # not 5000, it's taken by AirPlay Receiver on macOS
    parser.add_argument('--port', type=int, default=5001)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()

    url = f'http://{args.host}:{args.port}/'
    if not args.no_browser:
        Timer(1.0, webbrowser.open, args=[url]).start()
    print(f'Barcodes running at {url} (stop with Ctrl+C)')
    app.run(host=args.host, port=args.port)
