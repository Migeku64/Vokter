-- 00_esquema.sql — crea la base comercio y la tabla data_comercio (solo estructura, sin datos).
-- Los datos se cargan después con el script completo (comercio_completo.sql o data/data_comercio.sql).
-- Ejecutar en MySQL Workbench conectado como root.

CREATE DATABASE IF NOT EXISTS comercio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE comercio;

CREATE TABLE IF NOT EXISTS data_comercio (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sociedad VARCHAR(120),
  actualizacion VARCHAR(20),
  cuenta VARCHAR(30),
  nombre VARCHAR(160),
  clienteId VARCHAR(40),
  nombreAcreedorCliente VARCHAR(255),
  nit VARCHAR(30),
  nombreMaterial VARCHAR(255),
  jerarquia VARCHAR(80),
  asignacion VARCHAR(80),
  direccion VARCHAR(255),
  telefono VARCHAR(40),
  correo VARCHAR(255),
  PRIMARY KEY (id),
  INDEX idx_nit (nit),
  INDEX idx_cliente (clienteId),
  INDEX idx_correo (correo)
) ENGINE=InnoDB;
