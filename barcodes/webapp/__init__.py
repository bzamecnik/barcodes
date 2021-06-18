import csv
from datetime import datetime
import os
from io import BytesIO, StringIO
from flask import Flask, render_template, redirect, request, make_response, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import asc

import barcodes
from barcodes import generate_pdf, generate_values

db_dir = os.path.abspath(os.path.dirname(barcodes.__file__))

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URI', f'sqlite:///{db_dir}/barcodes.db')
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
    counts = request.form.getlist('count')
    product_ids = request.form.getlist('product_id')
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
    product = Product(**{key: request.form[key] for key in ['ean', 'description']})
    db.session.add(product)
    db.session.commit()
    return redirect(url_for('list_products'))


@app.route('/products/delete/<id>', methods=['GET'])
def delete_product(id):
    product = Product.query.get(id)
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
