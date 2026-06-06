# ...existing code...
#!/usr/bin/env bash
set -euo pipefail

##### --rm to reset db, --npm to install npm dependencies (all package.json's), --test to run tests in ./tests

DO_RM=0
DO_NPM=0
DO_TEST=0

for arg in "$@"; do
  case "$arg" in
    --rm) DO_RM=1 ;;
    --npm) DO_NPM=1 ;;
    --test) DO_TEST=1 ;;
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
  echo "[2/5] Installing npm dependencies for all package.json files found..."
  # Find all package.json files excluding node_modules and hidden directories
  IFS=$'\n' read -r -d '' -a pkg_files < <(find "$ROOT_DIR" -type f -name package.json -not -path "*/node_modules/*" -not -path "*/.git/*" && printf '\0')
  declare -A INSTALLED_DIRS=()
  for pkg in "${pkg_files[@]:-}"; do
    dir="$(dirname "$pkg")"
    # Avoid duplicate installs if same dir appears twice for some reason
    if [[ -n "${INSTALLED_DIRS[$dir]:-}" ]]; then
      continue
    fi
    echo "  -> Installing in $dir"
    (cd "$dir" && npm install)
    INSTALLED_DIRS["$dir"]=1
  done
fi

if [[ "$DO_TEST" -eq 1 ]]; then
  echo "[3/5] Running tests in ./tests ..."
  (cd "$ROOT_DIR" && npm test -- tests)
  exit $?
fi

echo "[4/5] Starting server and client..."
(cd "$SERVER_DIR" && node index.js) &
SERVER_PID=$!

sleep 2
(cd "$CLIENT_DIR" && npm start) &
CLIENT_PID=$!

trap 'echo "Stopping..."; kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true' INT TERM EXIT

wait "$SERVER_PID" "$CLIENT_PID"
# ...existing code...
