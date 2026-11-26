-- 01_usuario_api.sql — usuario de MySQL exclusivo para la API, con permisos mínimos.
-- Solo puede LEER la tabla data_comercio: no puede borrar, modificar ni ver otras bases.
-- 1) Cambia 'CAMBIA_ESTA_CLAVE' por una clave segura (mínimo 12 caracteres).
-- 2) Ejecútalo en MySQL Workbench conectado como root.
-- 3) Pon la misma clave en backend/.env (DB_PASSWORD).

CREATE USER IF NOT EXISTS 'vokter_api'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_CLAVE';
CREATE USER IF NOT EXISTS 'vokter_api'@'127.0.0.1' IDENTIFIED BY 'CAMBIA_ESTA_CLAVE';

GRANT SELECT ON comercio.data_comercio TO 'vokter_api'@'localhost';
GRANT SELECT ON comercio.data_comercio TO 'vokter_api'@'127.0.0.1';
FLUSH PRIVILEGES;

-- Comprobación: debe mostrar solo "GRANT SELECT ON `comercio`.`data_comercio`"
SHOW GRANTS FOR 'vokter_api'@'localhost';
