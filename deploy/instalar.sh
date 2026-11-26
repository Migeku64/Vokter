#!/usr/bin/env bash
# instalar.sh — deja el servidor listo: tienda con Nginx, MySQL privado, firewall, actualizaciones.
# Se puede ejecutar varias veces sin dañar nada:  sudo bash /opt/vokter/deploy/instalar.sh
set -euo pipefail

REPO_DIR=/opt/vokter
WEB_DIR=/var/www/vokter
REPO_URL="${REPO_URL:-https://github.com/Migeku64/Vokter.git}"
export DEBIAN_FRONTEND=noninteractive

echo "==> 1/8 Paquetes del sistema"
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | debconf-set-selections
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q nginx mysql-server git rsync python3 certbot python3-certbot-nginx \
  unattended-upgrades fail2ban iptables-persistent netfilter-persistent

echo "==> 2/8 Código del proyecto (todo el repositorio en $REPO_DIR)"
if [ ! -d "$REPO_DIR/.git" ]; then git clone --depth 1 "$REPO_URL" "$REPO_DIR"; fi
install -m 755 "$REPO_DIR/deploy/actualizar.sh" /usr/local/bin/vokter-actualizar
install -m 755 "$REPO_DIR/deploy/https.sh" /usr/local/bin/vokter-https
install -m 755 "$REPO_DIR/deploy/importar-clientes.py" /usr/local/bin/vokter-importar-clientes
mkdir -p "$WEB_DIR"
/usr/local/bin/vokter-actualizar --forzar

echo "==> 3/8 Nginx (servidor web)"
if [ ! -f /etc/nginx/snippets/vokter-seguridad.conf ]; then
  install -m 644 "$REPO_DIR/deploy/nginx/vokter-seguridad.conf" /etc/nginx/snippets/vokter-seguridad.conf
fi
if [ ! -f /etc/nginx/sites-available/vokter ]; then
  install -m 644 "$REPO_DIR/deploy/nginx/vokter.conf" /etc/nginx/sites-available/vokter
fi
ln -sf /etc/nginx/sites-available/vokter /etc/nginx/sites-enabled/vokter
rm -f /etc/nginx/sites-enabled/default
sed -i 's/^\s*#\?\s*server_tokens.*/\tserver_tokens off;/' /etc/nginx/nginx.conf
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "==> 4/8 Firewall del servidor (puertos 22, 80 y 443)"
# Las imágenes de Ubuntu en Oracle traen iptables que bloquea todo menos SSH.
for PORT in 80 443; do
  if ! iptables -C INPUT -p tcp -m state --state NEW --dport "$PORT" -j ACCEPT 2>/dev/null; then
    POS=$(iptables -L INPUT --line-numbers | awk '/REJECT/ {print $1; exit}')
    iptables -I INPUT "${POS:-1}" -p tcp -m state --state NEW --dport "$PORT" -j ACCEPT
  fi
done
netfilter-persistent save

echo "==> 5/8 MySQL privado (solo accesible desde el propio servidor)"
cat > /etc/mysql/mysql.conf.d/zz-vokter.cnf <<'CNF'
[mysqld]
bind-address = 127.0.0.1
mysqlx-bind-address = 127.0.0.1
local_infile = 0
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
CNF
systemctl enable --now mysql
systemctl restart mysql
mysql < "$REPO_DIR/deploy/mysql/esquema.sql"
if [ ! -f /root/vokter-mysql.txt ]; then
  CLAVE=$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-28)
  mysql -e "CREATE USER IF NOT EXISTS 'vokter'@'localhost' IDENTIFIED BY '${CLAVE}';
            GRANT SELECT, INSERT, UPDATE, DELETE ON comercio.* TO 'vokter'@'localhost'; FLUSH PRIVILEGES;"
  umask 077
  printf 'Usuario MySQL de la aplicación\nusuario: vokter\nclave: %s\nbase: comercio\nhost: 127.0.0.1 (solo desde el servidor)\n' "$CLAVE" > /root/vokter-mysql.txt
fi

echo "==> 6/8 Copias de seguridad diarias de MySQL (se guardan 7 días)"
cat > /etc/cron.daily/vokter-respaldo <<'CRON'
#!/bin/sh
set -e
mkdir -p /var/backups/vokter && chmod 700 /var/backups/vokter
mysqldump --single-transaction comercio | gzip > /var/backups/vokter/comercio-$(date +%F).sql.gz
find /var/backups/vokter -name 'comercio-*.sql.gz' -mtime +7 -delete
CRON
chmod 755 /etc/cron.daily/vokter-respaldo

echo "==> 7/8 Actualización automática desde GitHub (cada 5 minutos)"
cat > /etc/systemd/system/vokter-actualizar.service <<'UNIT'
[Unit]
Description=Actualiza la tienda VOKTER desde GitHub
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/bin/vokter-actualizar
UNIT
cat > /etc/systemd/system/vokter-actualizar.timer <<'UNIT'
[Unit]
Description=Revisa cambios de la tienda VOKTER cada 5 minutos
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now vokter-actualizar.timer

echo "==> 8/8 Seguridad del sistema: parches automáticos y bloqueo de ataques a SSH"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT
systemctl enable --now fail2ban

IP=$(curl -s --max-time 5 https://ifconfig.me || hostname -I | awk '{print $1}')
echo
echo "============================================================"
echo " VOKTER instalado."
echo " Tienda:  http://${IP}/"
echo " HTTPS:   sudo vokter-https TU-DOMINIO tu@correo.com"
echo " Datos:   sudo vokter-importar-clientes /ruta/Data_Comercio.xml"
echo " MySQL:   credenciales en /root/vokter-mysql.txt"
echo "============================================================"
