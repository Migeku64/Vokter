// server.js — arranca la API:  npm start   (lee la configuración de backend/.env)
import http from 'node:http';
import { cargarConfig } from './src/config.js';
import { crearPool } from './src/db.js';
import { crearRepositorio } from './src/comercio.js';
import { crearEnvioCodigo } from './src/correo.js';
import { crearApp } from './src/app.js';

let config;
try { config = cargarConfig(); } catch (e) { console.error(`\n✖ ${e.message}\n`); process.exit(1); }

const pool = await crearPool(config.db);
const repo = crearRepositorio(pool);
const app = crearApp({ config, repo, enviarCodigo: crearEnvioCodigo(config) });

http.createServer(app).listen(config.port, config.host, async () => {
  console.log(`\nAPI VOKTER en http://${config.host}:${config.port}  (modo ${config.modo})`);
  try {
    const s = await repo.salud();
    console.log(`✔ MySQL conectado: ${config.db.database}.data_comercio tiene ${s.registros} registros`);
  } catch (e) {
    console.log(`✖ No se pudo conectar a MySQL (${e.code || e.message}). Revisa que MySQL esté encendido y el .env.`);
  }
  if (!config.adminToken) console.log('ℹ ADMIN_TOKEN vacío: las consultas de administrador (/api/comercio) están desactivadas.');
  console.log(`Páginas permitidas: ${config.origenes.join(', ') || '(ninguna, revisa ORIGENES_PERMITIDOS)'}\n`);
});

const cerrar = () => pool.end().finally(() => process.exit(0));
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
