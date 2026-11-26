#!/usr/bin/env bash
# vokter-actualizar — trae la última versión de GitHub y la publica. Lo ejecuta el servidor cada 5 minutos.
# Manual:  sudo vokter-actualizar --forzar
set -euo pipefail

REPO_DIR=/opt/vokter
WEB_DIR=/var/www/vokter

cd "$REPO_DIR"
git fetch -q --depth 1 origin main
if [ "${1:-}" != "--forzar" ] && [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
  exit 0
fi
git reset -q --hard origin/main
git clean -qfd

# Se publica todo el repositorio menos lo interno: historial de git, scripts del servidor,
# funciones del backend, documentación, llaves de firma y archivos de datos.
rsync -a --delete \
  --exclude '.git' --exclude '.github' \
  --exclude 'deploy/' --exclude 'supabase/' --exclude 'docs/' \
  --exclude '*.keystore' --exclude '*.jks' \
  --exclude '*.md' --exclude '*.sql' --exclude '*.csv' --exclude 'Data_Comercio*' \
  "$REPO_DIR"/ "$WEB_DIR"/
find "$WEB_DIR" -type d -exec chmod 755 {} + && find "$WEB_DIR" -type f -exec chmod 644 {} +

logger -t vokter "Tienda actualizada a $(git rev-parse --short HEAD)"
echo "Tienda actualizada a $(git rev-parse --short HEAD)"
