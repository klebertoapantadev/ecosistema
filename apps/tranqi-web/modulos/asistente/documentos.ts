import { conDocumentos, firmarJwtHs256, verificarJwtHs256, type DocumentoAdjunto, type Herramienta } from "@eco/agentes-ia";
import { crearClienteAdmin } from "@eco/supabase/servidor";
import type { ClienteConToken } from "@eco/supabase/token";
import type { ContextoAsistente } from "./contexto";
import { campos, fechaEcuador, lista } from "./formato";

// Lectura de documentos por los asistentes (cliente y abogado).
//
// Hasta aqui las herramientas devolvian METADATOS de los documentos y el
// prompt del abogado prometia "leer y resumir documentos del expediente" sin
// tener con que. Este modulo cierra ese hueco con dos herramientas compartidas
// por los dos roles —`mis_documentos` y `leer_documento`— y un endpoint que
// sirve los bytes.
//
// COMO LLEGA EL DOCUMENTO AL MODELO. La herramienta no devuelve el contenido:
// devuelve un enlace firmado de corta vida (ver `conDocumentos`), y es el engine
// de ARIA quien lo descarga, extrae el texto de un PDF o rasteriza uno
// escaneado, y se lo pasa al modelo dentro del mismo turno. Dos razones:
//   1. El Route Handler del MCP tiene segundos, no minutos: extraer y leer un
//      PDF de veinte paginas dentro de la llamada a la herramienta no cabe.
//   2. Un resultado de herramienta MCP es texto; una pagina escaneada no.
//
// DE DONDE SALEN LOS BYTES. Los documentos de la billetera (TRQ-COM-001) guardan
// el fichero en base64 dentro de la fila; los del expediente (trq_documento_caso)
// en Storage, con `dcc_ruta_storage` = `<bucket>/<ruta>`. En ambos casos la fila
// se resuelve BAJO RLS con el token del usuario: si no la ve, no hay documento.
// El enlace lleva la identidad del usuario firmada, de modo que el endpoint que
// sirve los bytes vuelve a resolver la fila bajo RLS con esa misma identidad.
// Nadie —ni el modelo, ni quien tenga el enlace pasado el minuto— puede pedir
// un documento ajeno.

/** Vida del enlace. Cubre la descarga por ARIA dentro del turno y nada mas. */
const VIGENCIA_ENLACE_SEGUNDOS = 300;
/** Ficheros de un documento multi-archivo (anverso, reverso, anexos) que se entregan de una vez. */
const MAX_ARCHIVOS_POR_DOCUMENTO = 4;
const PROPOSITO = "documento";

export type OrigenDocumento = "billetera" | "expediente";

export interface ReferenciaDocumento {
  origen: OrigenDocumento;
  documentoId: string;
  /** Posicion dentro de `doc_archivos` para la billetera; 0 para el expediente. */
  archivo: number;
  /** Quien puede verlo. Viaja firmado; el endpoint lo usa para consultar bajo RLS. */
  usuarioId: string;
}

export async function firmarEnlaceDocumento(ref: ReferenciaDocumento, secreto: string): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  return firmarJwtHs256(
    {
      pro: PROPOSITO,
      sub: ref.usuarioId,
      ori: ref.origen,
      doc: ref.documentoId,
      arc: ref.archivo,
      iat: ahora,
      exp: ahora + VIGENCIA_ENLACE_SEGUNDOS,
    },
    secreto,
  );
}

/**
 * Devuelve la referencia o `null`. El claim `pro` separa estos enlaces de las
 * capsulas de sesion: comparten secreto, pero una capsula no sirve para bajar
 * un documento ni un enlace de documento vale como sesion.
 */
export async function verificarEnlaceDocumento(
  token: string,
  secreto: string,
): Promise<ReferenciaDocumento | null> {
  const c = await verificarJwtHs256(token, secreto);
  if (!c || c.pro !== PROPOSITO) return null;
  const origen = c.ori;
  if (origen !== "billetera" && origen !== "expediente") return null;
  if (typeof c.sub !== "string" || !c.sub) return null;
  if (typeof c.doc !== "string" || !c.doc) return null;
  if (typeof c.arc !== "number" || !Number.isInteger(c.arc) || c.arc < 0) return null;
  return { origen, documentoId: c.doc, archivo: c.arc, usuarioId: c.sub };
}

export function urlEnlaceDocumento(origenHttp: string, token: string): string {
  return `${origenHttp.replace(/\/$/, "")}/api/asistente/documento/${token}`;
}

// ── Lectura de los bytes (la usa el endpoint) ─────────────────────────────

interface ArchivoBilletera {
  nombre?: string;
  mimetype?: string;
  base64?: string;
  url?: string;
  tamano?: number;
}

/** Normaliza la forma en que la billetera guarda sus ficheros (lista, o columnas sueltas). */
function archivosDeBilletera(fila: {
  doc_archivos: unknown;
  doc_archivo_nombre: string | null;
  doc_archivo_mimetype: string | null;
  /** Solo lo pide quien va a servir los bytes: son megabytes por fila. */
  doc_archivo_base64?: string | null;
  doc_archivo_url: string | null;
}): ArchivoBilletera[] {
  if (Array.isArray(fila.doc_archivos) && fila.doc_archivos.length > 0) {
    return fila.doc_archivos as ArchivoBilletera[];
  }
  if (fila.doc_archivo_nombre || fila.doc_archivo_base64 || fila.doc_archivo_url) {
    return [
      {
        nombre: fila.doc_archivo_nombre ?? undefined,
        mimetype: fila.doc_archivo_mimetype ?? undefined,
        base64: fila.doc_archivo_base64 ?? undefined,
        url: fila.doc_archivo_url ?? undefined,
      },
    ];
  }
  return [];
}

export interface BytesDocumento {
  bytes: Uint8Array;
  mime: string;
  nombre: string;
}

/**
 * Carga el fichero al que apunta una referencia. `supabase` es el cliente del
 * usuario (RLS): una fila que no le pertenece devuelve `null`, igual que una
 * que no existe.
 */
export async function cargarBytesDocumento(
  ref: ReferenciaDocumento,
  supabase: ClienteConToken,
): Promise<BytesDocumento | null> {
  if (ref.origen === "billetera") {
    const { data } = await supabase
      .schema("tranqui_legal")
      .from("trq_billetera_documento")
      .select("doc_titulo, doc_archivos, doc_archivo_nombre, doc_archivo_mimetype, doc_archivo_base64, doc_archivo_url")
      .eq("doc_id", ref.documentoId)
      .is("doc_eliminado_en", null)
      .maybeSingle();
    if (!data) return null;
    const archivo = archivosDeBilletera(data)[ref.archivo];
    if (!archivo) return null;
    const nombre = archivo.nombre ?? `${data.doc_titulo ?? "documento"}`;
    const mime = archivo.mimetype ?? "application/octet-stream";
    if (archivo.base64) {
      const limpio = archivo.base64.includes(",") ? archivo.base64.split(",")[1]! : archivo.base64;
      return { bytes: new Uint8Array(Buffer.from(limpio, "base64")), mime, nombre };
    }
    // Un archivo que solo trae `url` NO se sirve. Esa URL la escribio el
    // usuario al subir (la API la acepta tal cual), y salir a buscarla desde el
    // servidor convertiria este endpoint en un proxy hacia cualquier direccion,
    // incluidas las internas. Solo se entrega lo que esta guardado en la fila.
    return null;
  }

  // Expediente: la fila bajo RLS; el binario, del bucket. Que el usuario vea
  // la fila es lo que autoriza la descarga, por eso el orden no es negociable.
  const { data } = await supabase
    .schema("tranqui_legal")
    .from("trq_documento_caso")
    .select("dcc_ruta_storage, dcc_nombre_archivo, dcc_mime")
    .eq("dcc_id", ref.documentoId)
    .is("dcc_eliminado_en", null)
    .maybeSingle();
  if (!data) return null;
  const [bucket, ...resto] = data.dcc_ruta_storage.split("/");
  const ruta = resto.join("/");
  if (!bucket || !ruta) return null;
  const admin = crearClienteAdmin();
  if (!admin) return null;
  const { data: blob, error } = await admin.storage.from(bucket).download(ruta);
  if (error || !blob) return null;
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    mime: data.dcc_mime ?? blob.type ?? "application/octet-stream",
    nombre: data.dcc_nombre_archivo ?? ruta.split("/").pop() ?? "documento",
  };
}

// ── Herramientas ──────────────────────────────────────────────────────────

type HerramientaAsistente = Herramienta<ContextoAsistente>;

const misDocumentos: HerramientaAsistente = {
  descripcion:
    "Lista los documentos que el usuario guarda en su billetera digital (cedula, " +
    "licencia, matricula vehicular, contratos, titulos, polizas...), con su id, " +
    "tipo, titular, numero y fecha de caducidad. Usala cuando pregunte por 'mis " +
    "documentos', 'que tengo guardado' o si algo le caduca. Para leer el " +
    "contenido de uno, pasa su id a leer_documento.",
  esquema: {
    type: "object",
    properties: {
      categoria: {
        type: "string",
        description: "Opcional: identidad, vehicular, contratos, profesional u otros.",
      },
    },
  },
  async ejecutar(argumentos, { supabase }) {
    let consulta = supabase
      .schema("tranqui_legal")
      .from("trq_billetera_documento")
      .select(
        "doc_id, doc_titulo, doc_categoria, doc_tipo, doc_titular_nombre, doc_numero_documento, doc_entidad_emisora, doc_fecha_emision, doc_fecha_caducidad, doc_archivos, doc_archivo_nombre, doc_archivo_mimetype, doc_archivo_url, doc_creado_en",
      )
      .is("doc_eliminado_en", null)
      .order("doc_creado_en", { ascending: false })
      .limit(50);
    if (typeof argumentos.categoria === "string" && argumentos.categoria.trim()) {
      consulta = consulta.eq("doc_categoria", argumentos.categoria.trim().toLowerCase());
    }
    const { data, error } = await consulta;
    if (error) throw new Error(error.message);

    return lista(
      "Documentos en la billetera",
      data,
      "No hay documentos en la billetera. Se suben desde el panel, en Billetera de documentos.",
      (d) => {
        const archivos = archivosDeBilletera(d);
        const ficheros = archivos.length
          ? archivos.map((a) => a.nombre ?? a.mimetype ?? "archivo").join(", ")
          : "sin archivo";
        return (
          `- [${d.doc_id}] ${d.doc_titulo ?? "(sin titulo)"} — ` +
          campos([
            ["categoria", d.doc_categoria],
            ["tipo", d.doc_tipo],
            ["titular", d.doc_titular_nombre],
            ["numero", d.doc_numero_documento],
            ["emisor", d.doc_entidad_emisora],
            ["emitido", d.doc_fecha_emision ? fechaEcuador(d.doc_fecha_emision) : null],
            ["caduca", d.doc_fecha_caducidad ? fechaEcuador(d.doc_fecha_caducidad) : null],
            ["archivos", ficheros],
          ])
        );
      },
    );
  },
};

const leerDocumento: HerramientaAsistente = {
  descripcion:
    "Entrega el CONTENIDO de un documento para que lo leas: el texto de un PDF, " +
    "o las paginas como imagen si esta escaneado. Acepta el id de un documento " +
    "de la billetera (mis_documentos) o de un documento del expediente de un " +
    "caso (detalle_caso / documentos_del_caso). Usala siempre antes de resumir, " +
    "citar o afirmar lo que dice un documento; nunca lo deduzcas del nombre.",
  esquema: {
    type: "object",
    properties: {
      documento_id: { type: "string", description: "El id que devolvio mis_documentos, detalle_caso o documentos_del_caso." },
    },
    required: ["documento_id"],
  },
  async ejecutar(argumentos, { supabase, sesion, origen }) {
    const documentoId = argumentos.documento_id;
    if (typeof documentoId !== "string" || !/^[0-9a-f-]{36}$/i.test(documentoId)) {
      throw new Error("Falta documento_id, o no tiene forma de identificador.");
    }
    const secreto = process.env.ASISTENTE_CAPSULA_SECRETO;
    if (!secreto) throw new Error("Falta ASISTENTE_CAPSULA_SECRETO.");

    // Primero la billetera, despues el expediente. Los dos bajo RLS: un id
    // ajeno no encuentra nada en ninguno, y no se distingue de uno inexistente.
    const { data: billetera } = await supabase
      .schema("tranqui_legal")
      .from("trq_billetera_documento")
      .select(
        "doc_id, doc_titulo, doc_categoria, doc_tipo, doc_titular_nombre, doc_archivos, doc_archivo_nombre, doc_archivo_mimetype, doc_archivo_url",
      )
      .eq("doc_id", documentoId)
      .is("doc_eliminado_en", null)
      .maybeSingle();

    if (billetera) {
      const archivos = archivosDeBilletera(billetera);
      if (archivos.length === 0) {
        return `El documento «${billetera.doc_titulo}» no tiene ningun archivo adjunto; solo metadatos.`;
      }
      const entregados = archivos.slice(0, MAX_ARCHIVOS_POR_DOCUMENTO);
      const adjuntos: DocumentoAdjunto[] = await Promise.all(
        entregados.map(async (a, i) => ({
          url: urlEnlaceDocumento(
            origen,
            await firmarEnlaceDocumento(
              { origen: "billetera", documentoId, archivo: i, usuarioId: sesion.usuarioId },
              secreto,
            ),
          ),
          nombre: a.nombre ?? `${billetera.doc_titulo ?? "documento"}-${i + 1}`,
          mime: a.mimetype,
        })),
      );
      const aviso =
        archivos.length > entregados.length
          ? ` Tiene ${archivos.length} archivos; se entregan los ${entregados.length} primeros.`
          : "";
      return conDocumentos(
        `Documento de la billetera «${billetera.doc_titulo}» — ` +
          campos([
            ["categoria", billetera.doc_categoria],
            ["tipo", billetera.doc_tipo],
            ["titular", billetera.doc_titular_nombre],
            ["archivos", entregados.map((a) => a.nombre ?? "archivo").join(", ")],
          ]) +
          `.${aviso} El contenido va a continuacion.`,
        adjuntos,
      );
    }

    const { data: expediente } = await supabase
      .schema("tranqui_legal")
      .from("trq_documento_caso")
      .select("dcc_id, dcc_tipo, dcc_nombre_archivo, dcc_mime, dcc_estado_revision, trq_caso_judicial(cas_secuencial, cas_titulo)")
      .eq("dcc_id", documentoId)
      .is("dcc_eliminado_en", null)
      .maybeSingle();

    if (expediente) {
      const caso = expediente.trq_caso_judicial as { cas_secuencial?: number; cas_titulo?: string } | null;
      const token = await firmarEnlaceDocumento(
        { origen: "expediente", documentoId, archivo: 0, usuarioId: sesion.usuarioId },
        secreto,
      );
      return conDocumentos(
        `Documento del expediente${caso ? ` del caso #${caso.cas_secuencial} (${caso.cas_titulo})` : ""}: ` +
          campos([
            ["archivo", expediente.dcc_nombre_archivo],
            ["tipo", expediente.dcc_tipo],
            ["revision", expediente.dcc_estado_revision],
          ]) +
          ". El contenido va a continuacion.",
        [
          {
            url: urlEnlaceDocumento(origen, token),
            nombre: expediente.dcc_nombre_archivo ?? "documento",
            mime: expediente.dcc_mime ?? undefined,
          },
        ],
      );
    }

    return "No hay ningun documento tuyo con ese identificador.";
  },
};

export const HERRAMIENTAS_DOCUMENTOS: Record<string, HerramientaAsistente> = {
  mis_documentos: misDocumentos,
  leer_documento: leerDocumento,
};
