-- esquema.sql — base de datos MySQL privada del servidor (solo estructura, sin datos).
-- Los datos de clientes se cargan aparte con:  sudo vokter-importar-clientes /ruta/Data_Comercio.xml
-- Este archivo NO debe contener datos personales: el repositorio es público.

CREATE DATABASE IF NOT EXISTS comercio
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE comercio;

-- Clientes de renovaciones (misma estructura que import_Data_Comercio.sql, con clave única por cliente).
CREATE TABLE IF NOT EXISTS data_comercio (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sociedad              VARCHAR(120),
  actualizacion         VARCHAR(20),
  cuenta                VARCHAR(30),
  nombre                VARCHAR(160),
  clienteId             VARCHAR(40) NOT NULL,
  nombreAcreedorCliente VARCHAR(255),
  nit                   VARCHAR(30),
  nombreMaterial        VARCHAR(255),
  jerarquia             VARCHAR(80),
  asignacion            VARCHAR(80),
  direccion             VARCHAR(255),
  telefono              VARCHAR(40),
  correo                VARCHAR(255),
  importado_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cliente (clienteId),
  INDEX idx_nit (nit),
  INDEX idx_correo (correo)
) ENGINE=InnoDB;
