#!/bin/sh
set -e

echo "Starting container entrypoint script"

# Use the PORT env var provided by the host (Render), default to 5005
PORT=${PORT:-5005}

# If MODEL_URL is provided, download and extract it to /app/models
if [ -n "$MODEL_URL" ]; then
  echo "MODEL_URL provided, downloading model..."
  tmpfile="/tmp/model.tar.gz"
  echo "Downloading $MODEL_URL to $tmpfile"
  curl -sSL "$MODEL_URL" -o "$tmpfile"

  echo "Downloaded model file size: $(stat -c%s "$tmpfile" 2>/dev/null || ls -l "$tmpfile")"

  # List the tar contents for debugging so logs show what is inside the archive
  if tar -tzf "$tmpfile" >/dev/null 2>&1; then
    echo "Tar archive contents (first 200 entries):"
    tar -tzf "$tmpfile" | sed -n '1,200p'
  else
    echo "Downloaded file is not a valid tar.gz archive"
  fi

  # Prefer passing the raw tarball to Rasa rather than extracting into /app
  # because /app may not be writable by the container user. Move the tarball
  # into /app/models if possible, otherwise keep it in /tmp and point Rasa
  # at that file directly.
  model_arg="models"
  if mkdir -p /app/models 2>/dev/null && [ -w /app/models ]; then
    echo "Moving tarball into /app/models"
    mv "$tmpfile" /app/models/ || echo "mv to /app/models failed"
    model_arg="/app/models/$(basename "$tmpfile")"
  else
    echo "/app/models is not writable; using tarball in /tmp"
    model_arg="$tmpfile"
  fi
  echo "Model placed at: $model_arg"
else
  echo "No MODEL_URL provided. Using any model present in /app/models or /app/models/*.tar.gz"
fi

  echo "Model directory listing (for debugging):"
  # show model files so render logs include what was put into /app/models
  ls -laR /app/models || echo "/app/models is empty or inaccessible"

  echo "Starting Rasa server on port $PORT"
exec rasa run --enable-api --cors "*" --port "$PORT" --model "$model_arg"
