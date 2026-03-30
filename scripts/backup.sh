#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env ]]; then
  echo "Copiez .env.example vers .env et configurez la base." >&2
  exit 1
fi
OUT="${1:-$ROOT/storage/backup-$(date +%Y%m%d-%H%M%S).sql.gz}"
mkdir -p "$(dirname "$OUT")"
# shellcheck disable=SC1091
set -a
source .env
set +a
DBN="${DB_NAME:-eventflow}"
if [[ -z "${DB_USER:-}" ]]; then
  echo "DB_USER manquant dans .env" >&2
  exit 1
fi
mysqldump -h "${DB_HOST:-127.0.0.1}" -u "$DB_USER" -p"${DB_PASS:-}" "$DBN" | gzip > "$OUT"
echo "Sauvegarde: $OUT"
