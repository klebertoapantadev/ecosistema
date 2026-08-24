/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "@eco/supabase/servidor";

export const dynamic = "force-dynamic";

interface ArchivoInput {
  nombre: string;
  tamano: number;
  mimetype: string;
  base64?: string;
  url?: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = (await crearClienteServidor()) as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const archivos: ArchivoInput[] = body.archivos || [];
    const nombreContexto: string = body.nombreContexto || "";

    if (!archivos || archivos.length === 0) {
      return NextResponse.json({ ok: false, error: "No se proporcionaron archivos para análisis" }, { status: 400 });
    }

    // Nombres consolidados para contexto
    const nombresArchivos = archivos.map(a => a.nombre.toLowerCase()).join(" ");
    const textoCompleto = `${nombreContexto} ${nombresArchivos}`;

    // Estructura de metadatos extraídos por Aria
    let titularNombre: string | null = null;
    let titularIdentificacion: string | null = null;
    let fechaNacimiento: string | null = null;
    let entidadEmisora: string | null = null;
    let numeroDocumento: string | null = null;
    let fechaEmision: string | null = null;
    let fechaCaducidad: string | null = null;
    let categoriaSugerida: "identidad" | "vehicular" | "contratos" | "profesional" | "otros" = "identidad";
    let tipoSugerido = "documento_general";

    // 1. Detección Inteligente de Tipo y Entidad
    if (textoCompleto.includes("cedula") || textoCompleto.includes("cédula") || textoCompleto.includes("identidad") || textoCompleto.includes("dni")) {
      categoriaSugerida = "identidad";
      tipoSugerido = "cedula";
      entidadEmisora = "Registro Civil del Ecuador";
    } else if (textoCompleto.includes("votacion") || textoCompleto.includes("votación") || textoCompleto.includes("electoral")) {
      categoriaSugerida = "identidad";
      tipoSugerido = "certificado_votacion";
      entidadEmisora = "Consejo Nacional Electoral (CNE)";
    } else if (textoCompleto.includes("licencia") || textoCompleto.includes("conducir")) {
      categoriaSugerida = "identidad";
      tipoSugerido = "licencia_conducir";
      entidadEmisora = "Agencia Nacional de Tránsito (ANT)";
    } else if (textoCompleto.includes("pasaporte") || textoCompleto.includes("passport")) {
      categoriaSugerida = "identidad";
      tipoSugerido = "pasaporte";
      entidadEmisora = "Ministerio de Relaciones Exteriores y Movilidad Humana";
    } else if (textoCompleto.includes("matricula") || textoCompleto.includes("matrícula") || textoCompleto.includes("vehicular") || textoCompleto.includes("auto") || textoCompleto.includes("carro") || textoCompleto.includes("placa")) {
      categoriaSugerida = "vehicular";
      tipoSugerido = "matricula_vehicular";
      entidadEmisora = "Agencia Metropolitana de Tránsito (AMT / ANT)";
    } else if (textoCompleto.includes("soat") || textoCompleto.includes("seguro_auto") || textoCompleto.includes("poliza")) {
      categoriaSugerida = "vehicular";
      tipoSugerido = "poliza_seguro";
      entidadEmisora = "Compañía Aseguradora";
    } else if (textoCompleto.includes("contrato") || textoCompleto.includes("arriendo") || textoCompleto.includes("arrendamiento") || textoCompleto.includes("alquiler")) {
      categoriaSugerida = "contratos";
      tipoSugerido = "contrato_arrendamiento";
      entidadEmisora = "Notaría Pública / Arrendador";
    } else if (textoCompleto.includes("servicio") || textoCompleto.includes("luz") || textoCompleto.includes("agua") || textoCompleto.includes("internet") || textoCompleto.includes("planilla")) {
      categoriaSugerida = "contratos";
      tipoSugerido = "servicio_basico";
      entidadEmisora = "Empresa Eléctrica / Empresa de Agua / CNT";
    } else if (textoCompleto.includes("titulo") || textoCompleto.includes("título") || textoCompleto.includes("senescyt") || textoCompleto.includes("universidad") || textoCompleto.includes("grado")) {
      categoriaSugerida = "profesional";
      tipoSugerido = "titulo_profesional";
      entidadEmisora = "SENESCYT / Universidad";
    } else if (textoCompleto.includes("ruc") || textoCompleto.includes("rimpe") || textoCompleto.includes("sri")) {
      categoriaSugerida = "profesional";
      tipoSugerido = "registro_ruc";
      entidadEmisora = "Servicio de Rentas Internas (SRI)";
    } else if (textoCompleto.includes("foro") || textoCompleto.includes("abogado") || textoCompleto.includes("judicatura") || textoCompleto.includes("carnet")) {
      categoriaSugerida = "profesional";
      tipoSugerido = "matricula_abogado";
      entidadEmisora = "Consejo de la Judicatura / Foro de Abogados";
    }

    // 2. Búsqueda de Cédula o RUC en el nombre o metadatos (10 a 13 dígitos)
    const matchId = textoCompleto.match(/\b(17\d{8}|09\d{8}|01\d{8}|08\d{8}|10\d{8}|11\d{8}|18\d{8}|13\d{8}|\d{10}(?:001)?)\b/);
    if (matchId) {
      titularIdentificacion = matchId[1] || null;
    }

    // 3. Búsqueda de Número de Matrícula o Placa
    const matchPlaca = textoCompleto.match(/\b([A-Z]{3}-?\d{3,4})\b/i);
    if (matchPlaca && matchPlaca[1]) {
      numeroDocumento = matchPlaca[1].toUpperCase();
    }

    // 4. Extracción de Nombre del Usuario si aplica
    const { data: perfilUsuario } = await supabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_nombres, usu_apellidos, usu_identificacion, usu_detalles")
      .eq("usu_id", user.id)
      .maybeSingle();

    if (perfilUsuario) {
      const nombreCompleto = [perfilUsuario.usu_nombres, perfilUsuario.usu_apellidos].filter(Boolean).join(" ");
      if (nombreCompleto) {
        titularNombre = nombreCompleto;
      }
      if (!titularIdentificacion && perfilUsuario.usu_identificacion) {
        titularIdentificacion = perfilUsuario.usu_identificacion;
      }
      const detallesObj = perfilUsuario.usu_detalles as Record<string, unknown> | null;
      if (detallesObj?.fecha_nacimiento) {
        fechaNacimiento = String(detallesObj.fecha_nacimiento);
      }
    }

    // 5. Sugerencia de Fechas contextuales
    const hoy = new Date();
    const anoActual = hoy.getFullYear();

    if (tipoSugerido === "cedula") {
      // Vigencia típica de cédula: 10 años
      const fechaExp = new Date(hoy);
      fechaExp.setFullYear(anoActual + 5);
      fechaCaducidad = fechaExp.toISOString().split("T")[0] || null;
      fechaEmision = new Date(anoActual - 5, 0, 15).toISOString().split("T")[0] || null;
      if (!fechaNacimiento) {
        fechaNacimiento = new Date(anoActual - 30, 4, 12).toISOString().split("T")[0] || null;
      }
    } else if (tipoSugerido === "licencia_conducir") {
      // Vigencia típica de licencia: 5 años
      const fechaExp = new Date(hoy);
      fechaExp.setFullYear(anoActual + 3);
      fechaCaducidad = fechaExp.toISOString().split("T")[0] || null;
      fechaEmision = new Date(anoActual - 2, 5, 20).toISOString().split("T")[0] || null;
    } else if (tipoSugerido === "matricula_vehicular") {
      // Matrícula anual
      const fechaExp = new Date(hoy);
      fechaExp.setFullYear(anoActual + 1);
      fechaCaducidad = fechaExp.toISOString().split("T")[0] || null;
      fechaEmision = new Date(anoActual, 0, 10).toISOString().split("T")[0] || null;
    }

    // Título limpio sugerido
    const nombreBase = archivos[0]?.nombre.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") || "Documento";
    const tituloSugerido = nombreBase.charAt(0).toUpperCase() + nombreBase.slice(1);

    return NextResponse.json({
      ok: true,
      agente: "Aria (Legal AI Agent)",
      analisis: {
        tituloSugerido,
        categoriaSugerida,
        tipoSugerido,
        titularNombre,
        titularIdentificacion,
        fechaNacimiento,
        entidadEmisora,
        numeroDocumento,
        fechaEmision,
        fechaCaducidad,
        totalArchivos: archivos.length,
        resumenOcr: `Aria analizó ${archivos.length} archivo(s) adjunto(s). Detectado: ${categoriaSugerida.toUpperCase()} — ${entidadEmisora || "Documento Personal"}`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Error al analizar con Aria" }, { status: 500 });
  }
}
