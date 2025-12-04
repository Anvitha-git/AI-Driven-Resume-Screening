# Rasa actions server Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt || true

COPY actions.py ./
COPY __init__.py ./

ENV PORT=10000
EXPOSE 10000
CMD ["bash", "-lc", "rasa run actions --port $PORT"]
