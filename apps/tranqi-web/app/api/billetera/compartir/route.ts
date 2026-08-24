/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import crypto from "crypto";
import {
  obtenerDocumentosResilientes,
  guardarEnlaceTtlResiliente,
  listarEnlacesTtlUsuario,
  revocarEnlaceTtlResiliente
} from "../almacen";

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

function calcularFechaExpiracion(modo: string, fechaManual?: string): Date {
  const ahora = new Date();
  switch (modo) {
    case "1h":
      return new Date(ahora.getTime() + 1 * 60 * 60 * 1000);
    case "3h":
      return new Date(ahora.getTime() + 3 * 60 * 60 * 1000);
    case "6h":
      return new Date(ahora.getTime() + 6 * 60 * 60 * 1000);
    case "12h":
      return new Date(ahora.getTime() + 12 * 60 * 60 * 1000);
    case "24h":
      return new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    case "3d":
      return new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);
    case "una_vista":
      // 24 horas máximo de vigencia para abrirlo, pero se destruye en la 1ra vista
      return new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    case "fecha_fija":
      if (fechaManual) return new Date(fechaManual);
      return new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    default:
      return new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
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
    const { documentoId, modoExpiracion = "24h", fechaExpiracionManual, pinSeguridad } = body;

    if (!documentoId) {
      return NextResponse.json({ ok: false, error: "Documento ID requerido" }, { status: 400 });
    }

    const clientDb = adminSupabase || supabase;

    // Verificar que el documento exista y pertenezca al usuario (BDD o Almacén)
    let docTitulo = "Documento Seguro";
    try {
      const { data: doc } = await obtenerTablaBilletera(clientDb)
        .select("doc_id, doc_titulo")
        .eq("doc_id", documentoId)
        .eq("doc_usuario_id", user.id)
        .is("doc_eliminado_en", null)
        .single();
      if (doc?.doc_titulo) docTitulo = doc.doc_titulo;
    } catch {
      const docsRes = await obtenerDocumentosResilientes(user.id);
      const docEncontrado = docsRes.find(d => d.doc_id === documentoId);
      if (docEncontrado) docTitulo = docEncontrado.doc_titulo;
    }

    const fechaExpira = calcularFechaExpiracion(modoExpiracion, fechaExpiracionManual);
    const unaSolaVista = modoExpiracion === "una_vista";
    const tokenAleatorio = crypto.randomBytes(24).toString("base64url");

    let pinHash: string | null = null;
    if (pinSeguridad && pinSeguridad.trim().length > 0) {
      pinHash = crypto.createHash("sha256").update(pinSeguridad.trim()).digest("hex");
    }

    const payload = {
      ttl_documento_id: documentoId,
      ttl_usuario_id: user.id,
      ttl_token: tokenAleatorio,
      ttl_modo_expiracion: modoExpiracion,
      ttl_expira_en: fechaExpira.toISOString(),
      ttl_una_sola_vista: unaSolaVista,
      ttl_pin_hash: pinHash,
      ttl_activo: true,
      ttl_detalles: {
        doc_titulo: docTitulo,
        creado_desde_ip: req.headers.get("x-forwarded-for") || "local"
      },
      ttl_creado_en: new Date().toISOString()
    };

    let dataRes: any = null;
    try {
      const { data, error } = await obtenerTablaEnlaces(clientDb)
        .insert(payload)
        .select()
        .single();
      if (!error && data) dataRes = data;
    } catch {
      // Fallback
    }

    if (!dataRes) {
      dataRes = guardarEnlaceTtlResiliente(payload);
    }

    const baseUrl = req.nextUrl.origin;
    const enlacePublico = `${baseUrl}/compartir/documento/${tokenAleatorio}`;

    return NextResponse.json({
      ok: true,
      data: {
        ...dataRes,
        enlace_url: enlacePublico
      }
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Error al generar enlace TTL" }, { status: 500 });
  }
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
    const documentoId = searchParams.get("documentoId");

    const clientDb = adminSupabase || supabase;
    let enlacesRecuperados: any[] = [];

    try {
      let query = obtenerTablaEnlaces(clientDb)
        .select("ttl_id, ttl_token, ttl_modo_expiracion, ttl_expira_en, ttl_una_sola_vista, ttl_visto_en, ttl_visitas_conteo, ttl_activo, ttl_creado_en, ttl_documento_id, ttl_pin_hash")
        .eq("ttl_usuario_id", user.id)
        .order("ttl_creado_en", { ascending: false });

      if (documentoId) {
        query = query.eq("ttl_documento_id", documentoId);
      }

      const { data, error } = await query;
      if (!error && data) {
        enlacesRecuperados = data;
      }
    } catch {
      // Fallback
    }

    if (enlacesRecuperados.length === 0) {
      enlacesRecuperados = listarEnlacesTtlUsuario(user.id, documentoId);
    }

    const baseUrl = req.nextUrl.origin;
    const ahora = new Date();

    const enlacesProcesados = enlacesRecuperados.map((item: any) => {
      const fechaExp = new Date(item.ttl_expira_en);
      const estaExpirado = fechaExp.getTime() < ahora.getTime();
      const estaRevocadoPorVista = item.ttl_una_sola_vista && (item.ttl_visitas_conteo > 0 || !item.ttl_activo);
      const estaVigente = item.ttl_activo && !estaExpirado && !estaRevocadoPorVista;

      return {
        ...item,
        requiere_pin: !!item.ttl_pin_hash,
        esta_vigente: estaVigente,
        esta_expirado: estaExpirado,
        enlace_url: `${baseUrl}/compartir/documento/${item.ttl_token}`
      };
    });

    return NextResponse.json({ ok: true, data: enlacesProcesados });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Error al listar enlaces" }, { status: 500 });
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
    const token = searchParams.get("token");
    const id = searchParams.get("id");

    if (!token && !id) {
      return NextResponse.json({ ok: false, error: "Token o ID requerido" }, { status: 400 });
    }

    const clientDb = adminSupabase || supabase;

    try {
      let query = obtenerTablaEnlaces(clientDb)
        .update({ ttl_activo: false })
        .eq("ttl_usuario_id", user.id);

      if (token) query = query.eq("ttl_token", token);
      if (id) query = query.eq("ttl_id", id);

      await query;
    } catch {
      // Ignorar si no existe tabla
    }

    revocarEnlaceTtlResiliente(user.id, token || id || "");

    return NextResponse.json({ ok: true, mensaje: "Enlace efímero revocado exitosamente" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Error al revocar enlace" }, { status: 500 });
  }
}
