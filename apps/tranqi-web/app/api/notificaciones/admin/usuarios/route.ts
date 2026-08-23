/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";

export interface NotificacionUsuarioAdminItem {
  not_id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_correo: string;
  not_negocio: string;
  not_canal: string;
  not_titulo: string;
  not_contenido_html: string;
  not_url_accion?: string | null;
  not_leido_en?: string | null;
  not_pospuesta_hasta?: string | null;
  not_pospuesta_horas?: number | null;
  not_eliminada: boolean;
  not_eliminada_en?: string | null;
  not_creado_en: string;
  not_detalles?: Record<string, unknown>;
  confirmada_por?: { usuario_id: string; usuario_nombre: string; usuario_correo: string; fecha: string } | null;
  pospuesta_por?: { usuario_id: string; usuario_nombre: string; usuario_correo: string; fecha: string; horas?: number } | null;
  eliminada_por?: { usuario_id: string; usuario_nombre: string; usuario_correo: string; fecha: string } | null;
  restaurada_por?: { usuario_id: string; usuario_nombre: string; usuario_correo: string; fecha: string } | null;
}

export async function GET(request: Request) {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const perfilesTranqi = await obtenerPerfiles("tranqi");
    const perfilesTRANQ = await obtenerPerfiles("TRANQ");
    const perfiles = Array.from(new Set([...perfilesTranqi, ...perfilesTRANQ]));
    const correo = (perfil.usu_correo || "").toLowerCase().trim();
    const esSuperAdminEmail = correo === "kleber.toapanta.ch@gmail.com" || correo === "jesus251296@gmail.com";
    const esAutorizado = esSuperAdminEmail || Boolean(perfil?.usu_superadmin_plataforma) || perfiles.includes("ADMINISTRADOR") || perfiles.includes("OPERADOR") || perfiles.includes("SUPERADMIN");

    if (!esAutorizado) {
      return NextResponse.json({ error: "Acceso Denegado: Se requiere rol de Operador o Administrador." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filtroUsuarioId = searchParams.get("usuario_id");
    const filtroNegocio = searchParams.get("negocio") || "TRANQ";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = crearClienteAdmin() || await crearClienteServidor();

    // 1. Obtener notificaciones registradas
    let query = client
      .schema("comun_notificacion")
      .from("not_registro")
      .select("not_id, not_usuario_id, not_negocio, not_canal, not_titulo, not_contenido_html, not_url_accion, not_leido_en, not_detalles, not_creado_en")
      .order("not_creado_en", { ascending: false })
      .limit(300);

    if (filtroUsuarioId) {
      query = query.eq("not_usuario_id", filtroUsuarioId);
    }

    const { data: registros, error: errNotifs } = await query;
    if (errNotifs) {
      console.error("Error al consultar not_registro:", errNotifs);
    }

    // 2. Obtener usuarios para correlacionar nombres y correos
    const { data: usuarios } = await client
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_nombres, usu_apellidos, usu_correo");

    const mapaUsuarios = new Map<string, { nombre: string; correo: string }>();
    if (usuarios && Array.isArray(usuarios)) {
      usuarios.forEach((u: { usu_id: string; usu_nombres?: string | null; usu_apellidos?: string | null; usu_correo: string }) => {
        const nombre = [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ") || u.usu_correo;
        mapaUsuarios.set(u.usu_id, { nombre, correo: u.usu_correo });
      });
    }

    const lista: NotificacionUsuarioAdminItem[] = [];

    if (registros && Array.isArray(registros)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registros.forEach((r: any) => {
        const uInfo = mapaUsuarios.get(r.not_usuario_id) || { nombre: "Usuario Desconocido", correo: "—" };
        const detalles = (r.not_detalles as Record<string, unknown>) || {};

        lista.push({
          not_id: r.not_id,
          usuario_id: r.not_usuario_id,
          usuario_nombre: uInfo.nombre,
          usuario_correo: uInfo.correo,
          not_negocio: r.not_negocio || filtroNegocio,
          not_canal: r.not_canal || "IN_APP",
          not_titulo: r.not_titulo,
          not_contenido_html: r.not_contenido_html,
          not_url_accion: r.not_url_accion,
          not_leido_en: r.not_leido_en,
          not_pospuesta_hasta: (detalles.pospuesta_hasta as string) || null,
          not_pospuesta_horas: (detalles.pospuesta_horas as number) || null,
          not_eliminada: Boolean(detalles.eliminada),
          not_eliminada_en: (detalles.eliminada_en as string) || null,
          not_creado_en: r.not_creado_en,
          not_detalles: detalles,
          confirmada_por: (detalles.confirmada_por as any) || (detalles.confirmada_usuario_nombre ? { usuario_id: detalles.confirmada_usuario_id as string, usuario_nombre: detalles.confirmada_usuario_nombre as string, usuario_correo: "", fecha: (detalles.confirmada_en as string) || "" } : null),
          pospuesta_por: (detalles.pospuesta_por as any) || (detalles.pospuesta_usuario_nombre ? { usuario_id: detalles.pospuesta_usuario_id as string, usuario_nombre: detalles.pospuesta_usuario_nombre as string, usuario_correo: "", fecha: (detalles.pospuesta_en as string) || "", horas: detalles.pospuesta_horas as number } : null),
          eliminada_por: (detalles.eliminada_por as any) || (detalles.eliminada_usuario_nombre ? { usuario_id: detalles.eliminada_usuario_id as string, usuario_nombre: detalles.eliminada_usuario_nombre as string, usuario_correo: "", fecha: (detalles.eliminada_en as string) || "" } : null),
          restaurada_por: (detalles.restaurada_por as any) || (detalles.restaurada_usuario_nombre ? { usuario_id: detalles.restaurada_usuario_id as string, usuario_nombre: detalles.restaurada_usuario_nombre as string, usuario_correo: "", fecha: (detalles.restaurada_en as string) || "" } : null)
        });
      });
    }

    return NextResponse.json({
      success: true,
      total: lista.length,
      notificaciones: lista,
      usuariosDisponibles: Array.from(mapaUsuarios.entries()).map(([id, val]) => ({
        id,
        nombre: val.nombre,
        correo: val.correo
      }))
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener notificaciones para administración";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const perfilesTranqi = await obtenerPerfiles("tranqi");
    const perfilesTRANQ = await obtenerPerfiles("TRANQ");
    const perfiles = Array.from(new Set([...perfilesTranqi, ...perfilesTRANQ]));
    const correo = (perfil.usu_correo || "").toLowerCase().trim();
    const esSuperAdminEmail = correo === "kleber.toapanta.ch@gmail.com" || correo === "jesus251296@gmail.com";
    const esAutorizado = esSuperAdminEmail || Boolean(perfil?.usu_superadmin_plataforma) || perfiles.includes("ADMINISTRADOR") || perfiles.includes("OPERADOR") || perfiles.includes("SUPERADMIN");

    if (!esAutorizado) {
      return NextResponse.json({ error: "Acceso Denegado" }, { status: 403 });
    }

    const body = await request.json();
    const { not_id, accion } = body;

    if (!not_id || !accion) {
      return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = crearClienteAdmin() || await crearClienteServidor();

    const { data: registro } = await client
      .schema("comun_notificacion")
      .from("not_registro")
      .select("not_id, not_detalles")
      .eq("not_id", not_id)
      .maybeSingle();

    if (!registro) {
      return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 });
    }

    const detalles = (registro.not_detalles as Record<string, unknown>) || {};
    const ahora = new Date().toISOString();

    if (accion === "restaurar") {
      await client
        .schema("comun_notificacion")
        .from("not_registro")
        .update({
          not_detalles: { ...detalles, eliminada: false, restaurada_por_admin: perfil.usu_id, restaurada_en: ahora }
        })
        .eq("not_id", not_id);
    } else if (accion === "marcar_leida") {
      await client
        .schema("comun_notificacion")
        .from("not_registro")
        .update({
          not_leido_en: ahora
        })
        .eq("not_id", not_id);
    }

    return NextResponse.json({ success: true, not_id, accion });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al procesar acción de administración";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
