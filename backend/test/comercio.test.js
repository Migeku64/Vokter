// Pruebas de las consultas: todas parametrizadas y con límite. No necesitan MySQL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearRepositorio, limitar, LIMITE_MAX } from '../src/comercio.js';

function dbFalsa(filas = []) {
  const llamadas = [];
  return { llamadas, query: async (sql, params) => { llamadas.push({ sql, params }); return [filas]; } };
}

test('limitar: nunca más de 50 filas ni valores negativos', () => {
  assert.deepEqual(limitar(1000, -5), { limit: LIMITE_MAX, offset: 0 });
  assert.deepEqual(limitar('abc', 'x'), { limit: 20, offset: 0 });
  assert.deepEqual(limitar(10, 30), { limit: 10, offset: 30 });
});

test('buscar: el texto del usuario va como parámetro, nunca dentro del SQL', async () => {
  const db = dbFalsa();
  const repo = crearRepositorio(db);
  const ataque = "x' OR '1'='1"; // intento de inyección SQL
  for (const campo of ['nombre', 'nit', 'correo', 'clienteId']) {
    await repo.buscar(campo, ataque, 10);
  }
  for (const { sql, params } of db.llamadas) {
    assert.ok(!sql.includes(ataque) && !sql.includes("'1'='1"), `SQL contiene la entrada: ${sql}`);
    assert.ok(sql.includes('?'));
    assert.ok(params.some((p) => String(p).toLowerCase().includes("x' or")));
    assert.match(sql, /LIMIT \?$/);
  }
});

test('buscar: escapa comodines de LIKE y rechaza campos desconocidos', async () => {
  const db = dbFalsa();
  const repo = crearRepositorio(db);
  await repo.buscar('nombre', '100%_real', 5);
  assert.equal(db.llamadas[0].params[0], '%100\\%\\_real%');
  await assert.rejects(repo.buscar('telefono; DROP TABLE x', 'a', 5), { codigo: 'campo_invalido' });
});

test('listar y porIdentificador usan parámetros', async () => {
  const db = dbFalsa([{ id: 1 }]);
  const repo = crearRepositorio(db);
  await repo.listar(5, 10);
  await repo.porIdentificador('8604044631');
  assert.deepEqual(db.llamadas[0].params, [5, 10]);
  assert.deepEqual(db.llamadas[1].params, ['8604044631', '8604044631', '8604044631_', 11]);
  assert.match(db.llamadas[1].sql, /WHERE clienteId = \? OR nit = \? OR \(nit LIKE \? AND CHAR_LENGTH\(nit\) = \?\)/);
});
