// db.js — conexión a MySQL con un pool de conexiones (mysql2).
export async function crearPool(dbCfg) {
  const mysql = await import('mysql2/promise');
  return mysql.createPool({
    host: dbCfg.host,
    port: dbCfg.port,
    user: dbCfg.user,
    password: dbCfg.password,
    database: dbCfg.database,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
    connectTimeout: 5000,
    // Nunca se permiten varias sentencias en una consulta (defensa extra contra inyección SQL).
    multipleStatements: false
  });
}
