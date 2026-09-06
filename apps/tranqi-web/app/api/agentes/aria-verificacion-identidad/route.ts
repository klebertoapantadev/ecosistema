import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import {
  cotejarConIdentidadBase,
  evaluarIdentidadBase,
  extraerDocumento,
} from "../../../../modulos/socios/servicios/verificacionIdentidadAria";
import { validarCedulaEcuatoriana } from "../../../../modulos/socios/cedula-ecuador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TRQ-ABG-005 — POST /api/agentes/aria-verificacion-identidad
//
// DIFERENCIA CON EL CONTRATO DE LA ESPECIFICACIÓN, a propósito:
//
// La especificación define el request como
//   { usuarioId, tipoDocumento, archivoBase64, archivoNombre, datosReferencia }
// y aquí NO se acepta `usuarioId`. Un identificador de usuario que viaja en el
// cuerpo de la petición es un dato que elige quien llama, así que cualquiera
// podría analizar y firmar el dictamen de la solicitud de otro. La identidad
// sale de la cookie de sesión, que es lo único que el navegador no puede
// falsificar. Es la misma frontera que fija el ADR-0005 para las herramientas
// de IA, y vale igual aquí.
//
// Tampoco se recibe `archivoBase64`: el documento ya está en el bucket privado
// (lo sube /api/solicitud-socio/documentos) y lo que se le pasa a Aria es una
// URL firmada de 5 minutos. Mandar el fichero por el cuerpo obligaría a
// reenviarlo entero al proveedor del modelo en cada reintento.

interface Cuerpo {
  solicitudId?: string;
  documentoId?: string;
  tipoDocumento?: "cedula" | "titulo" | "matricula" | "ruc" | "otro";
  datosReferencia?: { nombres?: string; apellidos?: string; cedula?: string };
}

const VIGENCIA_URL_SEGUNDOS = 300;

export async function POST(req: NextRequest) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  let cuerpo: Cuerpo;
  try {
    cuerpo = (await req.json()) as Cuerpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido" }, { status: 400 });
  }

  const { solicitudId, documentoId, tipoDocumento = "cedula", datosReferencia } = cuerpo;
  if (!solicitudId || !documentoId) {
    return NextResponse.json({ ok: false, error: "Faltan solicitudId y documentoId" }, { status: 400 });
  }

  // La solicitud tiene que ser suya. RLS ya lo garantiza al leer, pero se
  // comprueba explícitamente para poder responder 403 en vez de un 404 confuso.
  const { data: solicitud } = await supabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("ssc_id, ssc_usuario_id, ssc_cedula, ssc_detalles")
    .eq("ssc_id", solicitudId)
    .maybeSingle();

  if (!solicitud) {
    return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 });
  }

  const { data: documento } = await supabase
    .schema("tranqui_legal")
    .from("trq_documento_socio")
    .select("dcs_id, dcs_url, dcs_solicitud_id")
    .eq("dcs_id", documentoId)
    .maybeSingle();

  if (!documento || documento.dcs_solicitud_id !== solicitudId || !documento.dcs_url) {
    return NextResponse.json({ ok: false, error: "Documento no encontrado en esa solicitud" }, { status: 404 });
  }

  // Comprobación barata antes de gastar una llamada al modelo: si la cédula
  // declarada no pasa el módulo 10, no hace falta leer nada.
  const cedulaDeclarada = datosReferencia?.cedula ?? solicitud.ssc_cedula ?? "";
  const cedula = validarCedulaEcuatoriana(cedulaDeclarada);
  if (tipoDocumento === "cedula" && !cedula.valida) {
    return NextResponse.json({
      ok: true,
      data: {
        resultado: "RECHAZADO",
        scoreConfianza: 0,
        datosExtraidos: null,
        observaciones: [cedula.motivo ?? "Cédula inválida"],
      },
    });
  }

  // El bucket es privado: la URL firmada se genera con el cliente admin y vive
  // 5 minutos, lo justo para que ARIA la descargue.
  const admin = crearClienteAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Almacenamiento no disponible" }, { status: 500 });
  }
  const { data: firmada, error: errorFirma } = await admin.storage
    .from("socios-documentos")
    .createSignedUrl(documento.dcs_url, VIGENCIA_URL_SEGUNDOS);

  if (errorFirma || !firmada?.signedUrl) {
    return NextResponse.json({ ok: false, error: "No se pudo preparar el documento" }, { status: 500 });
  }

  let extraccion;
  let runId: string | null = null;
  try {
    const r = await extraerDocumento(firmada.signedUrl);
    extraccion = r.extraccion;
    runId = r.runId;
  } catch (e) {
    // Que Aria no esté disponible no puede bloquear la postulación: el operador
    // sigue pudiendo revisar a mano. Se devuelve 503 y la UI lo trata como
    // "sin dictamen", no como documento rechazado.
    const motivo = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json(
      { ok: false, error: `El análisis no está disponible ahora mismo (${motivo}). Puedes continuar.` },
      { status: 503 },
    );
  }

  const detalles = (solicitud.ssc_detalles ?? {}) as Record<string, unknown>;
  const previo = (detalles.aria_validacion ?? {}) as Record<string, unknown>;
  const identidadBase = previo.identidad_base as { titular: string; identificacion: string } | undefined;

  // La cédula fija la identidad base; el resto de documentos se cotejan contra ella.
  const evaluacion =
    tipoDocumento === "cedula" || !identidadBase
      ? evaluarIdentidadBase(extraccion, {
          nombres: datosReferencia?.nombres ?? "",
          apellidos: datosReferencia?.apellidos ?? "",
          cedula: cedulaDeclarada,
        })
      : cotejarConIdentidadBase(extraccion, identidadBase);

  const analisisDocumento = {
    ...extraccion,
    tipo_solicitado: tipoDocumento,
    score_similitud: evaluacion.score,
    nivel: evaluacion.nivel,
    analizado_en: new Date().toISOString(),
    run_id: runId,
  };

  const documentosAuditados = {
    ...((previo.documentos_auditados as Record<string, unknown>) ?? {}),
    [tipoDocumento]: {
      documento_id: documentoId,
      titular: extraccion.titular,
      identificacion: extraccion.identificacion,
      nivel: evaluacion.nivel,
      score: evaluacion.score,
    },
  };

  // El dictamen global es el PEOR de los documentos analizados: basta que uno
  // sea de otra persona para que el expediente no esté verificado.
  const niveles = Object.values(documentosAuditados).map(
    (d) => (d as { score?: number }).score ?? 0,
  );
  const scoreGlobal = niveles.length ? Math.min(...niveles) : evaluacion.score;

  const dictamenGlobal = {
    estado: evaluacion.nivel === "APROBADO" && scoreGlobal >= 0.9 ? "APROBADO" : evaluacion.nivel,
    score: scoreGlobal,
    documentos_auditados: documentosAuditados,
    observaciones: evaluacion.observaciones,
    evaluado_en: new Date().toISOString(),
    identidad_base:
      tipoDocumento === "cedula" && evaluacion.nivel === "APROBADO" && extraccion.titular && extraccion.identificacion
        ? { titular: extraccion.titular, identificacion: extraccion.identificacion }
        : identidadBase ?? null,
  };

  const { error: errorGuardar } = await supabase
    .schema("tranqui_legal")
    .rpc("trq_fn_guardar_dictamen_aria", {
      p_solicitud_id: solicitudId,
      p_documento_id: documentoId,
      // El tipo `Json` generado no admite interfaces con campos opcionales; el
      // contenido es JSON serializable de sobra (así viaja a PostgREST).
      p_analisis_documento: JSON.parse(JSON.stringify(analisisDocumento)),
      p_dictamen_global: JSON.parse(JSON.stringify(dictamenGlobal)),
    });

  if (errorGuardar) {
    return NextResponse.json({ ok: false, error: errorGuardar.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      resultado: evaluacion.nivel,
      scoreConfianza: Number(evaluacion.score.toFixed(2)),
      datosExtraidos: extraccion,
      concordancia: {
        titular: extraccion.titular,
        identificacion: extraccion.identificacion,
        coincide: evaluacion.nivel === "APROBADO",
      },
      observaciones: evaluacion.observaciones,
    },
  });
}
