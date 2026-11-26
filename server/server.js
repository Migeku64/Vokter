import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import { randomInt, randomUUID } from 'node:crypto';

const app = express();
const port = Number(process.env.PORT || 3000);

const allowedOrigins = String(process.env.WEB_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    const isLocalFile = origin === 'null' || origin?.startsWith('file://');
    if (!origin || isLocalFile || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS'));
  }
}));
app.use(express.json({ limit: '32kb' }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'comercio',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  charset: 'utf8mb4'
});

const nitVerifications = new Map();
const maskEmail = email => {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return 'correo no disponible';
  return `${name.slice(0, 1)}${'•'.repeat(Math.min(Math.max(name.length - 1, 2), 5))}@${domain}`;
};

const commerceFields = `id, sociedad, actualizacion, cuenta, nombre, clienteId,
  nombreAcreedorCliente, nit, nombreMaterial, jerarquia, asignacion,
  direccion, telefono, correo`;

app.get('/api/health', async (_request, response) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS connected');
    response.json({ ok: true, database: process.env.DB_NAME || 'comercio', connected: rows[0]?.connected === 1 });
  } catch (error) {
    console.error('MySQL health check failed:', error.message);
    response.status(503).json({ ok: false, message: 'No se pudo conectar con MySQL.' });
  }
});

app.post('/api/comercio/nit/request', async (request, response) => {
  const nit = String(request.body?.nit || '').replace(/\D/g, '');
  if (!nit) return response.status(400).json({ ok: false, message: 'Ingresa un NIT válido.' });

  try {
    const [rows] = await pool.query(
      `SELECT ${commerceFields} FROM data_comercio WHERE REPLACE(nit, '-', '') = ? ORDER BY id ASC LIMIT 1`,
      [nit]
    );
    const record = rows[0];
    if (!record) return response.status(404).json({ ok: false, message: 'No encontramos ese NIT en la base de datos.' });

    const verificationId = randomUUID();
    const code = String(randomInt(100000, 1000000));
    nitVerifications.set(verificationId, { code, record, expiresAt: Date.now() + 10 * 60 * 1000 });
    response.json({
      ok: true,
      verificationId,
      maskedEmail: maskEmail(record.correo),
      developmentCode: process.env.NODE_ENV === 'production' ? undefined : code
    });
  } catch (error) {
    console.error('NIT request failed:', error.message);
    response.status(500).json({ ok: false, message: 'No se pudo consultar el NIT.' });
  }
});

app.post('/api/comercio/nit/verify', (request, response) => {
  const verificationId = String(request.body?.verificationId || '');
  const code = String(request.body?.code || '').replace(/\D/g, '');
  const challenge = nitVerifications.get(verificationId);
  if (!challenge || challenge.expiresAt < Date.now()) {
    nitVerifications.delete(verificationId);
    return response.status(400).json({ ok: false, message: 'El código expiró. Solicita uno nuevo.' });
  }
  if (code !== challenge.code) return response.status(401).json({ ok: false, message: 'El código de verificación no coincide.' });
  nitVerifications.delete(verificationId);
  response.json({ ok: true, data: challenge.record });
});

app.get('/api/comercio', async (request, response) => {
  const search = String(request.query.search || '').trim();
  const limit = Math.min(Math.max(Number(request.query.limit || 25), 1), 100);

  try {
    const conditions = [];
    const values = [];
    if (search) {
      const like = `%${search}%`;
      conditions.push('(nombreAcreedorCliente LIKE ? OR nit LIKE ? OR correo LIKE ? OR clienteId LIKE ?)');
      values.push(like, like, like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT ${commerceFields}
       FROM data_comercio ${where}
       ORDER BY id ASC LIMIT ?`,
      [...values, limit]
    );
    response.json({ ok: true, total: rows.length, data: rows });
  } catch (error) {
    console.error('Commerce query failed:', error.message);
    response.status(500).json({ ok: false, message: 'No se pudo consultar data_comercio.' });
  }
});

app.use((_request, response) => response.status(404).json({ ok: false, message: 'Ruta no encontrada.' }));

app.listen(port, () => {
  console.log(`API de comercio ejecutándose en http://localhost:${port}`);
});
