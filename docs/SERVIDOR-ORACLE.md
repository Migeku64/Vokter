# Servidor VOKTER en Oracle Cloud

Un servidor propio (VPS) en el plan gratuito de Oracle Cloud con:

- **La tienda completa** (web, app móvil y descargas) servida con **Nginx**.
- **HTTPS gratis** con Let's Encrypt.
- **MySQL privado** con la base `comercio` para los datos de clientes. Solo se puede usar desde el propio servidor, nunca desde internet.
- **Actualización automática:** cada 5 minutos el servidor revisa GitHub y publica los cambios.
- **Seguridad:**
  - Firewall con solo los puertos 22, 80 y 443.
  - Parches automáticos de Ubuntu.
  - `fail2ban` contra ataques a SSH.
  - Cabeceras de seguridad.
  - Bloqueo de archivos internos (llaves, `.sql`, `.git`, datos).
- **Copia diaria de MySQL** (se guardan 7 días).

> El plan gratuito de Oracle ("Always Free") incluye servidores ARM Ampere A1. Hoy el límite es de **2 OCPU y 12 GB de RAM** en total (antes eran 4 y 24). Para la tienda sobra. Oracle puede cambiar estas condiciones; revisa su página antes de crear la cuenta.

---

## 1. Crear la cuenta (lo hace el dueño del negocio)

1. Entra a [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) → **Start for free**.
2. Llena los datos. Oracle pide una **tarjeta** solo para verificar la identidad: no cobra mientras uses recursos "Always Free".
3. Elige la **región de inicio** (Home Region) más cercana a Colombia que aparezca disponible. **No se puede cambiar después**, y los servidores gratis solo se crean en esa región.

## 2. Crear el servidor

1. En el menú: **Compute → Instances → Create instance**.
2. **Name:** `vokter`.
3. **Image and shape → Edit:**
   - Image: **Canonical Ubuntu 24.04**.
   - Shape: **Ampere → VM.Standard.A1.Flex**, con **2 OCPU** y **12 GB** de memoria.
4. **Networking:** deja que cree una red nueva (VCN) con **subred pública** y marca **Assign a public IPv4 address**.
5. **Add SSH keys → Generate a key pair for me → Save private key.** Guarda ese archivo en un lugar seguro: es la llave para entrar al servidor y **Oracle no la vuelve a mostrar**.
6. **Show advanced options → Management → Paste cloud-init script.** Pega todo el contenido de [`deploy/oracle-cloud-init.yaml`](../deploy/oracle-cloud-init.yaml).
7. **Create.**

Si sale el error **"Out of capacity"**, Oracle no tiene servidores ARM libres en ese momento. Intenta otra vez más tarde o elige otro *Availability Domain*.

## 3. Abrir los puertos web en Oracle

Oracle tiene su propio firewall además del del servidor:

1. Abre la instancia → **Subnet** → **Security Lists** → **Default Security List** → **Add Ingress Rules**.
2. Agrega dos reglas:
   - Source CIDR `0.0.0.0/0`, protocolo TCP, **Destination Port 80**
   - Source CIDR `0.0.0.0/0`, protocolo TCP, **Destination Port 443**

## 4. Comprobar

Espera unos 10 minutos y abre `http://IP-PÚBLICA-DEL-SERVIDOR/` en el navegador. La IP aparece en la página de la instancia.

Para ver el avance o los errores de la instalación, entra por SSH:
```bash
ssh -i llave-privada.key ubuntu@IP-PÚBLICA
sudo tail -f /var/log/vokter-instalacion.log
```

## 5. Activar HTTPS

- **Con dominio propio** (por ejemplo `www.vokter.com.co`): crea en tu proveedor del dominio un registro **A** que apunte a la IP del servidor. Luego, en el servidor:
  ```bash
  sudo vokter-https www.vokter.com.co correo@negocio.co
  ```
- **Sin dominio, para pruebas:** usa `sslip.io`, que convierte la IP en un nombre. Por ejemplo, para la IP 129.151.10.20:
  ```bash
  sudo vokter-https 129-151-10-20.sslip.io
  ```

El certificado se renueva solo.

## 6. Cargar los datos de clientes en MySQL (privado)

Los datos personales **nunca van en GitHub**. Se suben directo al servidor, se importan y se borra el archivo:

```bash
# desde tu computador
scp -i llave-privada.key Data_Comercio.csv ubuntu@IP-PÚBLICA:/tmp/
# en el servidor
sudo vokter-importar-clientes /tmp/Data_Comercio.csv
rm /tmp/Data_Comercio.csv
```

- Usa el **CSV original**. El XML que se exportó desde Excel perdió ceros a la izquierda en algunos NIT (`0079897` → `79897`) y convirtió números en notación científica (`5,73108E+11`).
- El importador también acepta los dos formatos de XML.
- Si un cliente ya existe, actualiza sus datos.
- Con `--reemplazar`, borra todo y vuelve a cargar.

**Credenciales:**

- Las de la aplicación (usuario `vokter`, solo lectura y escritura en `comercio`) quedan en `/root/vokter-mysql.txt`. Las lee el backend: `sudo cat /root/vokter-mysql.txt`.
- Para administrar como superusuario: `sudo mysql`.

## Comandos útiles

| Comando | Para qué |
|---|---|
| `sudo vokter-actualizar --forzar` | Publicar ya la última versión de GitHub |
| `systemctl list-timers vokter-actualizar.timer` | Ver cuándo revisa GitHub otra vez |
| `journalctl -t vokter` | Historial de actualizaciones |
| `sudo vokter-https DOMINIO correo` | Activar o cambiar el dominio con HTTPS |
| `sudo vokter-importar-clientes ARCHIVO` | Cargar o actualizar clientes en MySQL |
| `ls /var/backups/vokter` | Copias diarias de la base de datos |
| `sudo bash /opt/vokter/deploy/instalar.sh` | Reaplicar toda la configuración (no borra datos) |

## Qué se publica y qué no

En el servidor queda **todo el repositorio** (`/opt/vokter`). A internet (`/var/www/vokter`) se publica todo menos lo interno:

- historial de git (`.git`)
- scripts del servidor (`deploy/`)
- funciones del backend (`supabase/`)
- documentación (`docs/`, `*.md`)
- llaves de firma (`*.keystore`)
- archivos `.sql` y `.csv`
- cualquier archivo `Data_Comercio*`

Además, Nginx bloquea esos tipos de archivo aunque lleguen por error.

## Si el repositorio pasa a ser privado

El servidor descarga el código por HTTPS sin clave, y eso solo funciona con repositorios públicos. Si lo vuelven privado:

1. En el servidor, crea una llave: `sudo ssh-keygen -t ed25519 -f /root/.ssh/vokter -N ""`.
2. Agrega `/root/.ssh/vokter.pub` en GitHub → repositorio → **Settings → Deploy keys** (solo lectura).
3. Cambia el origen:
   ```bash
   sudo git -C /opt/vokter remote set-url origin git@github.com:Migeku64/Vokter.git
   ```
   y configura `/root/.ssh/config` con `IdentityFile /root/.ssh/vokter` para `github.com`.
