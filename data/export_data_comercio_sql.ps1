$ErrorActionPreference = 'Stop'

$xmlPath = Join-Path $PSScriptRoot 'Data_Comercio.xml'
$sqlPath = Join-Path $PSScriptRoot 'data_comercio.sql'
$columns = @(
  'sociedad', 'actualizacion', 'cuenta', 'nombre', 'clienteId',
  'nombreAcreedorCliente', 'nit', 'nombreMaterial', 'jerarquia',
  'asignacion', 'direccion', 'telefono', 'correo'
)

function Convert-ToSqlValue([string] $value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return 'NULL' }
  $escaped = $value.Replace('\', '\\').Replace("'", "''").Replace("`r", ' ').Replace("`n", ' ')
  return "'$escaped'"
}

$document = [System.Xml.XmlDocument]::new()
$document.Load($xmlPath)
$rows = $document.SelectNodes('/dataComercio/registros/registro')
$utf8 = [System.Text.UTF8Encoding]::new($false)
$writer = [System.IO.StreamWriter]::new($sqlPath, $false, $utf8)

try {
  $writer.WriteLine('CREATE DATABASE IF NOT EXISTS comercio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
  $writer.WriteLine('USE comercio;')
  $writer.WriteLine('')
  $writer.WriteLine('DROP TABLE IF EXISTS data_comercio;')
  $writer.WriteLine('CREATE TABLE data_comercio (')
  $writer.WriteLine('  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,')
  $writer.WriteLine('  sociedad VARCHAR(120), actualizacion VARCHAR(20), cuenta VARCHAR(30), nombre VARCHAR(160),')
  $writer.WriteLine('  clienteId VARCHAR(40), nombreAcreedorCliente VARCHAR(255), nit VARCHAR(30),')
  $writer.WriteLine('  nombreMaterial VARCHAR(255), jerarquia VARCHAR(80), asignacion VARCHAR(80),')
  $writer.WriteLine('  direccion VARCHAR(255), telefono VARCHAR(40), correo VARCHAR(255),')
  $writer.WriteLine('  PRIMARY KEY (id), INDEX idx_nit (nit), INDEX idx_cliente (clienteId), INDEX idx_correo (correo)')
  $writer.WriteLine(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;')
  $writer.WriteLine('')

  $batch = [System.Collections.Generic.List[string]]::new()
  foreach ($row in $rows) {
    $values = foreach ($column in $columns) {
      Convert-ToSqlValue $row.SelectSingleNode($column).InnerText
    }
    $batch.Add("(" + ($values -join ',') + ")")
    if ($batch.Count -eq 500) {
      $writer.WriteLine("INSERT INTO data_comercio (" + ($columns -join ',') + ") VALUES")
      $writer.WriteLine(($batch -join ",`n") + ';')
      $writer.WriteLine('')
      $batch.Clear()
    }
  }
  if ($batch.Count -gt 0) {
    $writer.WriteLine("INSERT INTO data_comercio (" + ($columns -join ',') + ") VALUES")
    $writer.WriteLine(($batch -join ",`n") + ';')
  }
  $writer.WriteLine('')
  $writer.WriteLine('SELECT COUNT(*) AS total_importado FROM data_comercio;')
} finally {
  $writer.Dispose()
}

Write-Output "Archivo generado: $sqlPath"
Write-Output "Registros exportados: $($rows.Count)"
