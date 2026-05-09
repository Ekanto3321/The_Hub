#!/usr/bin/env bash
set -euo pipefail

##### --rm to reset db, --npm to install npm dependencies

DO_RM=0
DO_NPM=0

for arg in "$@"; do
  case "$arg" in
    --rm) DO_RM=1 ;;
    --npm) DO_NPM=1 ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"
DB_FILE="$SERVER_DIR/dev.db"

if [[ "$DO_RM" -eq 1 ]]; then
  echo "[1/5] Resetting database..."
  if [[ -f "$DB_FILE" ]]; then
    rm -f "$DB_FILE"
  fi
  rm -f "$SERVER_DIR/prisma/dev.db" "$SERVER_DIR/prisma/*.db" 2>/dev/null || true
  (cd "$SERVER_DIR" && npx prisma migrate reset --force --skip-seed)
  (cd "$SERVER_DIR" && npx prisma generate && npx prisma db push)
fi

if [[ "$DO_NPM" -eq 1 ]]; then
  echo "[2/5] Installing server dependencies..."
  (cd "$SERVER_DIR" && npm install)
  echo "[3/5] Installing client dependencies..."
  (cd "$CLIENT_DIR" && npm install)
fi

echo "[4/5] Starting server and client..."
(cd "$SERVER_DIR" && node index.js) &
SERVER_PID=$!

sleep 2
(cd "$CLIENT_DIR" && npm start) &
CLIENT_PID=$!

trap 'echo "Stopping..."; kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true' INT TERM EXIT

wait "$SERVER_PID" "$CLIENT_PID"