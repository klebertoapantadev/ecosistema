/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";

export const dynamic = "force-dynamic";

function obtenerTablaBilletera(client: any) {
  try {
    if (typeof client?.schema === "function") {
      return client.schema("tranqui_legal").from("trq_billetera_documento");
    }
  } catch {
    // Fallback estándar
  }
  return client.from("trq_billetera_documento");
}

export async function GET(req: NextRequest) {
  try {
    const supabase = (await crearClienteServidor()) as any;
    const adminSupabase = (crearClienteAdmin() || supabase) as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoria = searchParams.get("categoria");
    const estadoVigencia = searchParams.get("vigencia"); // 'vigente', 'por_vencer', 'vencido'

    let query = obtenerTablaBilletera(adminSupabase)
      .select("*")
      .eq("doc_usuario_id", user.id)
      .is("doc_eliminado_en", null)
      .order("doc_creado_en", { ascending: false });

    if (categoria && categoria !== "todas") {
      query = query.eq("doc_categoria", categoria);
    }

    const { data: rawData, error: queryError } = await query;
    let data = rawData;

    if (queryError) {
      // Intento fallback con cliente de servidor
      const fallbackQuery = obtenerTablaBilletera(supabase)
        .select("*")
        .eq("doc_usuario_id", user.id)
        .is("doc_eliminado_en", null)
        .order("doc_creado_en", { ascending: false });
      const resFallback = await fallbackQuery;
      if (resFallback.error) {
        console.warn("Aviso en consulta trq_billetera_documento:", queryError.message || resFallback.error.message);
        return NextResponse.json({ ok: true, data: [] });
      }
      data = resFallback.data;
    }

    const ahora = new Date();

    const documentosProcesados = (data || []).map((doc: any) => {
      let estado = "sin_caducidad";
      let diasParaVencer: number | null = null;
      
      // Obtener meses y alerta desde columnas o detalles JSONB
      const mesesAnticipacion = doc.doc_meses_anticipacion_alerta ?? doc.doc_detalles?.meses_anticipacion_alerta ?? 3;
      const alertaActiva = doc.doc_alertar_caducidad ?? doc.doc_detalles?.alertar_caducidad ?? true;
      const fechaCad = doc.doc_fecha_caducidad || doc.doc_detalles?.fecha_caducidad;
      const diasUmbralAlerta = mesesAnticipacion * 30; // ej. 3 meses = 90 días

      if (fechaCad) {
        const fechaObj = new Date(fechaCad);
        const diferenciaMs = fechaObj.getTime() - ahora.getTime();
        diasParaVencer = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

        if (diasParaVencer < 0) {
          estado = "vencido";
        } else if (alertaActiva !== false && diasParaVencer <= diasUmbralAlerta) {
          estado = "por_vencer";
        } else {
          estado = "vigente";
        }
      }

      // Archivos adjuntos normalizados desde doc_archivos o doc_detalles
      const archivosGuardados = doc.doc_archivos || doc.doc_detalles?.archivos;
      const listaArchivos = Array.isArray(archivosGuardados) && archivosGuardados.length > 0
        ? archivosGuardados
        : [{
            id: "archivo-principal",
            nombre: doc.doc_archivo_nombre || "documento.pdf",
            tamano: doc.doc_archivo_tamano || 0,
            mimetype: doc.doc_archivo_mimetype || "application/pdf",
            url: doc.doc_archivo_url,
            base64: doc.doc_archivo_base64
          }];

      return {
        ...doc,
        doc_fecha_caducidad: fechaCad || null,
        doc_alertar_caducidad: alertaActiva,
        doc_meses_anticipacion_alerta: mesesAnticipacion,
        doc_archivos: listaArchivos,
        estado_calculado: estado,
        dias_para_vencer: diasParaVencer
      };
    });

    let resultadoFinal = documentosProcesados;
    if (estadoVigencia && estadoVigencia !== "todos") {
      resultadoFinal = documentosProcesados.filter((d: any) => d.estado_calculado === estadoVigencia);
    }

    return NextResponse.json({ ok: true, data: resultadoFinal });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = (await crearClienteServidor()) as any;
    const adminSupabase = (crearClienteAdmin() || supabase) as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      categoria,
      tipo,
      titulo,
      archivos,
      archivoUrl,
      archivoNombre,
      archivoTamano,
      archivoMimetype,
      archivoBase64,
      entidadEmisora,
      numeroDocumento,
      fechaEmision,
      fechaCaducidad,
      fechaNacimiento,
      alertarCaducidad,
      mesesAnticipacionAlerta,
      titularNombre,
      titularIdentificacion,
      metadatosDinamicos,
      metadatosOcr,
      detalles
    } = body;

    if (!titulo || !categoria) {
      return NextResponse.json({ ok: false, error: "El título y la categoría son obligatorios" }, { status: 400 });
    }

    // Normalización de archivos adjuntos
    let listaArchivos: Array<{
      id: string;
      nombre: string;
      tamano: number;
      mimetype: string;
      base64?: string;
      url?: string;
    }> = [];

    if (Array.isArray(archivos) && archivos.length > 0) {
      listaArchivos = archivos;
    } else if (archivoNombre) {
      listaArchivos = [{
        id: "archivo-1",
        nombre: archivoNombre,
        tamano: archivoTamano || 0,
        mimetype: archivoMimetype || "application/pdf",
        base64: archivoBase64,
        url: archivoUrl
      }];
    }

    // Validación estricta de formatos permitidos (Imágenes y PDF únicamente)
    const FORMATOS_PERMITIDOS = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
    for (const a of listaArchivos) {
      const mime = (a.mimetype || "").toLowerCase();
      const ext = a.nombre.split(".").pop()?.toLowerCase() || "";
      const esValido = FORMATOS_PERMITIDOS.includes(mime) || ["png", "jpg", "jpeg", "webp", "pdf"].includes(ext);
      if (!esValido) {
        return NextResponse.json({
          ok: false,
          error: `Formato no permitido en '${a.nombre}'. Únicamente se aceptan imágenes (PNG, JPG, WebP) o archivos PDF.`
        }, { status: 400 });
      }
    }

    const primerArchivo = listaArchivos[0];

    // Extraer campos conocidos desde metadatosDinamicos si no vinieron explícitos
    let titularExtraido = titularNombre || null;
    let idExtraida = titularIdentificacion || null;
    let emisorExtraido = entidadEmisora || null;
    let numDocExtraido = numeroDocumento || null;

    if (Array.isArray(metadatosDinamicos)) {
      for (const item of metadatosDinamicos) {
        const k = (item.clave || "").toLowerCase();
        const v = (item.valor || "").trim();
        if (!v) continue;
        if (!titularExtraido && (k.includes("titular") || k.includes("nombre"))) titularExtraido = v;
        if (!idExtraida && (k.includes("cedula") || k.includes("cédula") || k.includes("ruc") || k.includes("pasaporte") || k.includes("identificacion"))) idExtraida = v;
        if (!emisorExtraido && (k.includes("emisor") || k.includes("entidad") || k.includes("institucion"))) emisorExtraido = v;
        if (!numDocExtraido && (k.includes("numero") || k.includes("número") || k.includes("matricula") || k.includes("placa"))) numDocExtraido = v;
      }
    }

    const detallesJSONB = {
      ...(detalles || {}),
      archivos: listaArchivos,
      metadatos_dinamicos: metadatosDinamicos || [],
      alertar_caducidad: alertarCaducidad !== undefined ? Boolean(alertarCaducidad) : true,
      meses_anticipacion_alerta: Number(mesesAnticipacionAlerta) || 3,
      fecha_caducidad: fechaCaducidad || null,
      fecha_nacimiento: fechaNacimiento || null
    };

    const metadatosOcrJSONB = {
      ...(metadatosOcr || {}),
      metadatos_dinamicos: metadatosDinamicos || []
    };

    // Payload completo
    const payloadCompleto: any = {
      doc_usuario_id: user.id,
      doc_negocio: "TRANQ",
      doc_categoria: categoria,
      doc_tipo: tipo || categoria || "general",
      doc_titulo: titulo,
      doc_archivos: listaArchivos,
      doc_archivo_url: primerArchivo?.url || archivoUrl || null,
      doc_archivo_nombre: primerArchivo?.nombre || archivoNombre || "documento.pdf",
      doc_archivo_tamano: primerArchivo?.tamano || archivoTamano || 0,
      doc_archivo_mimetype: primerArchivo?.mimetype || archivoMimetype || "application/pdf",
      doc_archivo_base64: primerArchivo?.base64 || archivoBase64 || null,
      doc_entidad_emisora: emisorExtraido,
      doc_numero_documento: numDocExtraido,
      doc_fecha_emision: fechaEmision ? new Date(fechaEmision).toISOString() : null,
      doc_fecha_caducidad: fechaCaducidad ? new Date(fechaCaducidad).toISOString() : null,
      doc_fecha_nacimiento: fechaNacimiento ? new Date(fechaNacimiento).toISOString() : null,
      doc_alertar_caducidad: alertarCaducidad !== undefined ? Boolean(alertarCaducidad) : true,
      doc_meses_anticipacion_alerta: Number(mesesAnticipacionAlerta) || 3,
      doc_titular_nombre: titularExtraido,
      doc_titular_identificacion: idExtraida,
      doc_metadatos_ocr: metadatosOcrJSONB,
      doc_detalles: detallesJSONB,
      doc_actualizado_en: new Date().toISOString()
    };

    // Payload base (compatible 100% si la base aún no tiene las columnas nuevas)
    const payloadBase: any = {
      doc_usuario_id: user.id,
      doc_negocio: "TRANQ",
      doc_categoria: categoria,
      doc_tipo: tipo || categoria || "general",
      doc_titulo: titulo,
      doc_archivo_url: primerArchivo?.url || archivoUrl || null,
      doc_archivo_nombre: primerArchivo?.nombre || archivoNombre || "documento.pdf",
      doc_archivo_tamano: primerArchivo?.tamano || archivoTamano || 0,
      doc_archivo_mimetype: primerArchivo?.mimetype || archivoMimetype || "application/pdf",
      doc_archivo_base64: primerArchivo?.base64 || archivoBase64 || null,
      doc_entidad_emisora: emisorExtraido,
      doc_numero_documento: numDocExtraido,
      doc_fecha_emision: fechaEmision ? new Date(fechaEmision).toISOString() : null,
      doc_fecha_caducidad: fechaCaducidad ? new Date(fechaCaducidad).toISOString() : null,
      doc_titular_nombre: titularExtraido,
      doc_titular_identificacion: idExtraida,
      doc_metadatos_ocr: metadatosOcrJSONB,
      doc_detalles: detallesJSONB,
      doc_actualizado_en: new Date().toISOString()
    };

    let dataRes;
    const clientDb = adminSupabase || supabase;

    if (id) {
      // Actualización
      let resUpdate = await obtenerTablaBilletera(clientDb)
        .update(payloadCompleto)
        .eq("doc_id", id)
        .eq("doc_usuario_id", user.id)
        .select()
        .single();

      if (resUpdate.error) {
        // Reintentar con payloadBase si falló por columnas nuevas
        resUpdate = await obtenerTablaBilletera(clientDb)
          .update(payloadBase)
          .eq("doc_id", id)
          .eq("doc_usuario_id", user.id)
          .select()
          .single();
      }

      if (resUpdate.error) throw resUpdate.error;
      dataRes = resUpdate.data;
    } else {
      // Inserción
      let resInsert = await obtenerTablaBilletera(clientDb)
        .insert({
          ...payloadCompleto,
          doc_creado_en: new Date().toISOString()
        })
        .select()
        .single();

      if (resInsert.error) {
        console.warn("Reintentando insert con payload base seguro:", resInsert.error.message);
        // Reintentar con payloadBase
        resInsert = await obtenerTablaBilletera(clientDb)
          .insert({
            ...payloadBase,
            doc_creado_en: new Date().toISOString()
          })
          .select()
          .single();
      }

      if (resInsert.error) {
        // Último intento con cliente de servidor directamente si admin falló
        resInsert = await obtenerTablaBilletera(supabase)
          .insert({
            ...payloadBase,
            doc_creado_en: new Date().toISOString()
          })
          .select()
          .single();
      }

      if (resInsert.error) throw resInsert.error;
      dataRes = resInsert.data;
    }

    return NextResponse.json({ ok: true, data: dataRes });
  } catch (error: any) {
    console.error("Error al guardar documento en Billetera:", error);
    return NextResponse.json({ ok: false, error: error.message || "Error al guardar documento" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = (await crearClienteServidor()) as any;
    const adminSupabase = (crearClienteAdmin() || supabase) as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID de documento no especificado" }, { status: 400 });
    }

    const clientDb = adminSupabase || supabase;

    // Eliminación lógica
    const { error } = await obtenerTablaBilletera(clientDb)
      .update({ doc_eliminado_en: new Date().toISOString() })
      .eq("doc_id", id)
      .eq("doc_usuario_id", user.id);

    if (error) {
      // Fallback a eliminación directa si aplica
      await obtenerTablaBilletera(clientDb)
        .delete()
        .eq("doc_id", id)
        .eq("doc_usuario_id", user.id);
    }

    return NextResponse.json({ ok: true, mensaje: "Documento eliminado correctamente" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Error al eliminar documento" }, { status: 500 });
  }
}
