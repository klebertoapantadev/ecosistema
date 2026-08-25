// Firma y verificacion HS256 sobre Web Crypto.
//
// Por que no una libreria: hacen falta exactamente dos operaciones (firmar un
// objeto, verificarlo) y el codigo corre en Route Handlers que pueden acabar en
// el runtime Edge, donde `Buffer` y los modulos nativos de Node no existen.
// Web Crypto esta en los dos runtimes, asi que este modulo funciona igual en
// ambos y no arrastra dependencias a un paquete que hoy no tiene ninguna.
//
// El formato es JWT compacto estandar (header.payload.firma) a proposito: el
// token de usuario que se acuña aqui lo tiene que entender GoTrue/PostgREST de
// Supabase, no nosotros.

const codificador = new TextEncoder();
const descodificador = new TextDecoder();

function base64UrlDesdeBytes(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesDesdeBase64Url(texto: string): Uint8Array {
  const relleno = texto.length % 4 === 0 ? "" : "=".repeat(4 - (texto.length % 4));
  const binario = atob(texto.replace(/-/g, "+").replace(/_/g, "/") + relleno);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function base64UrlDesdeTexto(texto: string): string {
  return base64UrlDesdeBytes(codificador.encode(texto));
}

async function importarClave(secreto: string, usos: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    codificador.encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usos,
  );
}

/** Firma un objeto como JWT compacto HS256. `contenido.exp` va en segundos Unix. */
export async function firmarJwtHs256(
  contenido: Record<string, unknown>,
  secreto: string,
): Promise<string> {
  const cabecera = base64UrlDesdeTexto(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const cuerpo = base64UrlDesdeTexto(JSON.stringify(contenido));
  const material = `${cabecera}.${cuerpo}`;
  const clave = await importarClave(secreto, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", clave, codificador.encode(material));
  return `${material}.${base64UrlDesdeBytes(new Uint8Array(firma))}`;
}

/**
 * Verifica firma y expiracion. Devuelve el contenido o `null`.
 *
 * Nunca lanza: un token invalido es un caso esperado (caducado, manipulado,
 * basura) y quien llama debe responder 401, no romperse. Devolver null en vez
 * de un motivo es deliberado — decirle a quien ataca POR QUE fallo su token le
 * ahorra trabajo.
 *
 * La comparacion la hace `crypto.subtle.verify`, que es de tiempo constante;
 * comparar la firma como string seria filtrar informacion por temporizacion.
 */
export async function verificarJwtHs256(
  token: string,
  secreto: string,
): Promise<Record<string, unknown> | null> {
  try {
    const partes = token.split(".");
    if (partes.length !== 3) return null;
    // Indexado explicito y no destructuring: con noUncheckedIndexedAccess el
    // destructuring da `string | undefined` aunque la longitud ya este
    // comprobada, y silenciarlo con `!` seria apagar justo la comprobacion que
    // interesa en codigo que valida tokens.
    const cabecera = partes[0] ?? "";
    const cuerpo = partes[1] ?? "";
    const firma = partes[2] ?? "";

    // El algoritmo se comprueba contra lo que esperamos, no se lee del token:
    // aceptar `alg` del propio token es la vulnerabilidad clasica de JWT
    // (alg: none, o degradar RS256 a HS256).
    const cabeceraJson = JSON.parse(descodificador.decode(bytesDesdeBase64Url(cabecera)));
    if (cabeceraJson?.alg !== "HS256") return null;

    const clave = await importarClave(secreto, ["verify"]);
    const valida = await crypto.subtle.verify(
      "HMAC",
      clave,
      bytesDesdeBase64Url(firma) as unknown as BufferSource,
      codificador.encode(`${cabecera}.${cuerpo}`),
    );
    if (!valida) return null;

    const contenido = JSON.parse(descodificador.decode(bytesDesdeBase64Url(cuerpo)));
    if (typeof contenido !== "object" || contenido === null) return null;

    // exp obligatorio: un token de sesion sin caducidad no es una sesion.
    if (typeof contenido.exp !== "number") return null;
    if (contenido.exp <= Math.floor(Date.now() / 1000)) return null;

    return contenido as Record<string, unknown>;
  } catch {
    return null;
  }
}
