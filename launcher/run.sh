#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if command -v python3 >/dev/null 2>&1; then
  exec python3 "$SCRIPT_DIR/start_app.py" "$@"
fi

if command -v python >/dev/null 2>&1; then
  exec python "$SCRIPT_DIR/start_app.py" "$@"
fi

echo "Python 3 was not found."
echo "Install Python 3.11+ and Node.js 20+, then run launcher/run.sh again."
exit 1
