from datetime import datetime
import os
from io import StringIO, BytesIO
import pandas as pd
from flask import Flask, render_template, request, make_response

from barcodes import generate_values_from_df, generate_pdf

app = Flask(__name__)

logo_path = os.path.join(os.path.dirname(__file__), '..', '..', 'prototype', 's3dt-logo-en-black-on-white-800-240.png')


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/pdf', methods=['POST'])
def pdf():
    csv_str = request.form['products']
    with StringIO(csv_str) as csv_file:
        df = pd.read_csv(csv_file)
    eans, texts = generate_values_from_df(df)

    with BytesIO() as pdf_file:
        generate_pdf(eans, texts, pdf_file, logo_path)
        response = make_response(pdf_file.getvalue())

    now = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f'barcodes_{now}.pdf'
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = \
        f'inline; filename={file_name}.pdf'

    return response
