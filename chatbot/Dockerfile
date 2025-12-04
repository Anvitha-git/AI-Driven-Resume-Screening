# Rasa server Dockerfile
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system deps
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Rasa
RUN pip install --no-cache-dir rasa==3.6.20

# Copy project files
COPY config.yml ./
COPY domain.yml ./
COPY endpoints.yml ./
COPY credentials.yml ./
COPY data ./data
COPY models ./models

# Enable CORS for web clients; bind to Render's $PORT
ENV PORT=10000
EXPOSE 10000
CMD ["bash", "-lc", "rasa run --enable-api --cors '*' --port $PORT"]
