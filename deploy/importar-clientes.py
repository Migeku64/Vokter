#!/usr/bin/env python3
"""vokter-importar-clientes — carga los clientes de Data_Comercio (XML o CSV) en MySQL comercio.data_comercio.

Uso en el servidor:
    sudo vokter-importar-clientes /tmp/Data_Comercio.xml     (o el .csv original separado por ;)
    sudo vokter-importar-clientes /tmp/Data_Comercio.xml --reemplazar   (borra lo anterior y carga de nuevo)
    vokter-importar-clientes archivo --solo-sql > salida.sql            (no toca MySQL; genera el SQL)

Los valores '#N/D' o vacíos se guardan como NULL. Si un cliente ya existe, se actualizan sus datos.
Después de importar, borra el archivo de /tmp: tiene datos personales.
"""
import csv
import subprocess
import sys
import xml.etree.ElementTree as ET

COLUMNAS = ['sociedad', 'actualizacion', 'cuenta', 'nombre', 'clienteId', 'nombreAcreedorCliente', 'nit',
            'nombreMaterial', 'jerarquia', 'asignacion', 'direccion', 'telefono', 'correo']
# Formato corto del XML (<renovaciones>) -> columnas de la tabla
DESDE_XML = {'anio': 'actualizacion', 'cuenta': 'cuenta', 'concepto': 'nombre', 'cliente': 'clienteId',
             'nombre': 'nombreAcreedorCliente', 'nit': 'nit', 'material': 'nombreMaterial', 'jerarquia': 'jerarquia',
             'asignacion': 'asignacion', 'direccion': 'direccion', 'telefono': 'telefono', 'correo': 'correo'}
# Encabezados del CSV original -> columnas de la tabla
DESDE_CSV = {'Sociedad': 'sociedad', 'ACTUALI': 'actualizacion', 'Cuenta': 'cuenta', 'Nombre': 'nombre',
             'Cliente': 'clienteId', 'Nombre acreedor/cliente': 'nombreAcreedorCliente', 'NIT': 'nit',
             'Nombre material': 'nombreMaterial', 'Jerarquia': 'jerarquia', 'Asignacion': 'asignacion',
             'DIRECCION': 'direccion', 'TELEFONO': 'telefono', 'CORREO': 'correo'}
LOTE = 500


def limpio(v):
    v = (v or '').strip()
    return None if v in ('', '#N/D', 'N/D', '#N/A') else v


def leer(ruta):
    if ruta.lower().endswith('.xml'):
        raiz = ET.parse(ruta).getroot()
        sociedad = raiz.get('sociedad')
        for reg in raiz.iter('registro'):
            if reg.find('clienteId') is not None:
                # Formato con los mismos nombres de columna de la tabla (<dataComercio>…<clienteId>…)
                fila = {h.tag: limpio(h.text) for h in reg if h.tag in COLUMNAS}
            else:
                # Formato corto (<renovaciones sociedad="…">…<cliente>…)
                fila = {'sociedad': limpio(sociedad)}
                fila.update({DESDE_XML[h.tag]: limpio(h.text) for h in reg if h.tag in DESDE_XML})
            yield fila
    else:
        with open(ruta, encoding='utf-8-sig', newline='') as f:
            for r in csv.DictReader(f, delimiter=';'):
                yield {DESDE_CSV[k]: limpio(v) for k, v in r.items() if k in DESDE_CSV}


def sql_valor(v):
    if v is None:
        return 'NULL'
    v = v.replace('\\', '\\\\').replace("'", "''").replace('\0', '')
    return f"'{v}'"


def generar(filas, reemplazar):
    yield 'SET NAMES utf8mb4;\nUSE comercio;\nSTART TRANSACTION;\n'
    if reemplazar:
        yield 'DELETE FROM data_comercio;\n'
    lote = []
    total = 0
    for f in filas:
        if not f.get('clienteId'):
            continue
        lote.append('(' + ','.join(sql_valor(f.get(c)) for c in COLUMNAS) + ')')
        total += 1
        if len(lote) == LOTE:
            yield insert(lote)
            lote = []
    if lote:
        yield insert(lote)
    yield 'COMMIT;\nSELECT COUNT(*) AS clientes_en_base FROM data_comercio;\n'
    generar.total = total


def insert(lote):
    actualiza = ', '.join(f'{c}=VALUES({c})' for c in COLUMNAS if c != 'clienteId')
    return f"INSERT INTO data_comercio ({','.join(COLUMNAS)}) VALUES\n" + ',\n'.join(lote) + f"\nON DUPLICATE KEY UPDATE {actualiza};\n"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1:
        print(__doc__)
        sys.exit(1)
    reemplazar = '--reemplazar' in sys.argv
    sql = ''.join(generar(leer(args[0]), reemplazar))
    if '--solo-sql' in sys.argv:
        sys.stdout.write(sql)
        print(f'-- {generar.total} clientes', file=sys.stderr)
        return
    r = subprocess.run(['mysql', '--default-character-set=utf8mb4'], input=sql.encode('utf-8'))
    if r.returncode:
        sys.exit(r.returncode)
    print(f'Importados {generar.total} clientes. Ahora borra el archivo original del servidor: rm {args[0]}')


if __name__ == '__main__':
    main()
