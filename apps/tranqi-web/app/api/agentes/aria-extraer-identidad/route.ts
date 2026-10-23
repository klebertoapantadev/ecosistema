import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { extraerDocumento } from "../../../../modulos/socios/servicios/verificacionIdentidadAria";
import { validarCedulaEcuatoriana } from "../../../../modulos/socios/cedula-ecuador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIGENCIA_URL_SEGUNDOS = 300;

function separarNombresApellidos(titular: string | null): { nombres: string; apellidos: string } {
  if (!titular) return { nombres: "", apellidos: "" };
  // Limpiar prefijos honoríficos comunes en carnets del Foro de Abogados
  const titularLimpio = titular
    .trim()
    .replace(/^(DR\.|DRA\.|AB\.|ABG\.|LIC\.|DOCTOR|ABOGADO|DOCTORA|ABOGADA)\s+/i, "")
    .replace(/\s+/g, " ");

  const partes = titularLimpio.split(" ");
  if (partes.length <= 1) return { nombres: partes[0] ?? "", apellidos: "" };
  if (partes.length === 2) return { nombres: partes[1] ?? "", apellidos: partes[0] ?? "" };
  if (partes.length === 3) return { nombres: partes[2] ?? "", apellidos: `${partes[0]} ${partes[1]}`.trim() };
  
  // En carnets oficiales y cédulas ecuatorianas el orden estándar es: [1er Apellido] [2do Apellido] [1er Nombre] [2do Nombre]
  // Ej: "MORA MOSCOSO JUAN GENARO" -> Apellidos: "Mora Moscoso", Nombres: "Juan Genaro"
  const mitad = Math.floor(partes.length / 2);
  const apellidos = partes.slice(0, mitad).join(" ");
  const nombres = partes.slice(mitad).join(" ");
  return { nombres, apellidos };
}

export async function POST(req: NextRequest) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const admin = crearClienteAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Servicio de almacenamiento no disponible" }, { status: 500 });
  }

  try {
    let urlFirmada: string | null = null;
    let nombreArchivoOriginal = "documento-identidad";

    // 1. Procesar archivo directo vía Multipart/FormData o JSON con referencia
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const archivo = formData.get("archivo") as File | null;
      if (!archivo) {
        return NextResponse.json({ ok: false, error: "No se proporcionó ningún archivo para análisis." }, { status: 400 });
      }

      nombreArchivoOriginal = archivo.name;
      const extension = archivo.name.split(".").pop() || "jpg";
      const rutaTemp = `temporal-identidad/${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;

      const buffer = Buffer.from(await archivo.arrayBuffer());
      const { error: errorSubida } = await admin.storage
        .from("socios-documentos")
        .upload(rutaTemp, buffer, {
          contentType: archivo.type,
          upsert: true,
        });

      if (errorSubida) {
        console.error("Error al subir archivo temporal para ARIA:", errorSubida);
        return NextResponse.json({ ok: false, error: `Error de almacenamiento: ${errorSubida.message}` }, { status: 500 });
      }

      const { data: firmada, error: errorFirma } = await admin.storage
        .from("socios-documentos")
        .createSignedUrl(rutaTemp, VIGENCIA_URL_SEGUNDOS);

      if (errorFirma || !firmada?.signedUrl) {
        return NextResponse.json({ ok: false, error: "No se pudo generar el enlace de análisis para ARIA." }, { status: 500 });
      }

      urlFirmada = firmada.signedUrl;
    } else {
      const cuerpo = await req.json();
      const { rutaStorage, urlDirecta } = cuerpo;

      if (urlDirecta) {
        urlFirmada = urlDirecta;
      } else if (rutaStorage) {
        const { data: firmada, error: errorFirma } = await admin.storage
          .from("socios-documentos")
          .createSignedUrl(rutaStorage, VIGENCIA_URL_SEGUNDOS);

        if (errorFirma || !firmada?.signedUrl) {
          return NextResponse.json({ ok: false, error: "No se pudo firmar la ruta del documento." }, { status: 500 });
        }
        urlFirmada = firmada.signedUrl;
      }
    }

    if (!urlFirmada) {
      return NextResponse.json({ ok: false, error: "No se pudo obtener la URL de acceso al documento." }, { status: 400 });
    }

    // 2. Extraer datos del documento con ARIA
    const { extraccion, runId } = await extraerDocumento(urlFirmada);

    const { nombres: nombresSep, apellidos: apellidosSep } = separarNombresApellidos(extraccion.titular);
    const nombresFinal = extraccion.nombres || nombresSep;
    const apellidosFinal = extraccion.apellidos || apellidosSep;
    const validacionCedula = extraccion.identificacion ? validarCedulaEcuatoriana(extraccion.identificacion) : null;

    // Calcular años de experiencia si se detecta fecha de inscripción
    let anosExperienciaCalculados: number | null = null;
    if (extraccion.fecha_inscripcion || extraccion.fecha_emision) {
      const fechaRef = extraccion.fecha_inscripcion || extraccion.fecha_emision || "";
      const matchAnio = fechaRef.match(/\b(19\d{2}|20\d{2})\b/);
      const anioStr = matchAnio?.[1];
      if (anioStr) {
        const anioInsc = parseInt(anioStr, 10);
        const anioActual = new Date().getFullYear();
        if (!isNaN(anioInsc) && anioInsc <= anioActual) {
          anosExperienciaCalculados = Math.max(0, anioActual - anioInsc);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      datos: {
        titular: extraccion.titular,
        nombres: nombresFinal,
        apellidos: apellidosFinal,
        identificacion: extraccion.identificacion,
        matricula_profesional: extraccion.matricula_profesional ?? null,
        fecha_inscripcion: extraccion.fecha_inscripcion ?? null,
        anos_experiencia_calculados: anosExperienciaCalculados,
        tipo_detectado: extraccion.tipo_detectado,
        emisor: extraccion.emisor,
        fecha_emision: extraccion.fecha_emision,
        fecha_caducidad: extraccion.fecha_caducidad,
        legible: extraccion.legible,
        cedula_valida: validacionCedula?.valida ?? false,
        observaciones: extraccion.observaciones,
        run_id: runId,
        nombre_archivo: nombreArchivoOriginal,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error durante la extracción de datos con ARIA";
    console.error("Error en /api/agentes/aria-extraer-identidad:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
