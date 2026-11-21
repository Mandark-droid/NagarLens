#!/bin/sh
# Start the API, wait until it answers, then serve the web app on the public port.
set -e
cd /app

python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 &

i=0
until python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 120 ]; then
    echo "The API did not start within 120 seconds." >&2
    exit 1
  fi
  sleep 1
done
echo "API is up; starting the web app on port ${PORT:-7860}."

cd /app/frontend
exec node node_modules/next/dist/bin/next start -p "${PORT:-7860}" -H 0.0.0.0
