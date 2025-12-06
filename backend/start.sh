#!/usr/bin/env bash
set -euo pipefail

# Use PORT provided by the hosting service (Render sets $PORT).
# Fall back to 10000 only for local/dev convenience.
PORT="${PORT:-10000}"

# Run uvicorn with a single worker to reduce memory footprint.
# Use exec so pid 1 is uvicorn (better process handling).
exec uvicorn main:app --host 0.0.0.0 --port "$PORT" --workers 1
