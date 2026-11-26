// comercio.js — consultas a la tabla data_comercio. Todas son parametrizadas:
// los valores que escribe el usuario viajan siempre como parámetros (?), nunca pegados al SQL.

export const CAMPOS = ['sociedad', 'actualizacion', 'cuenta', 'nombre', 'clienteId', 'nombreAcreedorCliente', 'nit',
  'nombreMaterial', 'jerarquia', 'asignacion', 'direccion', 'telefono', 'correo'];
const SELECT = `SELECT id, ${CAMPOS.join(', ')} FROM data_comercio`;

export const LIMITE_MAX = 50;

// Campos por los que se puede buscar -> condición SQL fija (el usuario no puede elegir columnas libres).
const BUSQUEDAS = {
  nombre: { sql: 'nombreAcreedorCliente LIKE ?', valor: (q) => `%${escaparLike(q)}%` },
  nit: { sql: 'nit LIKE ?', valor: (q) => `${escaparLike(q)}%` },
  correo: { sql: 'correo = ?', valor: (q) => q.toLowerCase() },
  clienteId: { sql: 'clienteId = ?', valor: (q) => q }
};
export const CAMPOS_BUSQUEDA = Object.keys(BUSQUEDAS);

function escaparLike(s) { return String(s).replace(/[\\%_]/g, (c) => `\\${c}`); }

export function limitar(limit, offset) {
  const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), LIMITE_MAX);
  const o = Math.min(Math.max(parseInt(offset, 10) || 0, 0), 1_000_000);
  return { limit: l, offset: o };
}

export function crearRepositorio(db) {
  const consulta = async (sql, params = []) => (await db.query(sql, params))[0];
  return {
    async salud() {
      const [fila] = await consulta('SELECT COUNT(*) AS registros FROM data_comercio');
      return { registros: Number(fila.registros) };
    },

    async listar(limit, offset) {
      const p = limitar(limit, offset);
      const filas = await consulta(`${SELECT} ORDER BY id LIMIT ? OFFSET ?`, [p.limit, p.offset]);
      return { ...p, filas };
    },

    async buscar(campo, q, limit) {
      const b = BUSQUEDAS[campo];
      if (!b) throw Object.assign(new Error('campo'), { codigo: 'campo_invalido' });
      const { limit: l } = limitar(limit, 0);
      const filas = await consulta(`${SELECT} WHERE ${b.sql} ORDER BY id LIMIT ?`, [b.valor(q), l]);
      return { limit: l, filas };
    },

    // Para completar el perfil: busca exactamente por número de cliente o por NIT.
    // En la tabla el NIT incluye el dígito de verificación al final, así que también se acepta sin él.
    async porIdentificador(identificador) {
      const filas = await consulta(
        `${SELECT} WHERE clienteId = ? OR nit = ? OR (nit LIKE ? AND CHAR_LENGTH(nit) = ?) ORDER BY id LIMIT 2`,
        [identificador, identificador, `${escaparLike(identificador)}_`, identificador.length + 1]);
      return filas;
    },

    async porId(id) {
      const filas = await consulta(`${SELECT} WHERE id = ? LIMIT 1`, [id]);
      return filas[0] || null;
    }
  };
}
