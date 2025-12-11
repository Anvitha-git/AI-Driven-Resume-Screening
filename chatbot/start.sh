#!/bin/sh
set -e

echo "Starting container entrypoint script"

# If MODEL_URL is provided, download and extract it to /app/models
if [ -n "$MODEL_URL" ]; then
  echo "MODEL_URL provided, downloading model..."
  mkdir -p /app/models
  # Download to a temp file then extract
  tmpfile="/tmp/model.tar.gz"
  echo "Downloading $MODEL_URL to $tmpfile"
  curl -sSL "$MODEL_URL" -o "$tmpfile"
  echo "Extracting model to /app/models"
  tar -xzf "$tmpfile" -C /app/models
  rm -f "$tmpfile"
  echo "Model downloaded and extracted"
else
  echo "No MODEL_URL provided. Using any model present in /app/models or /app/models/*.tar.gz"
fi

echo "Starting Rasa server"
exec rasa run --enable-api --cors "*" --port 5005
