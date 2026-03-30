#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env ]]; then
  echo "Copiez .env.example vers .env et configurez la base de données." >&2
  exit 1
fi
if [[ ! -f vendor/autoload.php ]]; then
  echo "Exécutez: composer install" >&2
  exit 1
fi
php "$ROOT/scripts/migrate.php"
