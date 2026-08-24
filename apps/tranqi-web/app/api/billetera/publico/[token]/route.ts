/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function obtenerTablaEnlaces(client: any) {
  try {
    if (typeof client?.schema === "function") {
      return client.schema("tranqui_legal").from("trq_enlace_compartido_ttl");
    }
  } catch {
    // fallback
  }
  return client.from("trq_enlace_compartido_ttl");
}

function obtenerTablaBilletera(client: any) {
  try {
    if (typeof client?.schema === "function") {
      return client.schema("tranqui_legal").from("trq_billetera_documento");
    }
  } catch {
    // fallback
  }
  return client.from("trq_billetera_documento");
}

// GET: Información pública del enlace (sin entregar el archivo directamente si requiere PIN)
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 400 });
    }

    const admin = (crearClienteAdmin() || await crearClienteServidor()) as any;
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Servicio no disponible" }, { status: 500 });
    }

    const { data: enlace, error } = await obtenerTablaEnlaces(admin)
      .select("ttl_id, ttl_token, ttl_modo_expiracion, ttl_expira_en, ttl_una_sola_vista, ttl_visitas_conteo, ttl_activo, ttl_pin_hash, ttl_documento_id, ttl_detalles")
      .eq("ttl_token", token)
      .single();

    if (error || !enlace) {
      return NextResponse.json({ ok: false, error: "El enlace no existe o es inválido" }, { status: 404 });
    }

    const enlaceData = enlace as any;
    const ahora = new Date();
    const expiraEn = new Date(enlaceData.ttl_expira_en);

    if (!enlaceData.ttl_activo || expiraEn.getTime() < ahora.getTime()) {
      return NextResponse.json({
        ok: false,
        estado: "expirado",
        error: "Este enlace de documento ha expirado y ya no está disponible"
      }, { status: 410 });
    }

    if (enlaceData.ttl_una_sola_vista && enlaceData.ttl_visitas_conteo > 0) {
      return NextResponse.json({
        ok: false,
        estado: "destruido",
        error: "Este documento era de 'Una Sola Vista' y ya fue visualizado previamente."
      }, { status: 410 });
    }

    const requierePin = !!enlaceData.ttl_pin_hash;

    // Obtener metadatos básicos del documento
    const { data: doc } = await obtenerTablaBilletera(admin)
      .select("doc_titulo, doc_categoria, doc_tipo, doc_archivo_nombre, doc_archivo_tamano, doc_archivo_mimetype, doc_fecha_emision, doc_fecha_caducidad, doc_entidad_emisora, doc_titular_nombre, doc_detalles, doc_archivos")
      .eq("doc_id", enlaceData.ttl_documento_id)
      .is("doc_eliminado_en", null)
      .single();

    const docData = doc as any;
    if (!docData) {
      return NextResponse.json({ ok: false, error: "El documento asociado ya no está disponible" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        token: enlaceData.ttl_token,
        titulo: docData.doc_titulo,
        categoria: docData.doc_categoria,
        tipo: docData.doc_tipo,
        archivo_nombre: docData.doc_archivo_nombre,
        archivo_tamano: docData.doc_archivo_tamano,
        archivo_mimetype: docData.doc_archivo_mimetype,
        fecha_emision: docData.doc_fecha_emision,
        fecha_caducidad: docData.doc_fecha_caducidad || docData.doc_detalles?.fecha_caducidad,
        entidad_emisora: docData.doc_entidad_emisora,
        titular_nombre: docData.doc_titular_nombre,
        expira_en: enlaceData.ttl_expira_en,
        una_sola_vista: enlaceData.ttl_una_sola_vista,
        requiere_pin: requierePin,
        tiempo_restante_ms: Math.max(0, expiraEn.getTime() - ahora.getTime())
      }
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Error al procesar enlace" }, { status: 500 });
  }
}

// POST: Descarga / Obtención de contenido del archivo (validando PIN y aplicando One-Time View)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { pin } = body;

    const admin = (crearClienteAdmin() || await crearClienteServidor()) as any;
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Servicio no disponible" }, { status: 500 });
    }

    const { data: enlace, error } = await obtenerTablaEnlaces(admin)
      .select("*")
      .eq("ttl_token", token)
      .single();

    if (error || !enlace) {
      return NextResponse.json({ ok: false, error: "Enlace no encontrado" }, { status: 404 });
    }

    const enlaceData = enlace as any;
    const ahora = new Date();
    const expiraEn = new Date(enlaceData.ttl_expira_en);

    if (!enlaceData.ttl_activo || expiraEn.getTime() < ahora.getTime()) {
      return NextResponse.json({ ok: false, error: "El enlace ha expirado" }, { status: 410 });
    }

    if (enlaceData.ttl_una_sola_vista && enlaceData.ttl_visitas_conteo > 0) {
      return NextResponse.json({ ok: false, error: "Documento de 'Una Sola Vista' ya consumido" }, { status: 410 });
    }

    // Validar PIN si está configurado
    if (enlaceData.ttl_pin_hash) {
      if (!pin) {
        return NextResponse.json({ ok: false, error: "Se requiere PIN de seguridad para acceder" }, { status: 403 });
      }
      const pinIngresadoHash = crypto.createHash("sha256").update(pin.trim()).digest("hex");
      if (pinIngresadoHash !== enlaceData.ttl_pin_hash) {
        return NextResponse.json({ ok: false, error: "PIN de seguridad incorrecto" }, { status: 403 });
      }
    }

    // Obtener documento con contenido
    const { data: doc, error: docError } = await obtenerTablaBilletera(admin)
      .select("*")
      .eq("doc_id", enlaceData.ttl_documento_id)
      .is("doc_eliminado_en", null)
      .single();

    const docData = doc as any;
    if (docError || !docData) {
      return NextResponse.json({ ok: false, error: "Documento no disponible" }, { status: 404 });
    }

    // Actualizar conteo de visitas y estado
    const nuevasVisitas = (enlaceData.ttl_visitas_conteo || 0) + 1;
    const nuevoActivo = enlaceData.ttl_una_sola_vista ? false : true;

    await obtenerTablaEnlaces(admin)
      .update({
        ttl_visitas_conteo: nuevasVisitas,
        ttl_visto_en: ahora.toISOString(),
        ttl_activo: nuevoActivo
      })
      .eq("ttl_id", enlaceData.ttl_id);

    const archivosFinales = docData.doc_archivos || docData.doc_detalles?.archivos || [{
      id: "p1",
      nombre: docData.doc_archivo_nombre,
      mimetype: docData.doc_archivo_mimetype,
      tamano: docData.doc_archivo_tamano,
      base64: docData.doc_archivo_base64,
      url: docData.doc_archivo_url
    }];

    return NextResponse.json({
      ok: true,
      data: {
        titulo: docData.doc_titulo,
        categoria: docData.doc_categoria,
        tipo: docData.doc_tipo,
        archivos: archivosFinales,
        archivo_nombre: docData.doc_archivo_nombre,
        archivo_mimetype: docData.doc_archivo_mimetype,
        archivo_tamano: docData.doc_archivo_tamano,
        archivo_url: docData.doc_archivo_url,
        archivo_base64: docData.doc_archivo_base64,
        titular_nombre: docData.doc_titular_nombre,
        titular_identificacion: docData.doc_titular_identificacion,
        entidad_emisora: docData.doc_entidad_emisora,
        fecha_emision: docData.doc_fecha_emision,
        fecha_caducidad: docData.doc_fecha_caducidad || docData.doc_detalles?.fecha_caducidad,
        fue_destruido: enlaceData.ttl_una_sola_vista
      }
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Error al acceder al documento" }, { status: 500 });
  }
}
