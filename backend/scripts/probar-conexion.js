// probar-conexion.js — prueba rápida:  npm run probar-conexion
import { cargarConfig } from '../src/config.js';
import { crearPool } from '../src/db.js';
import { crearRepositorio } from '../src/comercio.js';

try {
  const config = cargarConfig();
  console.log(`Conectando a MySQL ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}…`);
  const pool = await crearPool(config.db);
  const repo = crearRepositorio(pool);
  const { registros } = await repo.salud();
  const { filas } = await repo.listar(1, 0);
  console.log(`✔ Conexión correcta. data_comercio tiene ${registros} registros.`);
  console.log(`✔ Campos: ${Object.keys(filas[0] || {}).join(', ')}`);
  await pool.end();
} catch (e) {
  console.error(`✖ Falló la conexión: ${e.code || ''} ${e.message}`);
  console.error('  Revisa: MySQL encendido, usuario y clave del .env, y que exista la base comercio.');
  process.exit(1);
}
