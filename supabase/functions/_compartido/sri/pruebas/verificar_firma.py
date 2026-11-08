"""Verificación independiente de una firma XAdES-BES del SRI con signxml.

Uso: python verificar_firma.py <firmado.xml> <certificado.pem>

Comprueba con otra implementación (lxml para el C14N, cryptography para RSA)
los tres digests (SignedProperties, KeyInfo y el comprobante con el transform
enveloped), la firma RSA-SHA1 de SignedInfo y el digest del certificado de
SigningCertificate. Requiere signxml==4.0.3 y cryptography<45 (ver README de
supabase/functions). Sale con 0 si todo valida.
"""
import base64
import hashlib
import sys

from lxml import etree
from signxml import DigestAlgorithm, SignatureConfiguration, SignatureMethod
from signxml.xades import XAdESVerifier

NS = {"ds": "http://www.w3.org/2000/09/xmldsig#", "etsi": "http://uri.etsi.org/01903/v1.3.2#"}

datos = open(sys.argv[1], "rb").read()
pem = open(sys.argv[2], encoding="ascii").read()

config = SignatureConfiguration(
    signature_methods=frozenset({SignatureMethod.RSA_SHA1}),
    digest_algorithms=frozenset({DigestAlgorithm.SHA1}),
    expect_references=3,
)
resultados = XAdESVerifier().verify(datos, x509_cert=pem, expect_config=config)
print(f"referencias verificadas: {len(resultados)}")

# signxml no comprueba CertDigest de SigningCertificate (v1); se hace aquí.
documento = etree.fromstring(datos)
der = base64.b64decode(documento.findtext(".//ds:X509Certificate", namespaces=NS))
esperado = documento.findtext(".//etsi:SigningCertificate/etsi:Cert/etsi:CertDigest/ds:DigestValue", namespaces=NS)
if base64.b64encode(hashlib.sha1(der).digest()).decode() != esperado:
    print("CertDigest no coincide con el certificado")
    sys.exit(1)

# La firma tiene que ser el último hijo de la raíz.
if documento[-1].tag != "{%s}Signature" % NS["ds"]:
    print("ds:Signature no es el último hijo")
    sys.exit(1)
print("ok")
