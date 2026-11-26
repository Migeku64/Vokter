#!/usr/bin/env bash
# vokter-https — activa HTTPS gratis (Let's Encrypt) para un dominio que ya apunte a este servidor.
# Uso:  sudo vokter-https www.mitienda.com.co tu@correo.com
# Sin dominio propio puedes usar <tu-ip-con-guiones>.sslip.io, por ejemplo 129-151-10-20.sslip.io
set -euo pipefail

DOMINIO="${1:?Uso: sudo vokter-https TU-DOMINIO [correo]}"
CORREO="${2:-}"

if ! [[ "$DOMINIO" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "Dominio no válido: $DOMINIO" >&2; exit 1
fi

sed -i "s/^\(\s*server_name\).*;/\1 ${DOMINIO};/" /etc/nginx/sites-available/vokter
nginx -t && systemctl reload nginx

if [ -n "$CORREO" ]; then MAIL=(-m "$CORREO"); else MAIL=(--register-unsafely-without-email); fi
certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos --redirect "${MAIL[@]}"

# HSTS: obliga a los navegadores a usar siempre HTTPS (solo se activa cuando ya hay certificado).
if ! grep -q 'Strict-Transport-Security' /etc/nginx/snippets/vokter-seguridad.conf; then
  echo 'add_header Strict-Transport-Security "max-age=31536000" always;' >> /etc/nginx/snippets/vokter-seguridad.conf
fi
nginx -t && systemctl reload nginx
echo "Listo: https://${DOMINIO}/  (el certificado se renueva solo)"
