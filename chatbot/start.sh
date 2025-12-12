#!/bin/sh
set -e

echo "Starting container entrypoint script"

# Use the PORT env var provided by the host (Render), default to 5005
PORT=${PORT:-5005}

# Runtime defensive env limits: ensure numerical libs / TF don't spawn many threads
# If Render or the runtime already set these, keep them; otherwise default to 1.
: ${OMP_NUM_THREADS:=1}
: ${OPENBLAS_NUM_THREADS:=1}
: ${MKL_NUM_THREADS:=1}
: ${VECLIB_MAXIMUM_THREADS:=1}
: ${NUMEXPR_NUM_THREADS:=1}
: ${TF_NUM_INTRAOP_THREADS:=1}
: ${TF_NUM_INTEROP_THREADS:=1}
: ${TF_CPP_MIN_LOG_LEVEL:=2}
: ${TF_FORCE_GPU_ALLOW_GROWTH:=true}
: ${RASA_TELEMETRY_ENABLED:=false}

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

  # Start a lightweight proxy that immediately binds the assigned PORT and
  # forwards requests to an internal Rasa port (RASA_INTERNAL_PORT). This
  # ensures Render detects an open port quickly while the model loads.
  RASA_INTERNAL_PORT=${RASA_INTERNAL_PORT:-5005}

  echo "Starting proxy on PORT=$PORT forwarding to internal Rasa port $RASA_INTERNAL_PORT"
  python3 /app/proxy.py &
  PROXY_PID=$!
  echo "Proxy PID: $PROXY_PID"

  # Start Rasa on the internal port so the proxy can forward to it.
  echo "Starting Rasa server on internal port $RASA_INTERNAL_PORT"
  rasa run --enable-api --cors "*" --port "$RASA_INTERNAL_PORT" --model "$model_arg" &
  RASA_PID=$!
  echo "Rasa PID: $RASA_PID"

  # Poll the proxy's /status endpoint until it returns HTTP 200 or until timeout.
  timeout_seconds=300
  elapsed=0
  interval=2
  echo "Waiting up to ${timeout_seconds}s for Rasa /status on http://127.0.0.1:${PORT}/status"
  until curl -sSf "http://127.0.0.1:${PORT}/status" >/dev/null 2>&1; do
    if ! kill -0 "$RASA_PID" >/dev/null 2>&1; then
      echo "Rasa process exited unexpectedly. Check earlier logs for errors."
      wait "$RASA_PID" || true
      exit 1
    fi
    sleep $interval
    elapsed=$((elapsed + interval))
    if [ $elapsed -ge $timeout_seconds ]; then
      echo "Timed out waiting for Rasa /status after ${timeout_seconds}s"
      # Keep container running to allow Render logs to be inspected
      tail -f /dev/null
    fi
  done

  echo "Rasa /status is responding through proxy. Tailing rasa logs (PID $RASA_PID)"
  wait "$RASA_PID"
