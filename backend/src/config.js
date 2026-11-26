// config.js — lee la configuración desde variables de entorno (.env). Nada de claves en el código.

export function cargarConfig(env = process.env) {
  const lista = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
  const cfg = {
    port: Number(env.PORT || 3000),
    host: env.HOST || '127.0.0.1',
    modo: env.MODO === 'produccion' ? 'produccion' : 'desarrollo',
    origenes: lista(env.ORIGENES_PERMITIDOS),
    adminToken: env.ADMIN_TOKEN || '',
    db: {
      host: env.DB_HOST || '127.0.0.1',
      port: Number(env.DB_PORT || 3306),
      database: env.DB_NAME || 'comercio',
      user: env.DB_USER || '',
      password: env.DB_PASSWORD || ''
    }
  };
  const faltan = [];
  if (!cfg.db.user) faltan.push('DB_USER');
  if (!cfg.db.password) faltan.push('DB_PASSWORD');
  if (faltan.length) {
    throw new Error(`Faltan variables de entorno: ${faltan.join(', ')}. Copia backend/.env.example como backend/.env y complétalo.`);
  }
  if (cfg.adminToken && cfg.adminToken.length < 32) {
    throw new Error('ADMIN_TOKEN debe tener al menos 32 caracteres (ver .env.example).');
  }
  if (!Number.isInteger(cfg.port) || cfg.port < 1 || cfg.port > 65535) throw new Error('PORT no es válido.');
  return cfg;
}
