// Pruebas de la API con una base de datos simulada (no necesitan MySQL):  npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { crearApp } from '../src/app.js';

const REG = { id: 7, sociedad: 'INGENIERIAS', actualizacion: '2024', cuenta: '4170100001', nombre: 'RENOVACIONES', clienteId: '6835',
  nombreAcreedorCliente: 'EMPRESA DE PRUEBA S.A.S.', nit: '8604044631', nombreMaterial: 'RENOVACION PERSONA NATURAL',
  jerarquia: 'Z0001', asignacion: '582404', direccion: 'CALLE 1 # 2 - 3', telefono: '6010000000', correo: 'contacto@prueba.co' };
const SIN_CORREO = { ...REG, id: 8, clienteId: '9999', nit: '900000001', correo: null };

let caida = false;
const repo = {
  salud: async () => { if (caida) throw Object.assign(new Error('down'), { code: 'ECONNREFUSED' }); return { registros: 11430 }; },
  listar: async (l, o) => ({ limit: Math.min(Number(l) || 20, 50), offset: Number(o) || 0, filas: [REG] }),
  buscar: async (campo, q, l) => ({ limit: Number(l) || 20, filas: [REG] }),
  porIdentificador: async (id) => [REG, SIN_CORREO].filter((r) => r.nit === id || r.clienteId === id),
  porId: async (id) => [REG, SIN_CORREO].find((r) => r.id === id) || null
};
const enviados = [];
const TOKEN = 'a'.repeat(40);
const config = { modo: 'desarrollo', origenes: ['http://localhost:5500'], adminToken: TOKEN, db: { database: 'comercio' } };
const silencioso = { log() {}, error() {} };

let server; let base;
before(async () => {
  server = http.createServer(crearApp({ config, repo, enviarCodigo: async (c, cod) => enviados.push({ c, cod }), log: silencioso }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const pedir = async (ruta, { method = 'GET', body, headers = {} } = {}) => {
  const r = await fetch(base + ruta, { method, headers: { Origin: 'http://localhost:5500', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => null), headers: r.headers };
};

test('salud: informa conexión y cantidad de registros', async () => {
  const r = await pedir('/api/salud');
  assert.equal(r.status, 200);
  assert.equal(r.json.mysql, 'conectado');
  assert.equal(r.json.registros, 11430);
});

test('salud: si MySQL cae responde 503 sin revelar detalles', async () => {
  caida = true;
  const r = await pedir('/api/salud');
  caida = false;
  assert.equal(r.status, 503);
  assert.equal(r.json.ok, false);
  assert.ok(!JSON.stringify(r.json).includes('ECONNREFUSED'));
});

test('consultas de administrador: sin token o con token falso -> 401', async () => {
  assert.equal((await pedir('/api/comercio')).status, 401);
  assert.equal((await pedir('/api/comercio/buscar?campo=nit&q=860', { headers: { Authorization: 'Bearer falso' } })).status, 401);
});

test('consultas de administrador: con token devuelve datos y valida parámetros', async () => {
  const auth = { Authorization: `Bearer ${TOKEN}` };
  const lista = await pedir('/api/comercio?limit=5', { headers: auth });
  assert.equal(lista.status, 200);
  assert.equal(lista.json.filas[0].clienteId, '6835');
  const busca = await pedir('/api/comercio/buscar?campo=correo&q=contacto@prueba.co', { headers: auth });
  assert.equal(busca.status, 200);
  assert.equal((await pedir('/api/comercio/buscar?campo=telefono&q=601', { headers: auth })).status, 400);
  assert.equal((await pedir('/api/comercio/buscar?campo=nit&q=8', { headers: auth })).status, 400);
});

test('CORS: un sitio no permitido es rechazado', async () => {
  const r = await pedir('/api/salud', { headers: { Origin: 'https://sitio-malicioso.com' } });
  assert.equal(r.status, 403);
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  const ok = await pedir('/api/salud');
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5500');
});

test('perfil comercial: misma respuesta exista o no el NIT (no se revela)', async () => {
  const existe = await pedir('/api/perfil-comercial/solicitar', { method: 'POST', body: { identificador: '860.404.463-1' } });
  const noExiste = await pedir('/api/perfil-comercial/solicitar', { method: 'POST', body: { identificador: '123456789' } });
  assert.equal(existe.status, 200);
  assert.equal(existe.json.mensaje, noExiste.json.mensaje);
  assert.equal(enviados.at(-1).c, 'contacto@prueba.co'); // el código va al correo DEL REGISTRO
});

test('perfil comercial: solo con el código correcto entrega los datos', async () => {
  const s = await pedir('/api/perfil-comercial/solicitar', { method: 'POST', body: { identificador: '6835' } });
  const codigo = s.json.desarrollo.codigo;
  const malo = await pedir('/api/perfil-comercial/verificar', { method: 'POST', body: { identificador: '6835', codigo: codigo === '000000' ? '111111' : '000000' } });
  assert.equal(malo.status, 400);
  assert.equal(malo.json.datos, undefined);
  const bueno = await pedir('/api/perfil-comercial/verificar', { method: 'POST', body: { identificador: '6835', codigo } });
  assert.equal(bueno.status, 200);
  assert.equal(bueno.json.datos.empresa, 'EMPRESA DE PRUEBA S.A.S.');
  assert.equal(bueno.json.datos.cuenta, undefined); // campos contables internos no salen
  const reuso = await pedir('/api/perfil-comercial/verificar', { method: 'POST', body: { identificador: '6835', codigo } });
  assert.equal(reuso.status, 400); // el código es de un solo uso
});

test('perfil comercial: registro sin correo no se puede verificar', async () => {
  const s = await pedir('/api/perfil-comercial/solicitar', { method: 'POST', body: { identificador: '9999' } });
  assert.equal(s.status, 200);
  assert.equal(s.json.desarrollo.codigo, undefined);
});

test('perfil comercial: rechaza identificadores inválidos y cuerpos que no son JSON', async () => {
  assert.equal((await pedir('/api/perfil-comercial/solicitar', { method: 'POST', body: { identificador: "1' OR 1=1" } })).status, 400);
  const r = await fetch(base + '/api/perfil-comercial/verificar', { method: 'POST', headers: { Origin: 'http://localhost:5500', 'Content-Type': 'text/plain' }, body: 'hola' });
  assert.equal(r.status, 415);
});

test('límite de peticiones: más de 5 solicitudes de código -> 429', async () => {
  let ultimo;
  for (let i = 0; i < 6; i++) ultimo = await pedir('/api/perfil-comercial/solicitar', { method: 'POST', body: { identificador: '123456' } });
  assert.equal(ultimo.status, 429);
});

test('rutas inexistentes -> 404 con JSON y cabeceras de seguridad', async () => {
  const r = await pedir('/api/nada');
  assert.equal(r.status, 404);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('cache-control'), 'no-store');
});
