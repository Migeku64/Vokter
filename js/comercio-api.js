// comercio-api.js — la página habla con la API (backend/), nunca directo con MySQL.
import { CONFIG } from './config.js';

const base = () => String(CONFIG.api?.url || '').replace(/\/+$/, '');
const SIN_API = 'No se pudo conectar con el servidor de datos. Si estás en tu computador, enciende la API: en VS Code abre la carpeta backend y ejecuta "npm start".';

async function llamar(ruta, { method = 'GET', body } = {}) {
  if (!base()) throw new Error('La dirección de la API no está configurada (js/config.js → api.url).');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  let r;
  try {
    r = await fetch(base() + ruta, {
      method, signal: ctrl.signal, credentials: 'omit',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error(SIN_API);
  } finally { clearTimeout(t); }
  const json = await r.json().catch(() => null);
  if (!r.ok || !json?.ok) throw Object.assign(new Error(json?.mensaje || SIN_API), { codigo: json?.error, status: r.status });
  return json;
}

export const estadoAPI = () => llamar('/api/salud');
export const solicitarCodigo = (identificador) => llamar('/api/perfil-comercial/solicitar', { method: 'POST', body: { identificador } });
export const verificarCodigo = (identificador, codigo) => llamar('/api/perfil-comercial/verificar', { method: 'POST', body: { identificador, codigo } });
