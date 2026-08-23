/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "@eco/supabase/servidor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = (await crearClienteServidor()) as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoria = searchParams.get("categoria");
    const estadoVigencia = searchParams.get("vigencia"); // 'vigente', 'por_vencer', 'vencido'

    let query = supabase
      .from("trq_billetera_documento")
      .select("*")
      .eq("doc_usuario_id", user.id)
      .is("doc_eliminado_en", null)
      .order("doc_creado_en", { ascending: false });

    if (categoria && categoria !== "todas") {
      query = query.eq("doc_categoria", categoria);
    }

    const { data, error } = await query;

    if (error) {
      // Si la tabla aun no estuviera migrada, responder con fallback amigable
      console.warn("Aviso en trq_billetera_documento:", error.message);
      return NextResponse.json({ ok: true, data: [] });
    }

    const ahora = new Date();
    const en30Dias = new Date();
    en30Dias.setDate(ahora.getDate() + 30);

    const documentosProcesados = (data || []).map((doc: any) => {
      let estado = "sin_caducidad";
      let diasParaVencer: number | null = null;

      if (doc.doc_fecha_caducidad) {
        const fechaCad = new Date(doc.doc_fecha_caducidad);
        const diferenciaMs = fechaCad.getTime() - ahora.getTime();
        diasParaVencer = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

        if (diasParaVencer < 0) {
          estado = "vencido";
        } else if (diasParaVencer <= 30) {
          estado = "por_vencer";
        } else {
          estado = "vigente";
        }
      }

      return {
        ...doc,
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
      archivoUrl,
      archivoNombre,
      archivoTamano,
      archivoMimetype,
      archivoBase64,
      entidadEmisora,
      numeroDocumento,
      fechaEmision,
      fechaCaducidad,
      titularNombre,
      titularIdentificacion,
      metadatosOcr,
      detalles
    } = body;

    if (!titulo || !categoria) {
      return NextResponse.json({ ok: false, error: "El título y la categoría son obligatorios" }, { status: 400 });
    }

    const payload: any = {
      doc_usuario_id: user.id,
      doc_negocio: "TRANQ",
      doc_categoria: categoria,
      doc_tipo: tipo || "documento_general",
      doc_titulo: titulo,
      doc_archivo_url: archivoUrl || null,
      doc_archivo_nombre: archivoNombre || "documento.pdf",
      doc_archivo_tamano: archivoTamano || 0,
      doc_archivo_mimetype: archivoMimetype || "application/pdf",
      doc_archivo_base64: archivoBase64 || null,
      doc_entidad_emisora: entidadEmisora || null,
      doc_numero_documento: numeroDocumento || null,
      doc_fecha_emision: fechaEmision ? new Date(fechaEmision).toISOString() : null,
      doc_fecha_caducidad: fechaCaducidad ? new Date(fechaCaducidad).toISOString() : null,
      doc_titular_nombre: titularNombre || null,
      doc_titular_identificacion: titularIdentificacion || null,
      doc_metadatos_ocr: metadatosOcr || {},
      doc_detalles: detalles || {},
      doc_actualizado_en: new Date().toISOString()
    };

    let dataRes;
    if (id) {
      // Actualización
      const { data, error } = await supabase
        .from("trq_billetera_documento")
        .update(payload)
        .eq("doc_id", id)
        .eq("doc_usuario_id", user.id)
        .select()
        .single();

      if (error) throw error;
      dataRes = data;
    } else {
      // Inserción
      const { data, error } = await supabase
        .from("trq_billetera_documento")
        .insert({
          ...payload,
          doc_creado_en: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      dataRes = data;
    }

    return NextResponse.json({ ok: true, data: dataRes });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Error al guardar documento" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = (await crearClienteServidor()) as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID de documento no especificado" }, { status: 400 });
    }

    // Eliminación lógica
    const { error } = await supabase
      .from("trq_billetera_documento")
      .update({ doc_eliminado_en: new Date().toISOString() })
      .eq("doc_id", id)
      .eq("doc_usuario_id", user.id);

    if (error) {
      // Fallback a eliminación directa si aplica
      await supabase
        .from("trq_billetera_documento")
        .delete()
        .eq("doc_id", id)
        .eq("doc_usuario_id", user.id);
    }

    return NextResponse.json({ ok: true, mensaje: "Documento eliminado correctamente" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Error al eliminar documento" }, { status: 500 });
  }
}
