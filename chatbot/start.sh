#!/bin/sh
set -e

echo "Starting container entrypoint script"

# Use the PORT env var provided by the host (Render), default to 5005
PORT=${PORT:-5005}

# If MODEL_URL is provided, download and extract it to /app/models
if [ -n "$MODEL_URL" ]; then
  echo "MODEL_URL provided, downloading model..."
  mkdir -p /app/models
  tmpfile="/tmp/model.tar.gz"
  echo "Downloading $MODEL_URL to $tmpfile"
  curl -sSL "$MODEL_URL" -o "$tmpfile"
  echo "Extracting model to /app/models"
  # Try extracting; if the archive is actually a single .tar.gz that Rasa can use
  # as-is, also place it into /app/models so `rasa run -m models` can find it.
  if tar -tzf "$tmpfile" >/dev/null 2>&1; then
    tar -xzf "$tmpfile" -C /app/models || true
    # If extraction didn't create expected files, also move the tarball
    if [ ! "$(ls -A /app/models 2>/dev/null)" ]; then
      mv "$tmpfile" /app/models/
    else
      rm -f "$tmpfile"
    fi
  else
    echo "Downloaded file is not a valid tar.gz; moving into /app/models"
    mv "$tmpfile" /app/models/
  fi
  echo "Model placed into /app/models"
else
  echo "No MODEL_URL provided. Using any model present in /app/models or /app/models/*.tar.gz"
fi

echo "Starting Rasa server on port $PORT"
exec rasa run --enable-api --cors "*" --port "$PORT" --model models
