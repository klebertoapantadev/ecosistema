"""Valida un XML (stdin) contra un XSD del SRI. Uso: python validar_xsd.py <ruta.xsd>

Solo lo usan los tests (Deno no tiene validador XSD). Sale con 0 si es válido;
si no, imprime los errores, uno por línea, y sale con 1.
"""
import sys

from lxml import etree

esquema = etree.XMLSchema(etree.parse(sys.argv[1]))
documento = etree.fromstring(sys.stdin.buffer.read(), etree.XMLParser(resolve_entities=False, no_network=True))
if esquema.validate(documento):
    sys.exit(0)
for error in esquema.error_log:
    print(f"línea {error.line}: {error.message}")
sys.exit(1)
