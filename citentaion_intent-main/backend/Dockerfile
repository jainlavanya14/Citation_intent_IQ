FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY microservice.py .
COPY m3_results.json .

EXPOSE 10000

CMD ["uvicorn", "microservice:app", "--host", "0.0.0.0", "--port", "10000"]