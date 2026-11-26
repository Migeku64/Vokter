# API MySQL de Comercio

Esta API conecta el proyecto con la base de datos `comercio` y la tabla `data_comercio`.

## Configuración en Visual Studio Code

Desde la terminal del proyecto:

```powershell
cd server
Copy-Item .env.example .env
notepad .env
npm install
npm start
```

## Pruebas

Con el servidor encendido, abre:

```text
http://localhost:3000/api/health
http://localhost:3000/api/comercio?search=ingenierias
```

La API es de consulta y no modifica el registro ni el inicio de sesión de la aplicación.
