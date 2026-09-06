import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { extraerDocumento } from "../../../../modulos/socios/servicios/verificacionIdentidadAria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TRQ-COM-001 — extracción de datos de un documento de la billetera.
//
// REESCRITO EL 2026-09-06. La versión anterior decía llamarse «Aria (Legal AI
// Agent)» y no llamaba a Aria: clasificaba el documento por palabras clave del
// NOMBRE DEL FICHERO, buscaba la cédula con un regex sobre ese mismo nombre, y
// para una cédula rellenaba la fecha de caducidad con «hoy + 5 años», la de
// emisión con «hoy − 5 años» y la de nacimiento con «hoy − 30 años, 12 de
// mayo». Todo eso volvía bajo un `resumenOcr` que afirmaba «Aria analizó N
// archivo(s)»: el usuario veía fechas inventadas presentadas como extraídas de
// su propio documento.
//
// (Además consultaba `seg_usuario.usu_identificacion` y `usu_detalles`, dos
// columnas que no existen, así que esa parte fallaba en silencio.)
//
// Ahora el documento se lee de verdad. Lo que no se pueda leer vuelve vacío y
// lo rellena el usuario: un campo en blanco es honesto, uno inventado no.

interface ArchivoEntrada {
  nombre?: string;
  tamano?: number;
  mimetype?: string;
  base64?: string;
  url?: string;
}

const CARPETA_TEMPORAL = "analisis-temporal";
const VIGENCIA_URL_SEGUNDOS = 300;
const MIMES_ANALIZABLES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

/** Traduce lo que detecta Aria al vocabulario de categorías de la billetera. */
function categoriaDe(tipo: string | null): "identidad" | "vehicular" | "contratos" | "profesional" | "otros" {
  switch (tipo) {
    case "cedula":
    case "pasaporte":
      return "identidad";
    case "titulo_universitario":
    case "matricula_abogado":
    case "ruc":
      return "profesional";
    default:
      return "otros";
  }
}

export async function POST(req: NextRequest) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  let cuerpo: { archivos?: ArchivoEntrada[] };
  try {
    cuerpo = (await req.json()) as { archivos?: ArchivoEntrada[] };
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido" }, { status: 400 });
  }

  const archivos = cuerpo.archivos ?? [];
  if (archivos.length === 0) {
    return NextResponse.json({ ok: false, error: "No se proporcionaron archivos" }, { status: 400 });
  }

  // Se analiza la primera imagen. Un PDF no lo lee el modelo de visión, y
  // decirlo es mejor que devolver un análisis vacío sin explicar por qué.
  const archivo = archivos.find((a) => MIMES_ANALIZABLES.includes((a.mimetype ?? "").toLowerCase()));
  if (!archivo) {
    return NextResponse.json({
      ok: true,
      analizado: false,
      motivo:
        "Por ahora solo se pueden leer imágenes (PNG, JPG o WEBP). Sube una foto del documento o completa los campos a mano.",
      analisis: null,
    });
  }

  const admin = crearClienteAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Almacenamiento no disponible" }, { status: 500 });
  }

  // Aria descarga la imagen por HTTP, así que hace falta una URL alcanzable. El
  // fichero se sube a una carpeta temporal y se borra en cuanto termina el
  // análisis: vive segundos y nunca se mezcla con los documentos del usuario.
  let ruta: string | null = null;
  try {
    let urlParaAria = archivo.url ?? null;

    if (!urlParaAria) {
      if (!archivo.base64) {
        return NextResponse.json({ ok: false, error: "El archivo no trae contenido" }, { status: 400 });
      }
      const limpio = archivo.base64.includes(",") ? archivo.base64.split(",")[1]! : archivo.base64;
      const bytes = Buffer.from(limpio, "base64");
      ruta = `${CARPETA_TEMPORAL}/${user.id}/${randomUUID()}`;

      const { error: errorSubida } = await admin.storage
        .from("socios-documentos")
        .upload(ruta, bytes, { contentType: archivo.mimetype ?? "image/jpeg", upsert: true });
      if (errorSubida) {
        return NextResponse.json({ ok: false, error: "No se pudo preparar el documento" }, { status: 500 });
      }

      const { data: firmada } = await admin.storage
        .from("socios-documentos")
        .createSignedUrl(ruta, VIGENCIA_URL_SEGUNDOS);
      urlParaAria = firmada?.signedUrl ?? null;
    }

    if (!urlParaAria) {
      return NextResponse.json({ ok: false, error: "No se pudo preparar el documento" }, { status: 500 });
    }

    const { extraccion } = await extraerDocumento(urlParaAria);

    return NextResponse.json({
      ok: true,
      analizado: true,
      agente: "Aria",
      analisis: {
        // Nada de esto se rellena si no está en el documento.
        tituloSugerido: extraccion.tipo_detectado
          ? extraccion.tipo_detectado.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase())
          : null,
        categoriaSugerida: categoriaDe(extraccion.tipo_detectado),
        tipoSugerido: extraccion.tipo_detectado,
        titularNombre: extraccion.titular,
        titularIdentificacion: extraccion.identificacion,
        entidadEmisora: extraccion.emisor,
        fechaEmision: extraccion.fecha_emision,
        fechaCaducidad: extraccion.fecha_caducidad,
        legible: extraccion.legible,
        observaciones: extraccion.observaciones,
        resumenOcr: extraccion.legible
          ? "Datos leídos del documento. Revísalos y corrige lo que haga falta antes de guardar."
          : "El documento no se lee con claridad. Súbelo de nuevo con mejor luz, o completa los campos a mano.",
      },
    });
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json(
      { ok: false, analizado: false, error: `No se pudo analizar el documento (${motivo}).` },
      { status: 503 },
    );
  } finally {
    // El temporal se borra pase lo que pase, también si el análisis falló.
    if (ruta) {
      await admin.storage.from("socios-documentos").remove([ruta]);
    }
  }
}
