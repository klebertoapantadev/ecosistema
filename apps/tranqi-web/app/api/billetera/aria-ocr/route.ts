import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import zlib from "node:zlib";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { extraerDocumento } from "../../../../modulos/socios/servicios/verificacionIdentidadAria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ArchivoEntrada {
  nombre?: string;
  tamano?: number;
  mimetype?: string;
  base64?: string;
  url?: string;
}

const CARPETA_TEMPORAL = "analisis-temporal";
const VIGENCIA_URL_SEGUNDOS = 300;
const MIMES_ANALIZABLES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

/** Traduce lo que detecta Aria al vocabulario de categorías de la billetera. */
function categoriaDe(tipo: string | null): "identidad" | "vehicular" | "contratos" | "profesional" | "otros" {
  switch (tipo) {
    case "cedula":
    case "pasaporte":
    case "certificado_votacion":
      return "identidad";
    case "matricula_vehicular":
    case "licencia_conducir":
    case "poliza_seguro":
      return "vehicular";
    case "contrato":
      return "contratos";
    case "cv":
    case "hoja_vida":
    case "titulo_universitario":
    case "matricula_abogado":
    case "ruc":
    case "ruc_nit":
      return "profesional";
    case "informe":
      return "otros";
    default:
      return "otros";
  }
}

/**
 * Extractor resiliente de texto desde un buffer PDF (decodifica flujos comprimidos FlateDecode y strings).
 */
function extraerTextoDePdfBuffer(buffer: Buffer): string {
  const contenido = buffer.toString("binary");
  const textos: string[] = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(contenido)) !== null) {
    const rawStream = match[1];
    if (!rawStream) continue;

    const streamBuf = Buffer.from(rawStream, "binary");
    let decompressed: string | null = null;

    try {
      decompressed = zlib.inflateSync(streamBuf).toString("utf-8");
    } catch {
      try {
        decompressed = zlib.inflateRawSync(streamBuf).toString("utf-8");
      } catch {
        decompressed = rawStream;
      }
    }

    if (decompressed) {
      const tjMatches = decompressed.matchAll(/\((.*?)\)\s*Tj/g);
      for (const m of tjMatches) {
        if (m[1]) textos.push(m[1].replace(/\\([()\\])/g, "$1"));
      }

      const tjArrayMatches = decompressed.matchAll(/\[(.*?)\]\s*TJ/g);
      for (const m of tjArrayMatches) {
        if (m[1]) {
          const innerStrings = m[1].matchAll(/\((.*?)\)/g);
          let combined = "";
          for (const s of innerStrings) {
            if (s[1]) combined += s[1].replace(/\\([()\\])/g, "$1");
          }
          if (combined) textos.push(combined);
        }
      }

      const palabras = decompressed.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ0-9]{3,}/g);
      if (palabras && palabras.length > 5) {
        textos.push(palabras.join(" "));
      }
    }
  }

  // Capturar fragmentos legibles del cuerpo plano
  const stringsVisibles = contenido.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s.,:\-/@()]{4,}/g);
  if (stringsVisibles) {
    textos.push(stringsVisibles.slice(0, 100).join(" "));
  }

  return textos.join(" ");
}

/**
 * Normaliza fechas detectadas a formato AAAA-MM-DD
 */
function normalizarFecha(str: string | null | undefined): string | null {
  if (!str) return null;
  const s = str.trim();
  // Formato AAAA-MM-DD o AAAA/MM/DD
  const mIso = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (mIso) {
    const y = mIso[1];
    const m = mIso[2]!.padStart(2, "0");
    const d = mIso[3]!.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // Formato DD-MM-AAAA o DD/MM/AAAA
  const mLatam = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (mLatam) {
    const d = mLatam[1]!.padStart(2, "0");
    const m = mLatam[2]!.padStart(2, "0");
    const y = mLatam[3];
    return `${y}-${m}-${d}`;
  }
  return null;
}

/**
 * Motor de análisis heurístico y extracción estructurada cuando Aria no está conectado o para complementar lectura.
 */
function analizarContenidoDocumento(texto: string, nombreArchivo: string, nombreContexto = "") {
  const fullText = `${nombreArchivo} ${nombreContexto} ${texto}`.trim();
  const lower = fullText.toLowerCase();

  // 1. Qué es el documento
  let queEs = "Documento Seguro";
  let tipoDetectado = "otro";
  let categoriaSugerida: "identidad" | "vehicular" | "contratos" | "profesional" | "otros" = "otros";
  let requiereCaducidad = false;

  if (
    lower.includes("curriculum") ||
    lower.includes("currículum") ||
    lower.includes("cv") ||
    lower.includes("hoja de vida") ||
    lower.includes("resume") ||
    lower.includes("perfil profesional") ||
    lower.includes("experiencia laboral")
  ) {
    queEs = "Currículum Vitae (CV)";
    tipoDetectado = "cv";
    categoriaSugerida = "profesional";
    requiereCaducidad = false;
  } else if (
    lower.includes("contrato") ||
    lower.includes("convenio") ||
    lower.includes("arrendamiento") ||
    lower.includes("prestacion de servicios") ||
    lower.includes("prestación de servicios") ||
    lower.includes("acuerdo")
  ) {
    queEs = "Contrato / Acuerdo Legal";
    tipoDetectado = "contrato";
    categoriaSugerida = "contratos";
    requiereCaducidad = lower.includes("plazo") || lower.includes("vence") || lower.includes("vigencia");
  } else if (
    lower.includes("licencia") ||
    lower.includes("conducir") ||
    lower.includes("licencia de conducir")
  ) {
    queEs = "Licencia de Conducir";
    tipoDetectado = "licencia_conducir";
    categoriaSugerida = "vehicular";
    requiereCaducidad = true;
  } else if (
    lower.includes("matricula") ||
    lower.includes("matrícula") ||
    lower.includes("soat") ||
    lower.includes("poliza") ||
    lower.includes("póliza") ||
    lower.includes("seguro vehicular")
  ) {
    queEs = "Matrícula / Póliza Vehicular";
    tipoDetectado = "matricula_vehicular";
    categoriaSugerida = "vehicular";
    requiereCaducidad = true;
  } else if (
    lower.includes("cedula") ||
    lower.includes("cédula") ||
    lower.includes("identidad") ||
    lower.includes("dni") ||
    lower.includes("pasaporte") ||
    lower.includes("ciudadania") ||
    lower.includes("ciudadanía")
  ) {
    queEs = lower.includes("pasaporte") ? "Pasaporte" : "Cédula de Identidad";
    tipoDetectado = lower.includes("pasaporte") ? "pasaporte" : "cedula";
    categoriaSugerida = "identidad";
    requiereCaducidad = true;
  } else if (
    lower.includes("titulo") ||
    lower.includes("título") ||
    lower.includes("diploma") ||
    lower.includes("senescyt") ||
    lower.includes("abogado") ||
    lower.includes("grado")
  ) {
    queEs = "Título Profesional / Certificado Académico";
    tipoDetectado = "titulo_universitario";
    categoriaSugerida = "profesional";
    requiereCaducidad = false;
  } else if (
    lower.includes("ruc") ||
    lower.includes("nit") ||
    lower.includes("sri") ||
    lower.includes("tributario") ||
    lower.includes("factura")
  ) {
    queEs = "Registro Tributario (RUC / NIT)";
    tipoDetectado = "ruc_nit";
    categoriaSugerida = "profesional";
    requiereCaducidad = lower.includes("vigencia") || lower.includes("valido hasta");
  } else if (
    lower.includes("informe") ||
    lower.includes("reporte") ||
    lower.includes("dictamen") ||
    lower.includes("diagnostico") ||
    lower.includes("diagnóstico")
  ) {
    queEs = "Informe Técnico / Reporte";
    tipoDetectado = "informe";
    categoriaSugerida = "otros";
    requiereCaducidad = false;
  }

  // 2. A quién pertenece / Titular
  let titularNombre: string | null = null;
  const matchTitular = fullText.match(
    /(?:Nombre[s]?|Titular|Postulante|Propietario|A nombre de|Lic[.]?|Ing[.]?|Abg[.]?|Dr[.]?)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})/i
  );
  if (matchTitular && matchTitular[1]) {
    titularNombre = matchTitular[1].trim();
  } else {
    // Buscar en nombre de archivo (ej. "CV Kleber Toapanta 2025.pdf")
    const matchNomArch = nombreArchivo.match(/(?:CV|Informe|Contrato|Cedula|Licencia)?[_\s-]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})/i);
    if (matchNomArch && matchNomArch[1]) {
      titularNombre = matchNomArch[1].trim();
    }
  }

  // 3. Identificación (Cédula 10 dígitos, RUC 13 dígitos, NIT / Alfanumérico)
  let titularIdentificacion: string | null = null;
  const matchRuc = fullText.match(/\b(\d{10}001)\b/);
  const matchCedula = fullText.match(/\b(\d{10})\b/);
  const matchNit = fullText.match(/(?:NIT|ID|C\.?I\.?|Cédula|RUC|Pasaporte|Doc\.?)\s*[:#\-]?\s*([A-Z0-9\-]{6,15})/i);

  if (matchRuc) {
    titularIdentificacion = matchRuc[1]!;
  } else if (matchCedula) {
    titularIdentificacion = matchCedula[1]!;
  } else if (matchNit && matchNit[1]) {
    titularIdentificacion = matchNit[1]!.replace(/[\s-]/g, "");
  }

  // 4. Lugar de Nacimiento o Emisión
  let lugarNacimiento: string | null = null;
  const matchLugar = fullText.match(/(?:Lugar de Nacimiento|Nacido en|Nacimiento en|Ciudad|Provincia|Domicilio|Residencia|Nacionalidad|Lugar de Emisión)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\s,]{3,35})/i);
  if (matchLugar && matchLugar[1]) {
    lugarNacimiento = matchLugar[1].trim().replace(/[\r\n]+/g, " ");
  } else {
    // Ciudades frecuentes
    const ciudades = ["Quito", "Guayaquil", "Cuenca", "Ambato", "Loja", "Manta", "Portoviejo", "Machala", "Ibarra", "Riobamba", "Santo Domingo", "Ecuador", "Bogotá", "Lima"];
    for (const c of ciudades) {
      if (fullText.includes(c)) {
        lugarNacimiento = c;
        break;
      }
    }
  }

  // 5. Fechas: Nacimiento, Emisión, Caducidad
  let fechaNacimiento: string | null = null;
  let fechaEmision: string | null = null;
  let fechaCaducidad: string | null = null;

  const matchFnac = fullText.match(/(?:Fecha de Nacimiento|F\.? Nacimiento|Nacido el|F\.? Nac\.?)\s*[:\-]?\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i);
  if (matchFnac && matchFnac[1]) fechaNacimiento = normalizarFecha(matchFnac[1]);

  const matchFemis = fullText.match(/(?:Fecha de Emisión|Emitido el|Emisión|Expedición|F\.? Emisión)\s*[:\-]?\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i);
  if (matchFemis && matchFemis[1]) fechaEmision = normalizarFecha(matchFemis[1]);

  const matchFcad = fullText.match(/(?:Fecha de Caducidad|Fecha de Vencimiento|Caduca|Vence|Vencimiento|Expiración|Validez hasta|Válido hasta)\s*[:\-]?\s*(\d{1,4}[-/.]\d{1,4}[-/.]\d{1,4})/i);
  if (matchFcad && matchFcad[1]) {
    fechaCaducidad = normalizarFecha(matchFcad[1]);
    requiereCaducidad = true;
  }

  // Si es un CV o informe, caducidad siempre debe ser false y fecha vacía
  if (tipoDetectado === "cv" || tipoDetectado === "informe" || tipoDetectado === "titulo_universitario") {
    requiereCaducidad = false;
    fechaCaducidad = null;
  }

  // Título sugerido limpio
  let tituloSugerido = queEs;
  if (titularNombre) {
    tituloSugerido = `${queEs} — ${titularNombre}`;
  } else if (nombreArchivo) {
    tituloSugerido = nombreArchivo.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  }

  // Resumen comprensivo
  const partesResumen = [`Documento identificado como: **${queEs}**.`];
  if (titularNombre) partesResumen.push(`Pertenece a: **${titularNombre}**.`);
  if (titularIdentificacion) partesResumen.push(`ID / Identificación: **${titularIdentificacion}**.`);
  if (lugarNacimiento) partesResumen.push(`Lugar / Origen: **${lugarNacimiento}**.`);
  if (fechaNacimiento) partesResumen.push(`F. Nacimiento: **${fechaNacimiento}**.`);
  if (requiereCaducidad && fechaCaducidad) {
    partesResumen.push(`⚠️ Requiere control de caducidad (Vence el ${fechaCaducidad}).`);
  } else if (!requiereCaducidad) {
    partesResumen.push(`⚪ Documento informativo/permanente: NO requiere validar caducidad.`);
  }

  return {
    tituloSugerido,
    categoriaSugerida,
    tipoSugerido: tipoDetectado,
    queEs,
    titularNombre,
    titularIdentificacion,
    lugarNacimiento,
    fechaNacimiento,
    fechaEmision,
    fechaCaducidad,
    requiereCaducidad,
    resumenOcr: partesResumen.join(" "),
    legible: true,
    observaciones: []
  };
}

export async function POST(req: NextRequest) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  let cuerpo: { archivos?: ArchivoEntrada[]; nombreContexto?: string };
  try {
    cuerpo = (await req.json()) as { archivos?: ArchivoEntrada[]; nombreContexto?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido" }, { status: 400 });
  }

  const archivos = cuerpo.archivos ?? [];
  if (archivos.length === 0) {
    return NextResponse.json({ ok: false, error: "No se proporcionaron archivos" }, { status: 400 });
  }

  // Se analiza el primer archivo que sea imagen o PDF
  const archivo = archivos.find((a) => {
    const mime = (a.mimetype ?? "").toLowerCase();
    const ext = (a.nombre ?? "").split(".").pop()?.toLowerCase() ?? "";
    return MIMES_ANALIZABLES.includes(mime) || ["png", "jpg", "jpeg", "webp", "pdf"].includes(ext);
  });

  if (!archivo) {
    return NextResponse.json({
      ok: true,
      analizado: false,
      motivo: "Formatos permitidos: PDF o imágenes (PNG, JPG o WEBP). Puedes completar los campos a mano.",
      analisis: null,
    });
  }

  const nombreArchivo = archivo.nombre ?? "documento.pdf";
  const nombreContexto = cuerpo.nombreContexto ?? "";
  let bufferArchivo: Buffer | null = null;

  if (archivo.base64) {
    const limpio = archivo.base64.includes(",") ? archivo.base64.split(",")[1]! : archivo.base64;
    bufferArchivo = Buffer.from(limpio, "base64");
  }

  // 1. Extracción de texto local si es PDF
  let textoExtraidoLocal = "";
  if (bufferArchivo && (archivo.mimetype?.includes("pdf") || nombreArchivo.toLowerCase().endsWith(".pdf"))) {
    try {
      textoExtraidoLocal = extraerTextoDePdfBuffer(bufferArchivo);
    } catch (errPdf) {
      console.warn("Aviso al extraer texto directo de PDF:", errPdf);
    }
  }

  // 2. Intentar llamar a Aria si hay almacenamiento y credenciales
  const admin = crearClienteAdmin();
  let analisisAria: any = null;
  let rutaTemporal: string | null = null;

  if (admin && bufferArchivo) {
    try {
      const ext = (archivo.nombre ?? "").split(".").pop()?.toLowerCase() || (archivo.mimetype?.includes("pdf") ? "pdf" : "jpg");
      rutaTemporal = `${CARPETA_TEMPORAL}/${user.id}/${randomUUID()}.${ext}`;
      const contentType = archivo.mimetype || (ext === "pdf" ? "application/pdf" : "image/jpeg");

      const { error: errorSubida } = await admin.storage
        .from("socios-documentos")
        .upload(rutaTemporal, bufferArchivo, { contentType, upsert: true });

      if (!errorSubida) {
        const { data: firmada } = await admin.storage
          .from("socios-documentos")
          .createSignedUrl(rutaTemporal, VIGENCIA_URL_SEGUNDOS);

        if (firmada?.signedUrl) {
          const { extraccion } = await extraerDocumento(firmada.signedUrl);
          if (extraccion && extraccion.legible) {
            analisisAria = extraccion;
          }
        }
      }
    } catch (errAria) {
      console.warn("Aviso al consultar agente Aria:", errAria);
    } finally {
      if (rutaTemporal) {
        await admin.storage.from("socios-documentos").remove([rutaTemporal]).catch(() => {});
      }
    }
  }

  // 3. Si Aria devolvió resultados estructurados completos
  if (analisisAria) {
    const tipo = analisisAria.tipo_detectado || "otro";
    const queEs = analisisAria.que_es || (tipo ? tipo.replaceAll("_", " ").replace(/^\w/, (c: string) => c.toUpperCase()) : "Documento Seguro");
    const cat = categoriaDe(tipo);
    const requiereCad = Boolean(analisisAria.requiere_caducidad);

    return NextResponse.json({
      ok: true,
      analizado: true,
      agente: "Aria (IA)",
      analisis: {
        tituloSugerido: analisisAria.titular ? `${queEs} — ${analisisAria.titular}` : (archivo.nombre?.replace(/\.[^/.]+$/, "") || queEs),
        categoriaSugerida: cat,
        tipoSugerido: tipo,
        queEs: queEs,
        titularNombre: analisisAria.titular,
        titularIdentificacion: analisisAria.identificacion,
        entidadEmisora: analisisAria.emisor,
        numeroDocumento: analisisAria.numero_documento,
        lugarNacimiento: analisisAria.lugar_nacimiento,
        fechaEmision: analisisAria.fecha_emision,
        fechaCaducidad: requiereCad ? analisisAria.fecha_caducidad : null,
        fechaNacimiento: analisisAria.fecha_nacimiento,
        requiereCaducidad: requiereCad,
        legible: analisisAria.legible,
        observaciones: analisisAria.observaciones || [],
        resumenOcr: analisisAria.resumen || (
          `Análisis IA completado: ${queEs}${analisisAria.titular ? ` de ${analisisAria.titular}` : ""}. ` +
          (requiereCad && analisisAria.fecha_caducidad ? `Caduca el ${analisisAria.fecha_caducidad}.` : `No requiere caducidad.`)
        )
      }
    });
  }

  // 4. Fallback Heurístico Robusto (Lectura local de PDF, metadatos y contexto)
  const analisisHeuristico = analizarContenidoDocumento(textoExtraidoLocal, nombreArchivo, nombreContexto);

  return NextResponse.json({
    ok: true,
    analizado: true,
    agente: "Aria Motor Local",
    analisis: analisisHeuristico
  });
}
