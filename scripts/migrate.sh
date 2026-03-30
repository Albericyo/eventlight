#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env ]]; then
  echo "Copiez .env.example vers .env et configurez DB_DSN / DB_USER / DB_PASS" >&2
  exit 1
fi
# shellcheck source=/dev/null
source .env 2>/dev/null || true
MYSQL="${MYSQL:-mysql}"
if [[ -n "${DB_DSN:-}" ]]; then
  echo "Importez migrations/001_eventflow_init.sql via votre client MySQL (phpMyAdmin, mysql CLI) vers la base configurée dans DB_DSN."
fi
"$MYSQL" -h "${DB_HOST:-127.0.0.1}" -u "${DB_USER:-root}" -p"${DB_PASS:-}" "${DB_NAME:-eventflow}" < "$ROOT/migrations/001_eventflow_init.sql"
echo "Migration appliquée."
