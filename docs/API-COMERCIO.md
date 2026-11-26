# API de la base `comercio` (MySQL)

La tienda **nunca** se conecta directo a MySQL. Entre la página y la base hay una API en Node.js (carpeta `backend/`). Es la única que conoce la contraseña de MySQL, y esa contraseña vive en un archivo `.env` que no se sube a GitHub.

```
Página web (Mi cuenta)  ──fetch──▶  API (localhost:3000)  ──mysql2──▶  MySQL comercio.data_comercio
```

## Qué hace

| Endpoint | Para qué | Quién lo puede usar |
|---|---|---|
| `GET /api/salud` | Comprobar la conexión con MySQL y contar los registros | Cualquiera (no devuelve datos personales) |
| `GET /api/comercio?limit=20&offset=0` | Listar registros (máximo 50 por página) | Solo administrador (token) |
| `GET /api/comercio/buscar?campo=nombre\|nit\|correo\|clienteId&q=…` | Buscar registros | Solo administrador (token) |
| `POST /api/perfil-comercial/solicitar` `{ identificador }` | Envía un código al **correo registrado** de ese NIT o número de cliente | La página Mi cuenta |
| `POST /api/perfil-comercial/verificar` `{ identificador, codigo }` | Si el código es correcto, devuelve los datos de **ese** registro | La página Mi cuenta |

### Completar el perfil con datos reales

En **Mi cuenta** aparece la tarjeta **"Completa tu perfil comercial"**:

1. El cliente escribe su **NIT** (con o sin dígito de verificación) o su **número de cliente**.
2. La API busca el registro y envía un código de 6 números **al correo que tiene ese registro en la tabla**.
3. Con el código correcto, la página muestra los datos (empresa, NIT, número de cliente, dirección, teléfono y correo) y el cliente los guarda en su perfil.

Así **solo el dueño del registro** puede traer sus datos. Nadie puede ver los datos de otra empresa con solo saber su NIT.

Los datos comerciales se guardan **aparte** de los datos personales del registro (nombre, documento, celular), que no cambian.

### Seguridad

- Contraseñas solo en `backend/.env`, que está en `.gitignore`.
- La API usa un usuario de MySQL de **solo lectura** (`vokter_api`), no `root`.
- **Consultas parametrizadas:** lo que escribe el usuario nunca se pega dentro del SQL.
- **Límites:**
  - máximo 50 filas por consulta
  - 5 solicitudes de código cada 15 minutos por IP
  - códigos que vencen en 10 minutos, con máximo 5 intentos y de un solo uso
- **CORS:** solo las páginas listadas en `ORIGENES_PERMITIDOS` pueden usar la API.
- La API responde igual exista o no un NIT, así que no deja averiguar quién está en la base.
- Las consultas de administrador exigen `Authorization: Bearer <ADMIN_TOKEN>`.

---

## Ejecutarla en tu computador con Visual Studio Code

### 1. Requisitos (una sola vez)

- **MySQL** con la base `comercio` cargada (ya lo tienes: 11.430 registros).
- **Node.js 20 o superior**: descarga la versión **LTS** en [nodejs.org](https://nodejs.org) e instálala con las opciones por defecto. Para comprobarlo, en una terminal ejecuta `node -v`.
- En VS Code, la extensión **Live Server** (de Ritwick Dey), para abrir la página en `http://127.0.0.1:5500`.

### 2. Crear el usuario de la API en MySQL

1. Abre MySQL Workbench con tu conexión de `root`.
2. **File → Open SQL Script…** → `backend/sql/01_usuario_api.sql`.
3. Reemplaza **las dos veces** `CAMBIA_ESTA_CLAVE` por una clave segura y anótala.
4. Ejecuta con el rayo ⚡. Al final debe mostrar `GRANT SELECT ON comercio.data_comercio`.

### 3. Configurar el `.env`

1. En VS Code abre la carpeta del proyecto: **File → Open Folder…**.
2. Abre una terminal: **Terminal → New Terminal**.
3. Ejecuta:
   ```powershell
   cd backend
   copy .env.example .env
   npm install
   ```
4. Abre `backend/.env` y en `DB_PASSWORD` pon la clave que elegiste en el paso 2.
5. Opcional: para las consultas de administrador, genera un token y pégalo en `ADMIN_TOKEN`:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### 4. Probar la conexión

```powershell
npm run probar-conexion
```

Debe decir: `✔ Conexión correcta. data_comercio tiene 11430 registros.`

### 5. Encender la API

```powershell
npm start
```

Verás:

```
API VOKTER en http://127.0.0.1:3000  (modo desarrollo)
✔ MySQL conectado: comercio.data_comercio tiene 11430 registros
```

Deja esa terminal abierta mientras pruebas. Para apagar la API usa `Ctrl + C`.

Comprueba en el navegador: http://127.0.0.1:3000/api/salud

### 6. Abrir la página

1. En el explorador de VS Code, clic derecho sobre `cuenta.html` → **Open with Live Server**. Se abre en `http://127.0.0.1:5500/cuenta.html`.
2. Inicia sesión o crea una cuenta.
3. En **Mi cuenta** pulsa **Completar con mis datos comerciales** y escribe un NIT de la tabla.
4. Como estás en **modo desarrollo** y no hay servidor de correo, el código aparece en un recuadro amarillo y también en la terminal de la API.

> Si abres la página desde GitHub Pages (`migeku64.github.io`), no puede usar la API de tu computador. Para probar, usa Live Server.

### 7. Pruebas automáticas

```powershell
npm test               # 15 pruebas de la API (no necesitan MySQL)
npm run test:conexion  # pruebas reales contra tu MySQL usando el .env
```

`test:conexion` comprueba que:

- conecta y la tabla tiene registros con los 13 campos;
- el usuario de la API **no puede borrar** datos (solo lectura).

### Consultas de administrador (opcional)

Con `ADMIN_TOKEN` configurado, en PowerShell:

```powershell
$h = @{ Authorization = "Bearer TU_TOKEN" }
Invoke-RestMethod "http://127.0.0.1:3000/api/comercio?limit=5" -Headers $h
Invoke-RestMethod "http://127.0.0.1:3000/api/comercio/buscar?campo=nombre&q=INGENIERIA" -Headers $h
```

---

## Problemas comunes

| Mensaje | Solución |
|---|---|
| `Faltan variables de entorno: DB_USER, DB_PASSWORD` | Falta `backend/.env`: copia `.env.example` y complétalo |
| `ER_ACCESS_DENIED_ERROR` | Usuario o clave del `.env` no coinciden con los del paso 2 |
| `ECONNREFUSED` | MySQL está apagado. Enciéndelo: Servicios de Windows → MySQL80 → Iniciar |
| `ER_TABLEACCESS_DENIED_ERROR` | Falta el permiso: vuelve a ejecutar `01_usuario_api.sql` |
| En la página: "No se pudo conectar con el servidor de datos" | La API no está encendida (`npm start`) o `js/config.js → api.url` no es `http://localhost:3000` |
| `Este sitio no puede usar la API` | Agrega la dirección de la página a `ORIGENES_PERMITIDOS` en el `.env` y reinicia la API |

## Para producción (servidor)

- `MODO=produccion` en el `.env`.
- Conectar un servicio de correo real en `backend/src/correo.js`. Mientras no exista, la API no envía códigos.
- Publicar la API con HTTPS y cambiar `js/config.js → api.url` por esa dirección.
- En `ORIGENES_PERMITIDOS`, poner solo el dominio de la tienda.
