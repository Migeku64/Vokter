// Prueba REAL contra tu MySQL (usa backend/.env):  npm run test:conexion
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarConfig } from '../src/config.js';
import { crearPool } from '../src/db.js';
import { crearRepositorio, CAMPOS } from '../src/comercio.js';

test('MySQL: conecta, la tabla existe y tiene registros con los 13 campos', async () => {
  const config = cargarConfig();
  const pool = await crearPool(config.db);
  try {
    const repo = crearRepositorio(pool);
    const { registros } = await repo.salud();
    assert.ok(registros > 0, 'data_comercio está vacía: carga los datos primero');
    const { filas } = await repo.listar(1, 0);
    for (const c of CAMPOS) assert.ok(c in filas[0], `Falta el campo ${c}`);
    const { filas: porNit } = await repo.buscar('nit', filas[0].nit || '0', 5);
    assert.ok(Array.isArray(porNit));
  } finally {
    await pool.end();
  }
});

test('MySQL: el usuario de la API no puede modificar datos (solo lectura)', async () => {
  const config = cargarConfig();
  const pool = await crearPool(config.db);
  try {
    await assert.rejects(pool.query('DELETE FROM data_comercio WHERE id = -1'), /denied|command denied/i,
      'El usuario de la API puede borrar: usa el usuario de solo lectura de sql/01_usuario_api.sql');
  } finally {
    await pool.end();
  }
});
