FROM python:3.8-slim-buster

WORKDIR /app
COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt
COPY . .
ENV FLASK_APP=barcodes.webapp
ENV DATABASE_URI=sqlite:////data/barcodes.db
CMD [ "python3", "-m" , "flask", "run", "--host=0.0.0.0"]
