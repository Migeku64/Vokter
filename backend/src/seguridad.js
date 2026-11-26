// seguridad.js — códigos de verificación de un solo uso y límite de peticiones por IP.
import crypto from 'node:crypto';

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// Códigos de 6 dígitos: vencen en 10 minutos, máximo 5 intentos, se guardan como hash (nunca en texto).
export function crearCodigos({ ttlMs = 10 * 60 * 1000, maxIntentos = 5, ahora = () => Date.now() } = {}) {
  const pendientes = new Map();
  const limpiar = () => { const t = ahora(); for (const [k, v] of pendientes) if (v.vence < t) pendientes.delete(k); };
  return {
    crear(clave, registroId) {
      limpiar();
      const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      pendientes.set(clave, { hash: hash(codigo), registroId, vence: ahora() + ttlMs, intentos: 0 });
      return codigo;
    },
    // Devuelve el id del registro si el código es correcto; si no, un código de error.
    verificar(clave, codigo) {
      const p = pendientes.get(clave);
      if (!p || p.vence < ahora()) { pendientes.delete(clave); return { error: 'codigo_vencido' }; }
      if (p.intentos >= maxIntentos) { pendientes.delete(clave); return { error: 'demasiados_intentos' }; }
      p.intentos++;
      const ok = crypto.timingSafeEqual(Buffer.from(p.hash), Buffer.from(hash(codigo)));
      if (!ok) return { error: p.intentos >= maxIntentos ? 'demasiados_intentos' : 'codigo_incorrecto' };
      pendientes.delete(clave);
      return { registroId: p.registroId };
    }
  };
}

// Límite de peticiones: máximo `max` por `ventanaMs` para cada clave (por ejemplo, IP + ruta).
export function crearLimitador({ max, ventanaMs, ahora = () => Date.now() }) {
  const golpes = new Map();
  return (clave) => {
    const t = ahora();
    const lista = (golpes.get(clave) || []).filter((x) => t - x < ventanaMs);
    if (lista.length >= max) { golpes.set(clave, lista); return false; }
    lista.push(t); golpes.set(clave, lista);
    if (golpes.size > 10_000) golpes.clear(); // evita crecer sin control
    return true;
  };
}

// Compara el token de administrador sin filtrar información por el tiempo de respuesta.
export function tokenValido(recibido, esperado) {
  if (!esperado || !recibido) return false;
  const a = Buffer.from(hash(recibido)); const b = Buffer.from(hash(esperado));
  return crypto.timingSafeEqual(a, b);
}

export function enmascararCorreo(correo) {
  const [u, d] = String(correo || '').split('@');
  if (!u || !d) return '';
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(u.length - 2, 3))}@${d}`;
}
