FROM python:3.13-slim

WORKDIR /app
COPY pyproject.toml README.md ./
COPY barcodes barcodes
RUN pip3 install --no-cache-dir .
ENV FLASK_APP=barcodes.webapp
ENV DATABASE_URI=sqlite:////data/barcodes.db
CMD [ "python3", "-m" , "flask", "run", "--host=0.0.0.0"]
