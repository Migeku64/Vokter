// app.js — rutas de la API. Sin frameworks: solo el módulo http de Node.
//
//   GET  /api/salud                              Conexión con MySQL (público, sin datos personales)
//   GET  /api/comercio?limit=&offset=            Listar registros            (requiere token de administrador)
//   GET  /api/comercio/buscar?campo=&q=&limit=   Buscar nombre|nit|correo|clienteId (requiere token)
//   POST /api/perfil-comercial/solicitar         { identificador }  -> envía código al correo del registro
//   POST /api/perfil-comercial/verificar         { identificador, codigo } -> devuelve los datos del registro
import { CAMPOS_BUSQUEDA } from './comercio.js';
import { crearCodigos, crearLimitador, tokenValido, enmascararCorreo } from './seguridad.js';

const MAX_CUERPO = 10 * 1024;
const MENSAJE_SOLICITUD = 'Si el NIT o número de cliente está registrado con un correo, enviamos un código de verificación a ese correo.';

export function crearApp({ config, repo, enviarCodigo, log = console }) {
  const codigos = crearCodigos();
  const limites = {
    solicitar: crearLimitador({ max: 5, ventanaMs: 15 * 60 * 1000 }),
    verificar: crearLimitador({ max: 15, ventanaMs: 15 * 60 * 1000 }),
    admin: crearLimitador({ max: 60, ventanaMs: 60 * 1000 }),
    general: crearLimitador({ max: 120, ventanaMs: 60 * 1000 })
  };

  function responder(res, status, cuerpo) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
    });
    res.end(JSON.stringify(cuerpo));
  }
  const error = (res, status, codigo, mensaje) => responder(res, status, { ok: false, error: codigo, mensaje });

  function leerJSON(req) {
    return new Promise((resolve, reject) => {
      if (!String(req.headers['content-type'] || '').includes('application/json')) return reject(Object.assign(new Error(), { status: 415 }));
      let tam = 0; const partes = [];
      req.on('data', (c) => { tam += c.length; if (tam > MAX_CUERPO) { reject(Object.assign(new Error(), { status: 413 })); req.destroy(); } else partes.push(c); });
      req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error(), { status: 400 })); } });
      req.on('error', reject);
    });
  }

  const ipDe = (req) => req.socket.remoteAddress || 'desconocida';
  const esAdmin = (req) => tokenValido(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), config.adminToken);
  const limpiarId = (v) => String(v ?? '').trim().replace(/[.\s-]/g, '').toUpperCase();
  const idValido = (v) => /^[A-Z0-9]{3,15}$/.test(v);

  function datosPerfil(r) {
    // Solo lo útil para el perfil; los campos contables internos (cuenta, jerarquía, asignación) no salen.
    return {
      empresa: r.nombreAcreedorCliente, nit: r.nit, clienteId: r.clienteId, direccion: r.direccion,
      telefono: r.telefono, correo: r.correo, tipoRegistro: r.nombreMaterial, anio: r.actualizacion, sociedad: r.sociedad
    };
  }

  return async function manejar(req, res) {
    const origen = req.headers.origin;
    const permitido = !origen || config.origenes.includes(origen);
    if (origen && permitido) {
      res.setHeader('Access-Control-Allow-Origin', origen);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      if (!permitido) return error(res, 403, 'origen_no_permitido', 'Este sitio no puede usar la API.');
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' });
      return res.end();
    }
    if (!permitido) return error(res, 403, 'origen_no_permitido', 'Este sitio no puede usar la API.');
    if (!limites.general(ipDe(req))) return error(res, 429, 'demasiadas_peticiones', 'Demasiadas peticiones. Espera un momento.');

    const url = new URL(req.url, 'http://localhost');
    const ruta = `${req.method} ${url.pathname.replace(/\/+$/, '')}`;
    try {
      if (ruta === 'GET /api/salud') {
        try {
          const s = await repo.salud();
          return responder(res, 200, { ok: true, mysql: 'conectado', base: config.db.database, tabla: 'data_comercio', registros: s.registros });
        } catch (e) {
          log.error('[salud] MySQL no responde:', e.code || e.message);
          return responder(res, 503, { ok: false, mysql: 'sin conexión', mensaje: 'La API no pudo conectarse a MySQL. Revisa que MySQL esté encendido y los datos del .env.' });
        }
      }

      if (ruta === 'GET /api/comercio' || ruta === 'GET /api/comercio/buscar') {
        if (!config.adminToken) return error(res, 503, 'admin_desactivado', 'Configura ADMIN_TOKEN en el .env para usar las consultas de administrador.');
        if (!esAdmin(req)) return error(res, 401, 'no_autorizado', 'Falta el token de administrador o no es válido.');
        if (!limites.admin(ipDe(req))) return error(res, 429, 'demasiadas_peticiones', 'Demasiadas consultas. Espera un minuto.');
        if (ruta === 'GET /api/comercio') {
          const r = await repo.listar(url.searchParams.get('limit'), url.searchParams.get('offset'));
          return responder(res, 200, { ok: true, ...r, total: r.filas.length });
        }
        const campo = url.searchParams.get('campo') || 'nombre';
        const q = String(url.searchParams.get('q') || '').trim();
        if (!CAMPOS_BUSQUEDA.includes(campo)) return error(res, 400, 'campo_invalido', `Campo no válido. Usa: ${CAMPOS_BUSQUEDA.join(', ')}.`);
        if (q.length < 2 || q.length > 120) return error(res, 400, 'busqueda_invalida', 'Escribe entre 2 y 120 caracteres para buscar.');
        const r = await repo.buscar(campo, q, url.searchParams.get('limit'));
        return responder(res, 200, { ok: true, campo, q, ...r, total: r.filas.length });
      }

      if (ruta === 'POST /api/perfil-comercial/solicitar') {
        if (!limites.solicitar(ipDe(req))) return error(res, 429, 'demasiadas_peticiones', 'Pediste varios códigos. Espera 15 minutos e inténtalo de nuevo.');
        const { identificador } = await leerJSON(req);
        const id = limpiarId(identificador);
        if (!idValido(id)) return error(res, 400, 'identificador_invalido', 'Escribe tu NIT (con o sin dígito de verificación) o tu número de cliente, solo números y letras.');
        const filas = await repo.porIdentificador(id);
        const r = filas.length === 1 ? filas[0] : null; // si hay ambigüedad, no se revela nada
        const respuesta = { ok: true, mensaje: MENSAJE_SOLICITUD };
        if (r && r.correo && r.correo.includes('@')) {
          const codigo = codigos.crear(id, r.id);
          await enviarCodigo(r.correo, codigo);
          if (config.modo === 'desarrollo') Object.assign(respuesta, { desarrollo: { codigo, correo: enmascararCorreo(r.correo) } });
        } else if (config.modo === 'desarrollo') {
          respuesta.desarrollo = { aviso: r ? 'El registro no tiene correo: no se puede verificar.' : 'No hay un registro único con ese NIT o número de cliente.' };
        }
        return responder(res, 200, respuesta); // misma respuesta exista o no el registro (no se revela)
      }

      if (ruta === 'POST /api/perfil-comercial/verificar') {
        if (!limites.verificar(ipDe(req))) return error(res, 429, 'demasiadas_peticiones', 'Demasiados intentos. Espera 15 minutos.');
        const { identificador, codigo } = await leerJSON(req);
        const id = limpiarId(identificador);
        if (!idValido(id) || !/^\d{6}$/.test(String(codigo || ''))) return error(res, 400, 'datos_invalidos', 'Revisa el identificador y el código de 6 números.');
        const v = codigos.verificar(id, String(codigo));
        if (v.error) {
          const msg = { codigo_vencido: 'El código venció o no existe. Pide uno nuevo.', demasiados_intentos: 'Demasiados intentos con ese código. Pide uno nuevo.', codigo_incorrecto: 'El código no es correcto.' }[v.error];
          return error(res, 400, v.error, msg);
        }
        const r = await repo.porId(v.registroId);
        if (!r) return error(res, 404, 'no_encontrado', 'El registro ya no existe.');
        return responder(res, 200, { ok: true, datos: datosPerfil(r) });
      }

      return error(res, 404, 'no_existe', 'Ruta no encontrada.');
    } catch (e) {
      if (e.status) return error(res, e.status, 'solicitud_invalida', 'La solicitud no es válida.');
      log.error('[api] error:', e.code || e.message);
      return error(res, 500, 'error_interno', 'Ocurrió un error en el servidor.');
    }
  };
}
