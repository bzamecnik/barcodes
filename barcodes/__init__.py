import csv
from reportlab.graphics.barcode import eanbc
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.pdfgen.canvas import Canvas
from reportlab.graphics import renderPDF


def labels_csv_to_pdf(csv_path, pdf_path, logo_path):
    with open(csv_path) as csv_file:
        eans, texts = generate_values_from_csv(csv_file)
    generate_pdf(eans, texts, pdf_path, logo_path)


def generate_values_from_csv(csv_file):
    return generate_values(csv.DictReader(csv_file))


def generate_values(products):
    eans = []
    texts = []
    for product in products:
        count = int(product['count'])
        eans.extend(count * [product['ean']])
        texts.extend(count * [product['description']])

    return eans, texts


def generate_pdf(eans, texts, path, logo_path, page_size=A4, show_border=False):
    canvas = Canvas(path, pagesize=page_size)

    # both top and bottom
    y_margin = 4.5 * mm

    x_count, y_count = 3, 8
    items_per_page = x_count * y_count
    # size of one label
    # 70, 36
    x_size = page_size[0] / x_count
    y_size = (page_size[1] - 2 * y_margin) / y_count

    # size of one bar code
    code_width = 37 * mm
    code_height = 26 * mm

    for i, (ean, text) in enumerate(zip(eans, texts)):
        index_on_page = (i % items_per_page)
        row = index_on_page // x_count
        col = index_on_page % x_count

        if index_on_page == 0 and i > 0:
            canvas.showPage()

        if index_on_page == 0:
            canvas.translate(0, y_margin)

        if not ean:
            continue

        canvas.saveState()

        # fill columns from top
        canvas.translate(x_size * col, y_size * (y_count - 1 - row))

        if show_border:
            canvas.rect(0, 0, x_size, y_size)

        barcode_eanbc13 = eanbc.Ean13BarcodeWidget(ean)
        drawing = Drawing(code_width, code_height)
        drawing.add(barcode_eanbc13)
        renderPDF.draw(drawing, canvas,
                       2 * mm,
                       (y_size - code_height) / 2)

        img_height = 0.7 * cm
        img_width = 400 / 120 * img_height
        img_bottom = y_size - img_height - (y_size - code_height) / 2
        canvas.drawImage(logo_path,
                         code_width + 2 * mm,
                         img_bottom,
                         width=img_width,
                         height=img_height)

        textobject = canvas.beginText()
        textobject.setTextOrigin(code_width + 2 * mm, img_bottom - 5 * mm)
        textobject.setFont("Helvetica", 9)
        textobject.textLines(text.strip())
        canvas.drawText(textobject)

        canvas.restoreState()

    canvas.save()
